import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import type { OpenShift, OpenShiftStatus } from "@/lib/db/schema";
import { writeAudit } from "./audit";
import { notifyInstructor } from "./notifications";

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

/** An instructor puts their hand up for an open shift (open → offered). */
export async function claimOpenShift(
  repos: Repositories,
  ctx: AnyTenantContext,
  shiftId: string,
  instructorId: string,
): Promise<OpenShift | null> {
  const shift = await repos.tenant.openShift.findById(ctx, shiftId);
  if (!shift || shift.status === "filled" || shift.status === "cancelled") return null;
  const updated = await repos.tenant.openShift.update(ctx, shiftId, { status: "offered", claimedByInstructorId: instructorId });
  if (updated) await writeAudit(repos, ctx, { action: "open_shift_claim", entity: "open_shift", entityId: shiftId, after: { instructorId } });
  return updated;
}

/**
 * Confirm an offered shift (offered → filled): marks it filled AND assigns the
 * claiming instructor to the course with the requested role. Tenant scoped,
 * audited. Returns null if there is nothing to confirm.
 */
export async function confirmOpenShift(
  repos: Repositories,
  ctx: AnyTenantContext,
  shiftId: string,
): Promise<OpenShift | null> {
  const shift = await repos.tenant.openShift.findById(ctx, shiftId);
  if (!shift || !shift.claimedByInstructorId || shift.status !== "offered") return null;

  const session = await repos.tenant.courseSession.findById(ctx, shift.courseSessionId);
  if (!session) return null;

  await repos.tenant.courseStaff.insert(ctx, {
    courseId: session.courseId,
    instructorId: shift.claimedByInstructorId,
    roleTypeId: shift.roleTypeId,
    status: "confirmed",
  });

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
  return updated;
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
  const [shifts, sessions, courses, roles, instructors] = await Promise.all([
    repos.tenant.openShift.list(ctx),
    repos.tenant.courseSession.list(ctx),
    repos.tenant.course.list(ctx),
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
