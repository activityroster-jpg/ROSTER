import { and, eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { availability as availabilityTable, SLOT_CODES, type SlotCode } from "@/lib/db/schema";
import { addDays } from "./schedule";
import { writeAudit } from "./audit";

export type AvailabilityStatus = "available" | "tentative" | "unavailable";

/** Map of "date|slot" → status for a week, for one instructor. */
export async function getWeekAvailability(
  repos: Repositories,
  ctx: AnyTenantContext,
  instructorId: string,
  mondayIso: string,
): Promise<Record<string, AvailabilityStatus>> {
  const rows = await repos.tenant.availability.list(
    ctx,
    eq(availabilityTable.instructorId, instructorId),
  );
  const sunday = addDays(mondayIso, 7);
  const out: Record<string, AvailabilityStatus> = {};
  for (const r of rows) {
    if (!r.date || r.date < mondayIso || r.date >= sunday) continue;
    out[`${r.date}|${r.slot}`] = r.status as AvailabilityStatus;
  }
  return out;
}

/**
 * Set (or clear) an instructor's availability for a specific date + slot.
 * Passing `null` clears it. Idempotent upsert, tenant scoped, audited.
 */
export async function setAvailability(
  repos: Repositories,
  ctx: AnyTenantContext,
  instructorId: string,
  date: string,
  slot: SlotCode,
  status: AvailabilityStatus | null,
): Promise<void> {
  const existing = (
    await repos.tenant.availability.list(
      ctx,
      and(eq(availabilityTable.instructorId, instructorId), eq(availabilityTable.date, date), eq(availabilityTable.slot, slot))!,
    )
  )[0];

  if (status === null) {
    if (existing) await repos.tenant.availability.delete(ctx, existing.id);
  } else if (existing) {
    await repos.tenant.availability.update(ctx, existing.id, { status });
  } else {
    await repos.tenant.availability.insert(ctx, { instructorId, date, weekday: null, slot, status });
  }

  await writeAudit(repos, ctx, {
    action: "set_availability",
    entity: "availability",
    entityId: existing?.id ?? null,
    after: { instructorId, date, slot, status },
  });
}

export interface AvailabilityCell {
  status: AvailabilityStatus | null;
}
export interface AvailabilityMatrixRow {
  instructorId: string;
  name: string;
  cells: Record<string, AvailabilityStatus>; // key `${dateIso}|${slot}`
  /** Courses this instructor is rostered on, keyed `${dateIso}|${slot}`. */
  assigned: Record<string, string[]>;
}
export interface AvailabilityMatrix {
  days: string[]; // 7 ISO dates, Mon→Sun
  rows: AvailabilityMatrixRow[];
  /** Count of "available" instructors per `${dateIso}|${slot}`. */
  availableCounts: Record<string, number>;
}

/**
 * Org-wide availability for a week: every instructor × day × slot, plus a count
 * of how many are available in each slot. Tenant scoped. Read-only view for the
 * office to see who's around before rostering.
 */
export async function getWeekAvailabilityMatrix(
  repos: Repositories,
  ctx: AnyTenantContext,
  mondayIso: string,
): Promise<AvailabilityMatrix> {
  const [instructors, rows, sessions, staff, courses, courseTypes] = await Promise.all([
    repos.tenant.instructor.list(ctx),
    repos.tenant.availability.list(ctx),
    repos.tenant.courseSession.list(ctx),
    repos.tenant.courseStaff.list(ctx),
    repos.tenant.course.list(ctx),
    repos.tenant.courseType.list(ctx),
  ]);
  const sunday = addDays(mondayIso, 7);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) days.push(addDays(mondayIso, i));

  const byInstructor = new Map<string, Record<string, AvailabilityStatus>>();
  const availableCounts: Record<string, number> = {};
  for (const r of rows) {
    if (!r.date || r.date < mondayIso || r.date >= sunday) continue;
    const key = `${r.date}|${r.slot}`;
    const cells = byInstructor.get(r.instructorId) ?? {};
    cells[key] = r.status as AvailabilityStatus;
    byInstructor.set(r.instructorId, cells);
    if (r.status === "available") availableCounts[key] = (availableCounts[key] ?? 0) + 1;
  }

  // Assignments in this week: instructor → "date|slot" → course names.
  const courseName = new Map(courses.map((c) => [c.id, c.name ?? courseTypes.find((t) => t.id === c.courseTypeId)?.name ?? "Course"]));
  const instructorsByCourse = new Map<string, string[]>();
  for (const a of staff) instructorsByCourse.set(a.courseId, [...(instructorsByCourse.get(a.courseId) ?? []), a.instructorId]);
  const assignedByInstructor = new Map<string, Record<string, string[]>>();
  for (const s of sessions) {
    if (s.date < mondayIso || s.date >= sunday) continue;
    const key = `${s.date}|${s.slot}`;
    for (const insId of instructorsByCourse.get(s.courseId) ?? []) {
      const map = assignedByInstructor.get(insId) ?? {};
      map[key] = [...(map[key] ?? []), courseName.get(s.courseId) ?? "Course"];
      assignedByInstructor.set(insId, map);
    }
  }

  const active = instructors.filter((i) => i.status === "active").sort((a, b) => a.name.localeCompare(b.name));
  return {
    days,
    rows: active.map((i) => ({ instructorId: i.id, name: i.name, cells: byInstructor.get(i.id) ?? {}, assigned: assignedByInstructor.get(i.id) ?? {} })),
    availableCounts,
  };
}

