"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { weekStart } from "@/lib/services/schedule";
import { getBoard } from "@/lib/services/board";
import { getTeachingMatrix } from "@/lib/services/teaching";
import { assignStaff, assignBlockMessage } from "@/lib/services/assignment";
import { courseSession as courseSessionTable, courseStaff as courseStaffTable } from "@/lib/db/schema";
import { clearDayStaff, setDayStaff } from "@/lib/services/session-staff";
import { writeAudit } from "@/lib/services/audit";
import { syncHoursForCourse } from "@/lib/services/hours";
import { notifyRosterChange } from "@/lib/services/assignment";
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
  /** The roles this course needs (its role lines, or what the ratio implies) and how many places are still open in each. */
  roles: { id: string; name: string; missing: number }[];
}
/** A session in this slot the person is already on. */
export interface CurrentSession { sessionId: string; courseId: string; courseName: string; time: string; multiDay: boolean; dayOnly: boolean }
export type CellResult =
  | { ok: true; candidates: CellCandidate[]; roles: { id: string; name: string }[]; current: CurrentSession[] }
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

  // One source of truth: the same week data the roster board shows (who is on each
  // session that day, day adds included, and which places are still open), so the
  // availability sheet can never disagree with the rota.
  const [board, roles, teaching] = await Promise.all([
    getBoard(repos, ctx, weekStart(new Date(`${date}T00:00:00Z`))),
    repos.tenant.roleType.list(ctx),
    getTeachingMatrix(repos, ctx),
  ]);
  const activeRoles = roles.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name }));
  const teachable = new Set((teaching.get(instructorId) ?? []).map((c) => c.courseTypeId));
  const day = board.days.find((d) => d.date === date);
  const inSlot = (day?.sessions ?? []).filter((s) => s.slot === slot && s.status !== "cancelled");
  const onIt = (s: (typeof inSlot)[number]) => s.staff.some((m) => m.instructorId === instructorId && m.status !== "declined");

  // What they're already on in this slot (course-level or a day-only add).
  const current: CurrentSession[] = inSlot.filter(onIt).map((s) => {
    const me = s.staff.find((m) => m.instructorId === instructorId)!;
    return { sessionId: s.sessionId, courseId: s.courseId, courseName: s.courseName, time: `${fmtT(s.startAt)}–${fmtT(s.endAt)}`, multiDay: Boolean(board.sessionMeta[s.sessionId]?.multiDay), dayOnly: Boolean(me.dayOnly) };
  });

  const candidates: CellCandidate[] = [];
  for (const s of inSlot) {
    const meta = board.sessionMeta[s.sessionId];
    if (!meta || onIt(s) || !teachable.has(meta.courseTypeId)) continue;
    const open = board.openRoles[s.sessionId] ?? [];
    const assigned = s.staff.filter((m) => m.status !== "declined").length;
    const required = meta.needs.reduce((n, x) => n + x.count, 0);
    // Only the roles this session needs, open places first; a course with no roles set offers every active role.
    const rolesOut = meta.needs.length
      ? meta.needs.map((n) => ({ id: n.roleTypeId, name: n.roleName, missing: open.find((o) => o.roleTypeId === n.roleTypeId)?.missing ?? 0 })).sort((a, b) => Number(b.missing > 0) - Number(a.missing > 0))
      : activeRoles.map((r) => ({ ...r, missing: 0 }));
    candidates.push({ courseId: s.courseId, courseName: s.courseName, time: `${fmtT(s.startAt)}–${fmtT(s.endAt)}`, needsCover: open.length > 0, assigned, required, roles: rolesOut });
  }
  // De-dupe by course (a course may have several sessions in the slot) and put gaps first.
  const seen = new Set<string>();
  const unique = candidates.filter((c) => (seen.has(c.courseId) ? false : (seen.add(c.courseId), true)));
  unique.sort((a, b) => Number(b.needsCover) - Number(a.needsCover) || a.courseName.localeCompare(b.courseName));

  return { ok: true, candidates: unique, roles: activeRoles, current };
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
    return { ok: false, error: `${assignBlockMessage(res.reason, res.detail)}${res.noOverride ? "." : ". Assign them from the roster or the course page with “Assign anyway” if you need to."}` };
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

