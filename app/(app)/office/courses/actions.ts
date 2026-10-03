"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { createCourseWithSessions, type NewCourseSession } from "@/lib/services/courses";
import { addDays } from "@/lib/services/schedule";
import { assignStaff, bulkAssignStaff } from "@/lib/services/assignment";
import { writeAudit } from "@/lib/services/audit";
import { COURSE_STATUSES, SLOT_CODES, type CourseStatus, type SlotCode } from "@/lib/db/schema";
import { normaliseTime, timeToSlot } from "@/lib/import/parse";
import { getCourseEditorData, type CourseEditorData } from "@/lib/services/course-editor";
import { createCourseTypeResolver, TYPE_NEW, TYPE_ONEOFF } from "@/lib/services/course-type-resolve";
import { syncHoursForCourse } from "@/lib/services/hours";
import { assignBlockMessage, notifyRosterChange } from "@/lib/services/assignment";
import { eq } from "drizzle-orm";
import { courseSession as courseSessionTable, courseStaff as courseStaffTable } from "@/lib/db/schema";

export type ActionState = { ok: boolean; error?: string; message?: string };

/** Load the editable course box for a calendar tile. Admin, tenant scoped. */
export async function loadCourseEditorAction(courseId: string): Promise<{ ok: true; data: CourseEditorData } | { ok: false; error: string }> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  if (typeof courseId !== "string" || !courseId) return { ok: false, error: "Missing course" };
  const data = await getCourseEditorData(repos, ctx, courseId);
  if (!data) return { ok: false, error: "Course not found" };
  return { ok: true, data };
}

function isSlot(v: unknown): v is SlotCode {
  return typeof v === "string" && (SLOT_CODES as readonly string[]).includes(v);
}

/** Build a session template from the form (slot mode or set-times mode). */
function sessionTemplate(formData: FormData): { ok: true; t: Omit<NewCourseSession, "date"> } | { ok: false; error: string } {
  const rawStart = normaliseTime(String(formData.get("startTime") ?? ""));
  const rawEnd = normaliseTime(String(formData.get("endTime") ?? ""));
  const slotField = formData.get("slot");
  if (rawStart) {
    if (rawEnd && rawEnd <= rawStart) return { ok: false, error: "End time must be after start time" };
    return { ok: true, t: { slot: timeToSlot(rawStart), startTime: rawStart, endTime: rawEnd || undefined } };
  }
  if (isSlot(slotField)) return { ok: true, t: { slot: slotField } };
  return { ok: false, error: "Set a start time, or pick a slot" };
}

/** Create a course with a first session (more sessions can be added later). The
 * form works two ways: an AM/PM/EV slot, or explicit start/end times (centres on
 * the "set times" style). With times, the slot code is derived for storage. */
