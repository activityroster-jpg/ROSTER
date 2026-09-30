import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { COURSE_AUDIENCES, type CourseAudience } from "@/lib/db/schema";
import { draftsFromIcs, timeToSlot, toEpochMs } from "@/lib/import/parse";
import { writeAudit } from "./audit";

export interface SyncOutcome {
  created: number;
  duplicates: number;
  skipped: number;
  total: number;
}

/**
 * Turn an ICS calendar feed's text into courses + sessions, one-way and
 * idempotent: an event that already maps to a course of the same name on the
 * same date + slot is skipped, so re-syncing the same feed never duplicates.
 * Only events from today onward are considered. Tenant scoped and audited.
 */
export async function syncIcsFeed(
  repos: Repositories,
  ctx: AnyTenantContext,
  feedText: string,
): Promise<SyncOutcome> {
  const t = repos.tenant;
  const drafts = draftsFromIcs(feedText);
  const today = new Date().toISOString().slice(0, 10);

  const [types, courses, sessions] = await Promise.all([
    t.courseType.list(ctx),
    t.course.list(ctx),
    t.courseSession.list(ctx),
  ]);
  const typeByName = new Map(types.map((c) => [c.name.trim().toLowerCase(), c]));
  const courseName = new Map(courses.map((c) => {
    const type = types.find((x) => x.id === c.courseTypeId);
    return [c.id, (c.name ?? type?.name ?? "").trim().toLowerCase()];
  }));
  // Existing "name|date|slot" keys so we don't re-create the same session.
  const existing = new Set<string>();
  for (const s of sessions) {
    const nm = courseName.get(s.courseId) ?? "";
    existing.add(`${nm}|${s.date}|${s.slot}`);
  }

  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  let created = 0;
  let duplicates = 0;
  let skipped = 0;

  for (const d of drafts) {
    const name = (d.name ?? "").trim();
    const date = (d.date ?? "").trim();
    if (!name || !ISO.test(date)) { skipped++; continue; }
    if (date < today) { skipped++; continue; } // ignore past events
    const startTime = d.startTime || "09:00";
    const endTime = d.endTime || "";
    const slot = timeToSlot(startTime);
    const key = `${name.toLowerCase()}|${date}|${slot}`;
    if (existing.has(key)) { duplicates++; continue; }

    const audience: CourseAudience = (COURSE_AUDIENCES as readonly string[]).includes(d.audience)
      ? (d.audience as CourseAudience)
      : "all";

    let type = typeByName.get(name.toLowerCase());
    if (!type) {
      type = await t.courseType.insert(ctx, {
        name,
        scheme: "Imported",
        audience,
        defaultCapacity: 8,
        studentsPerInstructor: 4,
        requiresSafetyBoat: audience === "youth",
        active: true,
      });
      typeByName.set(name.toLowerCase(), type);
    }

    const course = await t.course.insert(ctx, {
      courseTypeId: type.id,
      name,
      capacity: type.defaultCapacity ?? 8,
      ratio: type.studentsPerInstructor ?? 4,
      status: "scheduled",
    });
    await t.courseSession.insert(ctx, {
      courseId: course.id,
      date,
      slot,
      startAt: new Date(toEpochMs(date, startTime, 9)),
      endAt: new Date(toEpochMs(date, endTime || startTime, 12)),
    });
    existing.add(key);
    created++;
  }

  await writeAudit(repos, ctx, {
    action: "integration_sync",
    entity: "integration",
    after: { created, duplicates, skipped, total: drafts.length },
  });

  return { created, duplicates, skipped, total: drafts.length };
}