export type CourseAvailState = "available" | "unavailable" | "partial" | "unset" | "none";

/**
 * For each course, each instructor's availability against that course's session
 * dates/slots: "available" (all covered & free), "unavailable" (said no to one),
 * "partial" (some free/tentative, some not set), "unset" (nothing submitted for
 * those dates), "none" (course has no sessions). Rostering is never blocked by
 * this — it just makes the picture clear.
 */
export async function getCourseAvailabilityStates(
  repos: Repositories,
  ctx: AnyTenantContext,
): Promise<Map<string, Map<string, CourseAvailState>>> {
  const [sessions, availRows, instructors] = await Promise.all([
    repos.tenant.courseSession.list(ctx),
    repos.tenant.availability.list(ctx),
    repos.tenant.instructor.list(ctx),
  ]);

  const availByInstructor = new Map<string, Record<string, AvailabilityStatus>>();
  for (const r of availRows) {
    if (!r.date) continue;
    const m = availByInstructor.get(r.instructorId) ?? {};
    m[`${r.date}|${r.slot}`] = r.status as AvailabilityStatus;
    availByInstructor.set(r.instructorId, m);
  }

  const slotsByCourse = new Map<string, string[]>();
  for (const s of sessions) slotsByCourse.set(s.courseId, [...(slotsByCourse.get(s.courseId) ?? []), `${s.date}|${s.slot}`]);

  const out = new Map<string, Map<string, CourseAvailState>>();
  for (const [courseId, keys] of slotsByCourse) {
    const perInstructor = new Map<string, CourseAvailState>();
    for (const ins of instructors) {
      const avail = availByInstructor.get(ins.id) ?? {};
      let anyUnavailable = false, anyFree = false, anySet = false, allCoveredFree = true;
      for (const k of keys) {
        const st = avail[k];
        if (st === undefined) { allCoveredFree = false; continue; }
        anySet = true;
        if (st === "unavailable") { anyUnavailable = true; allCoveredFree = false; }
        else { anyFree = true; if (st !== "available") allCoveredFree = false; }
      }
      let state: CourseAvailState;
      if (anyUnavailable) state = "unavailable";
      else if (!anySet) state = "unset";
      else if (allCoveredFree) state = "available";
      else if (anyFree) state = "partial";
      else state = "unset";
      perInstructor.set(ins.id, state);
    }
    out.set(courseId, perInstructor);
  }
  return out;
}

export const AVAILABILITY_SLOTS = SLOT_CODES;