export async function createCourseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const courseTypeId = String(formData.get("courseTypeId") ?? "");
  const name = (formData.get("name") as string) || undefined;
  const date = String(formData.get("date") ?? "");
  if (!courseTypeId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Pick a course type and date" };
  }

  const tpl = sessionTemplate(formData);
  if (!tpl.ok) return { ok: false, error: tpl.error };

  // Recurrence: repeat "none" | "daily" | "weekly" for `count` occurrences.
  const repeat = String(formData.get("repeat") ?? "none");
  const count = Math.max(1, Math.min(52, Number(formData.get("count") ?? 1) || 1));
  const step = repeat === "daily" ? 1 : repeat === "weekly" ? 7 : 0;
  const sessions: NewCourseSession[] = [];
  for (let i = 0; i < (step === 0 ? 1 : count); i++) {
    sessions.push({ ...tpl.t, date: step === 0 ? date : addDays(date, i * step) });
  }

  try {
    await createCourseWithSessions(repos, ctx, { courseTypeId, name, sessions });
    revalidatePath("/office/courses");
    revalidatePath("/office");
    return { ok: true, message: `Course created with ${sessions.length} session${sessions.length === 1 ? "" : "s"}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export interface FlexSession { date: string; startTime?: string; endTime?: string; slot?: string }

const idList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 64).slice(0, 100) : [];

/** Create a course with an arbitrary set of sessions (any days/times) and a name,
 * plus the staff it needs by role, its locations and its equipment. */
export async function createCourseFlexibleAction(input: {
  courseTypeId: string;
  name?: string;
  sessions: FlexSession[];
  roles?: { roleTypeId: string; count: number }[];
  locationIds?: string[];
  equipmentIds?: string[];
  /** A manually-typed course type instead of courseTypeId; optionally added to the regular list. */
  newType?: { name: string; addToList: boolean };
}): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const newTypeName = typeof input.newType?.name === "string" ? input.newType.name.trim().slice(0, 120) : "";
  if (!input.courseTypeId && !newTypeName) return { ok: false, error: "Pick a course type, or type one in" };
  const rawSessions = Array.isArray(input.sessions) ? input.sessions : [];
  const sessions: NewCourseSession[] = [];
  for (const s of rawSessions) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date ?? "")) continue;
    const start = normaliseTime(s.startTime ?? "");
    const end = normaliseTime(s.endTime ?? "");
    if (start && end && end <= start) return { ok: false, error: `End must be after start on ${s.date}` };
    const slot: SlotCode = start ? timeToSlot(start) : isSlot(s.slot) ? s.slot : "AM";
    sessions.push({ date: s.date, slot, startTime: start || undefined, endTime: end || undefined });
  }
  if (sessions.length === 0) return { ok: false, error: "Add at least one session with a valid date" };

  // Validate shapes only — ownership is checked in the service via tenant-scoped lookups.
  const roleRequirements = (Array.isArray(input.roles) ? input.roles : [])
    .filter((r) => r && typeof r.roleTypeId === "string" && r.roleTypeId.length > 0 && r.roleTypeId.length <= 64)
    .map((r) => ({ roleTypeId: r.roleTypeId, count: Number(r.count) }))
    .filter((r) => Number.isFinite(r.count) && r.count >= 1 && r.count <= 50)
    .slice(0, 20);

  try {
    let courseTypeId = input.courseTypeId;
    if (newTypeName) {
      const resolver = await createCourseTypeResolver(repos, ctx);
      const type = await resolver.resolve(newTypeName, "all", input.newType?.addToList === true ? TYPE_NEW : TYPE_ONEOFF);
      courseTypeId = type.id;
    }
    await createCourseWithSessions(repos, ctx, {
      courseTypeId,
      name: input.name?.trim() || undefined,
      sessions,
      roleRequirements,
      locationIds: idList(input.locationIds),
      equipmentIds: idList(input.equipmentIds),
    });
    revalidatePath("/office/courses");
    revalidatePath("/office");
    return { ok: true, message: `Course created with ${sessions.length} session${sessions.length === 1 ? "" : "s"}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Change a course's status (draft/scheduled/confirmed/completed/cancelled). */
export async function setCourseStatusAction(courseId: string, status: string): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  if (!(COURSE_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Invalid status" };
  const updated = await repos.tenant.course.update(ctx, courseId, { status: status as CourseStatus });
  if (!updated) return { ok: false, error: "Course not found" };
  await writeAudit(repos, ctx, { action: "update_status", entity: "course", entityId: courseId, after: { status } });
  revalidatePath("/office/courses");
  revalidatePath(`/office/courses/${courseId}`);
  revalidatePath("/office");
  return { ok: true, message: `Course ${status}` };
}

/** Rename a course. */
export async function renameCourseAction(courseId: string, name: string): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const clean = name.trim();
  const updated = await repos.tenant.course.update(ctx, courseId, { name: clean || null });
  if (!updated) return { ok: false, error: "Course not found" };
  await writeAudit(repos, ctx, { action: "rename", entity: "course", entityId: courseId, after: { name: clean || null } });
  revalidatePath(`/office/courses/${courseId}`);
  revalidatePath("/office/courses");
  return { ok: true, message: "Renamed" };
}

/** Delete a course (cascades to its sessions, staff, equipment & locations). */
export async function deleteCourseAction(courseId: string): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const removed = await repos.tenant.course.delete(ctx, courseId);
  if (removed === 0) return { ok: false, error: "Course not found" };
  await writeAudit(repos, ctx, { action: "delete", entity: "course", entityId: courseId });
  revalidatePath("/office/courses");
  revalidatePath("/office");
  return { ok: true, message: "Course deleted" };
}

/** Set how many students are booked on a course (drives the ratio check). */
export async function setCourseStudentsAction(courseId: string, students: number): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  if (!Number.isFinite(students) || students < 1) return { ok: false, error: "Enter how many students (at least 1)" };
  const n = Math.min(500, Math.round(students));
  const updated = await repos.tenant.course.update(ctx, courseId, { capacity: n });
  if (!updated) return { ok: false, error: "Course not found" };
  await writeAudit(repos, ctx, { action: "set_students", entity: "course", entityId: courseId, after: { capacity: n } });
  revalidatePath("/office/courses");
  revalidatePath(`/office/courses/${courseId}`);
  revalidatePath("/office");
  return { ok: true, message: "Saved" };
}

