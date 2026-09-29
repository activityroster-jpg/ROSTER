"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { createCourseWithSessions, type NewCourseSession } from "@/lib/services/courses";
import { addDays } from "@/lib/services/schedule";
import { assignStaff } from "@/lib/services/assignment";
import { writeAudit } from "@/lib/services/audit";
import { COURSE_STATUSES, SLOT_CODES, type CourseStatus, type SlotCode } from "@/lib/db/schema";
import { normaliseTime, timeToSlot } from "@/lib/import/parse";

export type ActionState = { ok: boolean; error?: string; message?: string };

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
  revalidatePath(`/office/courses/${courseId}`);
  revalidatePath("/office/courses");
  revalidatePath("/office");
  return { ok: true, message: "Session removed" };
}

/** Remove a staff assignment from a course. */
export async function removeStaffAction(courseId: string, assignmentId: string): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const removed = await repos.tenant.courseStaff.delete(ctx, assignmentId);
  if (removed === 0) return { ok: false, error: "Assignment not found" };
  await writeAudit(repos, ctx, { action: "remove_staff", entity: "course", entityId: courseId, after: { assignmentId } });
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
    return { ok: false, error: `${res.reason === "not-fit" ? "Not fit to roster" : res.reason === "conflict" ? "Scheduling conflict" : "Invalid"}: ${res.detail}` };
  }
  revalidatePath("/office/courses");
  revalidatePath("/office");
  return { ok: true, message: res.overridden ? "Assigned with override (recorded)" : "Assigned" };
}