/**
 * Move someone from the session they're on in this slot to another course:
 * off the old one (that day only when the old course runs several days, the
 * whole course when it's a one-off), then onto the new one (that day only
 * when the new course runs several days). Each step is checked and audited
 * as usual; if the second step is refused, the first is reported plainly.
 */
export async function moveFromAvailabilityAction(input: { fromSessionId: string; toCourseId: string; instructorId: string; roleTypeId: string }): Promise<{ ok: boolean; error?: string; message?: string }> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  const t = repos.tenant;
  if (!input.fromSessionId || !input.toCourseId || !input.instructorId || !input.roleTypeId) return { ok: false, error: "Pick a role" };
  const from = await t.courseSession.findById(ctx, input.fromSessionId);
  if (!from) return { ok: false, error: "That session no longer exists" };
  const [fromCourse, fromSessions, mine, toSessions] = await Promise.all([
    t.course.findById(ctx, from.courseId),
    t.courseSession.list(ctx, eq(courseSessionTable.courseId, from.courseId)),
    t.courseStaff.list(ctx, eq(courseStaffTable.instructorId, input.instructorId)),
    t.courseSession.list(ctx, eq(courseSessionTable.courseId, input.toCourseId)),
  ]);
  const fromLive = fromSessions.filter((s) => !s.cancelledAt);
  const assignment = mine.find((a) => a.courseId === from.courseId);
  const fromName = fromCourse?.name ?? "the old course";

  // 1. Off the old one.
  if (!assignment) {
    const r = await clearDayStaff(repos, ctx, from.id, input.instructorId);
    if (!r.ok) return { ok: false, error: r.error ?? "Couldn't take them off" };
  } else if (fromLive.length > 1) {
    const r = await setDayStaff(repos, ctx, { sessionId: from.id, instructorId: input.instructorId, roleTypeId: assignment.roleTypeId, mode: "skip" });
    if (!r.ok) return { ok: false, error: r.error };
  } else {
    await t.courseStaff.delete(ctx, assignment.id);
    await writeAudit(repos, ctx, { action: "remove_staff", entity: "course", entityId: from.courseId, after: { assignmentId: assignment.id, from: "availability-move", to: input.toCourseId } });
    await syncHoursForCourse(repos, ctx, from.courseId);
    await notifyRosterChange(repos, ctx, input.instructorId, fromName, fromLive.map((s) => s.date), "removed");
  }

  // 2. Onto the new one.
  const toLive = toSessions.filter((s) => !s.cancelledAt);
  const here = toLive.find((s) => s.date === from.date && s.slot === from.slot);
  const put = toLive.length > 1 && here
    ? await setDayStaff(repos, ctx, { sessionId: here.id, instructorId: input.instructorId, roleTypeId: input.roleTypeId, mode: "add" })
    : await assignStaff(repos, ctx, { courseId: input.toCourseId, instructorId: input.instructorId, roleTypeId: input.roleTypeId });
  revalidatePath("/office/availability");
  revalidatePath("/office/courses");
  revalidatePath("/office/rota");
  revalidatePath("/office");
  if (!put.ok) {
    const why = "error" in put ? put.error : assignBlockMessage(put.reason, put.detail);
    return { ok: false, error: `Taken off ${fromName}, but not put on the new course: ${why}. Assign them from the roster or the course page (“Assign anyway” if needed).` };
  }
  const scope = fromLive.length > 1 ? "that day" : "the whole course";
  return { ok: true, message: `Moved: off ${fromName} (${scope}) and onto the new course${"warnings" in put && put.warnings.length ? ` — ⚠ ${put.warnings.join("; ")}` : ""}` };
}
