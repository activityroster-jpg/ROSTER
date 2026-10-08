"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { getWeekSchedule, weekStart } from "@/lib/services/schedule";
import { getTeachingMatrix } from "@/lib/services/teaching";
import { assignStaff, assignBlockMessage } from "@/lib/services/assignment";
import { courseStaff as courseStaffTable } from "@/lib/db/schema";
import { BULK_AVAILABILITY_MAX, setAvailability, setAvailabilityBulk, type BulkAvailabilityEntry } from "@/lib/services/availability";
import { availabilityForStaffSchema, firstIssue, officeAvailabilitySchema } from "@/lib/validation/actions";
import { instructor as instructorTable } from "@/lib/db/schema";

export interface CellCandidate {
  courseId: string;
  courseName: string;
  time: string;
  needsCover: boolean;
  assigned: number;
  required: number;
}
export type CellResult =
  | { ok: true; candidates: CellCandidate[]; roles: { id: string; name: string }[] }
  | { ok: false; error: string };

const fmtT = (v: Date | number) =>
  new Date(v instanceof Date ? v.getTime() : Number(v)).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

/**
 * For a clicked availability cell (instructor × date × slot), list the sessions
 * that day/slot the instructor is eligible to teach and isn't already on — so an
 * admin can fill an open shift straight from the availability grid.
 */
export async function assignableForCellAction(date: string, slot: string, instructorId: string): Promise<CellResult> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !instructorId) return { ok: false, error: "Invalid cell" };

  const [sessions, courses, courseTypes, roles, teaching, existing, schedule] = await Promise.all([
    repos.tenant.courseSession.list(ctx),
    repos.tenant.course.list(ctx),
    repos.tenant.courseType.list(ctx),
    repos.tenant.roleType.list(ctx),
    getTeachingMatrix(repos, ctx),
    repos.tenant.courseStaff.list(ctx, eq(courseStaffTable.instructorId, instructorId)),
    getWeekSchedule(repos, ctx, weekStart(new Date(`${date}T00:00:00Z`))),
  ]);

  const teachable = new Set((teaching.get(instructorId) ?? []).map((c) => c.courseTypeId));
  const alreadyOn = new Set(existing.map((a) => a.courseId));
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const nameOf = (c: (typeof courses)[number]) => c.name ?? courseTypes.find((t) => t.id === c.courseTypeId)?.name ?? "Course";

  const candidates: CellCandidate[] = [];
  for (const s of sessions) {
    if (s.date !== date || s.slot !== slot) continue;
    const course = courseById.get(s.courseId);
    if (!course || alreadyOn.has(course.id) || !teachable.has(course.courseTypeId)) continue;
    const cov = schedule.coverageByCourse.get(course.id)?.ratio;
    candidates.push({
      courseId: course.id,
      courseName: nameOf(course),
      time: `${fmtT(s.startAt)}–${fmtT(s.endAt)}`,
      needsCover: cov ? !cov.ok : true,
      assigned: cov?.ratioCountingStaff ?? 0,
      required: cov?.requiredStaff ?? 0,
    });
  }
  // De-dupe by course (a course may have several sessions in the slot) and put gaps first.
  const seen = new Set<string>();
  const unique = candidates.filter((c) => (seen.has(c.courseId) ? false : (seen.add(c.courseId), true)));
  unique.sort((a, b) => Number(b.needsCover) - Number(a.needsCover) || a.courseName.localeCompare(b.courseName));

  const activeRoles = roles.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name }));
  return { ok: true, candidates: unique, roles: activeRoles };
}

/**
 * The office sets availability for a staff member (volunteers without the app, a
 * phone call). Audited as set by the office; the instructor sees it in their app.
 */
export async function setAvailabilityForStaffAction(input: { instructorId: string; date: string; slot: string; status: string | null }): Promise<{ ok: boolean; error?: string }> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  const parsed = availabilityForStaffSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "Invalid slot") };
  const who = await repos.tenant.instructor.findById(ctx, parsed.data.instructorId);
  if (!who) return { ok: false, error: "Instructor not found" };
  await setAvailability(repos, ctx, who.id, parsed.data.date, parsed.data.slot, parsed.data.status, { setBy: "office" });
  revalidatePath("/office/availability");
  revalidatePath("/office/courses");
  return { ok: true };
}

/** Assign an instructor to a course straight from the availability grid. */
export async function assignFromAvailabilityAction(courseId: string, instructorId: string, roleTypeId: string): Promise<{ ok: boolean; error?: string; message?: string }> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  if (!courseId || !roleTypeId) return { ok: false, error: "Pick a role" };
  const res = await assignStaff(repos, ctx, { courseId, instructorId, roleTypeId });
  if (!res.ok) {
    return { ok: false, error: `${assignBlockMessage(res.reason, res.detail)}${res.noOverride ? "." : ". Override from the course page if you need to."}` };
  }
  revalidatePath("/office/availability");
  revalidatePath("/office/courses");
  revalidatePath("/office");
  return { ok: true, message: res.warnings.length ? `Assigned — ⚠ ${res.warnings.join("; ")}` : "Assigned" };
}

/**
 * The office sets many slots in one go from the grid or a staff member's page:
 * a person's whole week, everyone on a day, a brush stroke, or usual weeks.
 * Saved as set by the office, in a handful of queries however many people.
 */
export async function setAvailabilityBulkAction(input: unknown): Promise<{ ok: boolean; error?: string; message?: string }> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  const parsed = officeAvailabilitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "Nothing to set") };
  const v = parsed.data;
  const entries: BulkAvailabilityEntry[] = [];
  for (const c of v.cells ?? []) entries.push({ instructorId: c.instructorId, date: c.date, slot: c.slot, status: v.status });
  if (v.everyone || v.instructorIds?.length) {
    const people = v.everyone
      ? (await repos.tenant.instructor.list(ctx, eq(instructorTable.status, "active"))).map((i) => i.id)
      : v.instructorIds!;
    const slots = v.slots ?? [];
    for (const id of people) {
      for (const date of v.dates ?? []) for (const slot of slots) entries.push({ instructorId: id, date, slot, status: v.status });
      for (const weekday of v.weekdays ?? []) for (const slot of slots) entries.push({ instructorId: id, weekday, slot, status: v.status });
    }
  }
  if (entries.length > BULK_AVAILABILITY_MAX) return { ok: false, error: "That's too many slots at once. Set one week at a time." };
  const r = await setAvailabilityBulk(repos, ctx, entries, { setBy: "office" });
  revalidatePath("/office/availability");
  revalidatePath("/office/courses");
  revalidatePath("/office/rota");
  revalidatePath("/office/staff");
  const changed = r.set + r.cleared;
  return { ok: true, message: `${changed} slot${changed === 1 ? "" : "s"} updated${r.keptLeave ? ` (${r.keptLeave} on approved leave left as they are)` : ""}` };
}
