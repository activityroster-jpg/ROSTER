"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { COURSE_AUDIENCES, type CourseAudience } from "@/lib/db/schema";
import { writeAudit } from "@/lib/services/audit";
import { timeToSlot, toEpochMs } from "@/lib/import/parse";
import { createCourseTypeResolver } from "@/lib/services/course-type-resolve";
import { syncHoursForCourse } from "@/lib/services/hours";

export interface ConfirmedRow {
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  audience: string;
  location: string;
  staff: string;
  /** Review choice: a course type id, TYPE_NEW or TYPE_ONEOFF. */
  typeChoice?: string;
}

export interface ImportResult {
  ok: boolean;
  created: number;
  skipped: number;
  message?: string;
  error?: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Create courses (+ a first session, and optional location/staff links) from
 * reviewed import rows. Everything goes through the tenant repositories, so the
 * org filter is enforced. Rows the admin left incomplete are skipped, never
 * guessed. Each row lands under the course type chosen in review; new types
 * (listed or one-off) and locations are created on demand.
 */
export async function importCoursesAction(rows: ConfirmedRow[]): Promise<ImportResult> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, created: 0, skipped: 0, error: "Nothing to import" };

  const t = repos.tenant;
  const resolver = await createCourseTypeResolver(repos, ctx);
  const [existingLocations, instructors, roles] = await Promise.all([
    t.location.list(ctx),
    t.instructor.list(ctx),
    t.roleType.list(ctx),
  ]);

  const locByName = new Map(existingLocations.map((l) => [l.name.trim().toLowerCase(), l]));
  const instructorByName = new Map(instructors.map((i) => [i.name.trim().toLowerCase(), i]));
  const defaultRole = roles.find((r) => r.active && r.countsTowardRatio) ?? roles.find((r) => r.active);

  let created = 0;
  let skipped = 0;

  for (const raw of rows) {
    const name = (raw.name ?? "").trim();
    const date = (raw.date ?? "").trim();
    if (!name || !ISO.test(date)) { skipped++; continue; }

    const audience: CourseAudience = (COURSE_AUDIENCES as readonly string[]).includes(raw.audience)
      ? (raw.audience as CourseAudience)
      : "all";

    // 1) course type — the admin's review choice, else best match / one-off
    const choice = typeof raw.typeChoice === "string" && raw.typeChoice.length <= 64 ? raw.typeChoice : undefined;
    const type = await resolver.resolve(name, audience, choice);

    // 2) course
    const course = await t.course.insert(ctx, {
      courseTypeId: type.id,
      name,
      capacity: type.defaultCapacity,
      ratio: type.studentsPerInstructor,
      status: "scheduled",
      notes: "Imported",
    });

    // 3) first session
    const startTime = /^\d{2}:\d{2}$/.test(raw.startTime) ? raw.startTime : "";
    const endTime = /^\d{2}:\d{2}$/.test(raw.endTime) ? raw.endTime : "";
    const startAt = toEpochMs(date, startTime || "09:00");
    const endAt = endTime ? toEpochMs(date, endTime) : startAt + 3 * 60 * 60 * 1000;
    await t.courseSession.insert(ctx, {
      courseId: course.id,
      date,
      slot: timeToSlot(startTime),
      startAt: new Date(startAt),
      endAt: new Date(endAt > startAt ? endAt : startAt + 3 * 60 * 60 * 1000),
    });

    // 4) optional location (find or create) + link
    const locName = (raw.location ?? "").trim();
    if (locName) {
      const lk = locName.toLowerCase();
      let loc = locByName.get(lk);
      if (!loc) {
        loc = await t.location.insert(ctx, { name: locName, locationTypeId: null, active: true });
        locByName.set(lk, loc);
      }
      await t.courseLocation.insert(ctx, { courseId: course.id, locationId: loc.id });
    }

    // 5) optional staff (only if the name matches an existing instructor)
    const staffName = (raw.staff ?? "").trim().toLowerCase();
    if (staffName && defaultRole) {
      const ins = instructorByName.get(staffName);
      if (ins) {
        await t.courseStaff.insert(ctx, { courseId: course.id, instructorId: ins.id, roleTypeId: defaultRole.id, status: "assigned" });
        await syncHoursForCourse(repos, ctx, course.id);
      }
    }

    created++;
  }

  await writeAudit(repos, ctx, { action: "import_courses", entity: "course", after: { created, skipped } });
  revalidatePath("/office/courses");
  revalidatePath("/office");
  return { ok: true, created, skipped, message: `Imported ${created} course${created === 1 ? "" : "s"}${skipped ? `, skipped ${skipped}` : ""}.` };
}