/** Set how many staff a course needs (0/blank clears back to the ratio default). */
export async function setStaffRequiredAction(courseId: string, count: number | null): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const n = count == null || !Number.isFinite(count) || count < 0 ? null : Math.min(50, Math.round(count));
  const updated = await repos.tenant.course.update(ctx, courseId, { staffRequired: n });
  if (!updated) return { ok: false, error: "Course not found" };
  await writeAudit(repos, ctx, { action: "set_staff_required", entity: "course", entityId: courseId, after: { staffRequired: n } });
  revalidatePath("/office/courses");
  revalidatePath(`/office/courses/${courseId}`);
  revalidatePath("/office");
  return { ok: true, message: "Saved" };
}

/** Edit a single session's date and time inline from the course card. */
export async function updateSessionTimesAction(
  courseId: string,
  sessionId: string,
  input: { date: string; startTime?: string; endTime?: string },
): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const date = String(input.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Pick a valid date" };
  const start = normaliseTime(input.startTime ?? "");
  const end = normaliseTime(input.endTime ?? "");
  if (start && end && end <= start) return { ok: false, error: "End must be after start" };

  const slots = await repos.tenant.sessionSlot.list(ctx);
  const slot = start ? timeToSlot(start) : "AM";
  const cfg = slots.find((s) => s.code === slot);
  const startTime = start || cfg?.startTime || "09:00";
  const endTime = end || cfg?.endTime || "12:00";
  const at = (time: string) => new Date(Date.parse(`${date}T${time}:00.000Z`));

  const before = await repos.tenant.courseSession.findById(ctx, sessionId);
  const updated = await repos.tenant.courseSession.update(ctx, sessionId, {
    date, slot, startAt: at(startTime), endAt: at(endTime),
  });
  if (!updated) return { ok: false, error: "Session not found" };
  await writeAudit(repos, ctx, { action: "update_session", entity: "course", entityId: courseId, after: { sessionId, date, startTime, endTime } });
  await syncHoursForCourse(repos, ctx, courseId);
  // Everyone on the course hears when a published session moves.
  const course = await repos.tenant.course.findById(ctx, courseId);
  const assigned = await repos.tenant.courseStaff.list(ctx, eq(courseStaffTable.courseId, courseId));
  for (const a of assigned) await notifyRosterChange(repos, ctx, a.instructorId, course?.name ?? "a course", [date, ...(before?.date ? [before.date] : [])], "moved");
  revalidatePath("/office/courses");
  revalidatePath(`/office/courses/${courseId}`);
  revalidatePath("/office");
  return { ok: true, message: "Session updated" };
}

/** Add one session to an existing course. */
export async function addSessionAction(courseId: string, formData: FormData): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const date = String(formData.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Pick a valid date" };
  const course = await repos.tenant.course.findById(ctx, courseId);
  if (!course) return { ok: false, error: "Course not found" };
  const tpl = sessionTemplate(formData);
  if (!tpl.ok) return { ok: false, error: tpl.error };

  const slots = await repos.tenant.sessionSlot.list(ctx);
  const cfg = slots.find((s) => s.code === tpl.t.slot);
  const startTime = tpl.t.startTime ?? cfg?.startTime ?? "09:00";
  const endTime = tpl.t.endTime ?? cfg?.endTime ?? "12:00";
  const at = (time: string) => new Date(Date.parse(`${date}T${time}:00.000Z`));
  await repos.tenant.courseSession.insert(ctx, { courseId, date, slot: tpl.t.slot, startAt: at(startTime), endAt: at(endTime) });
  await writeAudit(repos, ctx, { action: "add_session", entity: "course", entityId: courseId, after: { date, slot: tpl.t.slot } });
  await syncHoursForCourse(repos, ctx, courseId);
  revalidatePath(`/office/courses/${courseId}`);
  revalidatePath("/office/courses");
  revalidatePath("/office");
  return { ok: true, message: "Session added" };
}

