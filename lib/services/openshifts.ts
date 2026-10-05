import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { course as courseTable, courseSession as courseSessionTable, type OpenShift, type OpenShiftStatus } from "@/lib/db/schema";
import { writeAudit } from "./audit";
import { notifyInstructor } from "./notifications";
import { setDayStaff } from "./session-staff";
import { emailAdmins } from "./admin-mail";
import { escapeHtml } from "@/lib/mail";

export interface OpenShiftRow {
  id: string;
  courseSessionId: string;
  courseName: string;
  roleName: string;
  date: string;
  slot: string;
  status: OpenShiftStatus;
  claimedByName: string | null;
}

/** Broadcast an uncovered session role for staff to claim. Audited. */
export async function createOpenShift(
  repos: Repositories,
  ctx: AnyTenantContext,
  courseSessionId: string,
  roleTypeId: string,
  note?: string | null,
): Promise<OpenShift> {
  const row = await repos.tenant.openShift.insert(ctx, {
    courseSessionId,
    roleTypeId,
    status: "open",
    claimedByInstructorId: null,
    filledByInstructorId: null,
    note: note ?? null,
  });
  await writeAudit(repos, ctx, { action: "open_shift_create", entity: "open_shift", entityId: row.id, after: { courseSessionId, roleTypeId } });
  return row;
}

/** An instructor puts their hand up for an open shift (open → offered). First come, first served: a shift already offered to someone else can't be claimed. */
export async function claimOpenShift(
  repos: Repositories,
  ctx: AnyTenantContext,
  shiftId: string,
  instructorId: string,
): Promise<OpenShift | null> {
  const shift = await repos.tenant.openShift.findById(ctx, shiftId);
  if (!shift || shift.status !== "open") return null;
  const updated = await repos.tenant.openShift.update(ctx, shiftId, { status: "offered", claimedByInstructorId: instructorId });
  if (updated) {
    await writeAudit(repos, ctx, { action: "open_shift_claim", entity: "open_shift", entityId: shiftId, after: { instructorId } });
    const [who, session] = await Promise.all([repos.tenant.instructor.findById(ctx, instructorId), repos.tenant.courseSession.findById(ctx, shift.courseSessionId)]);
    const course = session ? await repos.tenant.course.findById(ctx, session.courseId) : null;
    await emailAdmins(repos, ctx, {
      subject: `${who?.name ?? "An instructor"} can cover ${course?.name ?? "an open shift"}${session ? ` on ${session.date}` : ""}`,
      html: `<p><strong>${escapeHtml(who?.name ?? "An instructor")}</strong> has put their hand up for the open shift${course ? ` on <strong>${escapeHtml(course.name ?? "")}</strong>` : ""}${session ? ` (${session.date} ${session.slot})` : ""}. Confirm them and they're rostered.</p>`,
      path: "/office/leave",
      cta: "Confirm the cover",
    });
  }
  return updated;
}

export type ConfirmShiftResult = { ok: true; shift: OpenShift } | { ok: false; reason: "nothing" | "blocked"; detail: string };

/**
 * Confirm an offered shift (offered → filled): assigns the claiming instructor
 * to the course with the requested role THROUGH the normal assignment checks
 * (certs, double-booking, availability — the same ones the Courses page runs),
 * then marks the shift filled. An admin can pass `override` with a note to
 * push through a blocked one. Tenant scoped, audited.
 */
export async function confirmOpenShift(
  repos: Repositories,
  ctx: AnyTenantContext,
  shiftId: string,
  opts: { override?: boolean; overrideNote?: string } = {},
): Promise<ConfirmShiftResult> {
  const shift = await repos.tenant.openShift.findById(ctx, shiftId);
  if (!shift || !shift.claimedByInstructorId || shift.status !== "offered") return { ok: false, reason: "nothing", detail: "Nothing to confirm" };

  const session = await repos.tenant.courseSession.findById(ctx, shift.courseSessionId);
  if (!session) return { ok: false, reason: "nothing", detail: "Session no longer exists" };

  // An open shift is one session: the cover goes on that day only (audit A3-3), through the day's own checks.
  const assigned = await setDayStaff(repos, ctx, {
    sessionId: session.id,
    instructorId: shift.claimedByInstructorId,
    roleTypeId: shift.roleTypeId,
    mode: "add",
    override: opts.override,
    note: opts.overrideNote ?? "Open shift",
  });
  if (!assigned.ok) return { ok: false, reason: "blocked", detail: assigned.error };

  const updated = await repos.tenant.openShift.update(ctx, shiftId, {
    status: "filled",
    filledByInstructorId: shift.claimedByInstructorId,
  });
  if (updated) {
    await writeAudit(repos, ctx, { action: "open_shift_confirm", entity: "open_shift", entityId: shiftId, after: { filledBy: shift.claimedByInstructorId, courseId: session.courseId } });
    const course = await repos.tenant.course.findById(ctx, session.courseId);
    await notifyInstructor(repos, ctx, shift.claimedByInstructorId, {
      title: "Shift confirmed",
      body: `You're confirmed for ${course?.name ?? "a session"} on ${session.date} (${session.slot}).`,
      email: true,
    });
  }
  return updated ? { ok: true, shift: updated } : { ok: false, reason: "nothing", detail: "Nothing to confirm" };
}

/** Cancel an open shift (soft — status only). */
export async function cancelOpenShift(repos: Repositories, ctx: AnyTenantContext, shiftId: string): Promise<OpenShift | null> {
  const updated = await repos.tenant.openShift.update(ctx, shiftId, { status: "cancelled" });
  if (updated) await writeAudit(repos, ctx, { action: "open_shift_cancel", entity: "open_shift", entityId: shiftId });
  return updated;
}

/** Open shifts with human labels. `onlyClaimable` hides filled/cancelled ones. */
export async function listOpenShifts(
  repos: Repositories,
  ctx: AnyTenantContext,
  onlyClaimable = false,
): Promise<OpenShiftRow[]> {
  const shifts = await repos.tenant.openShift.list(ctx);
  // Only the sessions and courses these shifts are about.
  const sessions = await repos.tenant.courseSession.listIn(ctx, courseSessionTable.id, shifts.map((s) => s.courseSessionId));
  const [courses, roles, instructors] = await Promise.all([
    repos.tenant.course.listIn(ctx, courseTable.id, sessions.map((s) => s.courseId)),
    repos.tenant.roleType.list(ctx),
    repos.tenant.instructor.list(ctx),
  ]);
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const courseName = new Map(courses.map((c) => [c.id, c.name ?? "Session"]));
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  const instrName = new Map(instructors.map((i) => [i.id, i.name]));

  return shifts
    .filter((s) => (onlyClaimable ? s.status === "open" || s.status === "offered" : true))
    .map((s) => {
      const session = sessionById.get(s.courseSessionId);
      return {
        id: s.id,
        courseSessionId: s.courseSessionId,
        courseName: session ? courseName.get(session.courseId) ?? "Session" : "Session",
        roleName: roleName.get(s.roleTypeId) ?? "Role",
        date: session?.date ?? "",
        slot: session?.slot ?? "",
        status: s.status,
        claimedByName: s.claimedByInstructorId ? instrName.get(s.claimedByInstructorId) ?? null : null,
      };
    });
}