/** Remove one session from a course (scoped to the tenant). */
export async function removeSessionAction(courseId: string, sessionId: string): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const removed = await repos.tenant.courseSession.delete(ctx, sessionId);
  if (removed === 0) return { ok: false, error: "Session not found" };
  await writeAudit(repos, ctx, { action: "remove_session", entity: "course", entityId: courseId, after: { sessionId } });
  await syncHoursForCourse(repos, ctx, courseId);
  revalidatePath(`/office/courses/${courseId}`);
  revalidatePath("/office/courses");
  revalidatePath("/office");
  return { ok: true, message: "Session removed" };
}

/** Remove a staff assignment from a course. */
export async function removeStaffAction(courseId: string, assignmentId: string): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const assignment = await repos.tenant.courseStaff.findById(ctx, assignmentId);
  const removed = await repos.tenant.courseStaff.delete(ctx, assignmentId);
  if (removed === 0) return { ok: false, error: "Assignment not found" };
  await writeAudit(repos, ctx, { action: "remove_staff", entity: "course", entityId: courseId, after: { assignmentId } });
  await syncHoursForCourse(repos, ctx, courseId);
  if (assignment) {
    const [course, sessions] = await Promise.all([repos.tenant.course.findById(ctx, courseId), repos.tenant.courseSession.list(ctx, eq(courseSessionTable.courseId, courseId))]);
    await notifyRosterChange(repos, ctx, assignment.instructorId, course?.name ?? "a course", sessions.map((s) => s.date), "removed");
  }
  revalidatePath(`/office/courses/${courseId}`);
  revalidatePath("/office/courses");
  revalidatePath("/office");
  return { ok: true, message: "Removed" };
}

/** Assign an instructor to a course, enforcing fit + conflict (override allowed). */
export async function assignStaffAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const res = await assignStaff(repos, ctx, {
    courseId: String(formData.get("courseId") ?? ""),
    instructorId: String(formData.get("instructorId") ?? ""),
    roleTypeId: String(formData.get("roleTypeId") ?? ""),
    override: formData.get("override") === "on",
    overrideNote: (formData.get("overrideNote") as string) || undefined,
  });

  if (!res.ok) {
    return { ok: false, error: `${assignBlockMessage(res.reason, res.detail)}. Tick “override” to assign anyway.` };
  }
  revalidatePath("/office/courses");
  revalidatePath("/office");
  return { ok: true, message: res.overridden ? "Assigned with override (recorded)" : "Assigned" };
}

/** Assign one instructor (in one role) to several courses at once. */
export async function bulkAssignStaffAction(input: {
  courseIds: string[];
  instructorId: string;
  roleTypeId: string;
  override?: boolean;
  overrideNote?: string;
}): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  if (!input.instructorId || !input.roleTypeId) return { ok: false, error: "Pick an instructor and a role" };
  const courseIds = [...new Set(input.courseIds ?? [])].filter(Boolean);
  if (courseIds.length === 0) return { ok: false, error: "Tick at least one course" };
  if (input.override && !(input.overrideNote ?? "").trim()) return { ok: false, error: "Add a reason to override the checks" };

  const res = await bulkAssignStaff(repos, ctx, {
    courseIds,
    instructorId: input.instructorId,
    roleTypeId: input.roleTypeId,
    override: input.override,
    overrideNote: input.overrideNote?.trim() || undefined,
  });

  revalidatePath("/office/courses");
  revalidatePath("/office");

  const done = res.assigned + res.overridden;
  const parts: string[] = [];
  if (done) parts.push(`${done} assigned${res.overridden ? ` (${res.overridden} with override)` : ""}`);
  if (res.already) parts.push(`${res.already} already on`);
  if (res.skipped) parts.push(`${res.skipped} skipped`);
  const message = parts.join(" · ") || "Nothing to do";

  // A run that assigned nobody and skipped some is a soft failure worth flagging.
  if (done === 0 && res.skipped > 0) {
    const reasons = [...new Set(res.outcomes.filter((o) => o.status === "skipped" && o.detail).map((o) => o.detail!))];
    return { ok: false, error: `None assigned — ${reasons.join("; ") || "checks not met"}. Tick “assign anyway” to override.` };
  }
  return { ok: true, message };
}
