import { eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { actorUserId } from "@/lib/tenant/context";
import {
  evaluateFit,
  hasConflict,
  type ComplianceRequirement,
  type HeldCompliance,
  type ResourceBooking,
} from "@/lib/domain";
import { courseStaff as courseStaffTable } from "@/lib/db/schema";
import { writeAudit } from "./audit";

export interface AssignInput {
  courseId: string;
  instructorId: string;
  roleTypeId: string;
  /** Admin override of a fit/conflict block — requires a note, recorded to audit. */
  override?: boolean;
  overrideNote?: string;
}

export type AssignResult =
  | { ok: true; courseStaffId: string; overridden: boolean }
  | { ok: false; reason: "not-fit" | "conflict" | "invalid"; detail: string };

function toMs(v: Date | number): number {
  return v instanceof Date ? v.getTime() : Number(v);
}

/**
 * Assign an instructor to a course, enforcing the compliance moat:
 *   1. FIT — instructor blocked if any mandatory check is missing/expired.
 *   2. CONFLICT — instructor already booked on an overlapping session.
 * Either block can be overridden by an admin WITH a note, which is recorded to
 * the audit log with the overriding user. Ratio/safety-cover is a course-level
 * flag surfaced elsewhere, not a hard block here.
 */
export async function assignStaff(
  repos: Repositories,
  ctx: AnyTenantContext,
  input: AssignInput,
): Promise<AssignResult> {
  const t = repos.tenant;

  const [course, thisCourseSessions] = await Promise.all([
    t.course.findById(ctx, input.courseId),
    t.courseSession.list(ctx),
  ]);
  if (!course) return { ok: false, reason: "invalid", detail: "Course not found" };

  const targetSessions = thisCourseSessions.filter((s) => s.courseId === input.courseId);
  if (targetSessions.length === 0) {
    return { ok: false, reason: "invalid", detail: "Course has no sessions yet" };
  }

  // --- 1. Fit check --------------------------------------------------------
  const [complianceTypes, complianceItems, settingsRows] = await Promise.all([
    t.complianceType.list(ctx),
    t.complianceItem.list(ctx),
    t.orgSettings.list(ctx),
  ]);
  const requirements: ComplianceRequirement[] = complianceTypes
    .filter((c) => c.active)
    .map((c) => ({ complianceTypeId: c.id, name: c.name, mandatory: c.mandatory, expiryTracked: c.expiryTracked }));
  const held: HeldCompliance[] = complianceItems
    .filter((c) => c.instructorId === input.instructorId)
    .map((c) => ({ complianceTypeId: c.complianceTypeId, expiryDate: c.expiryDate ?? null }));
  const fit = evaluateFit(requirements, held, Date.now(), settingsRows[0]?.alertLeadDays ?? 30);

  if (!fit.fit && !input.override) {
    return {
      ok: false,
      reason: "not-fit",
      detail: fit.blocks.map((b) => (b.kind === "missing" ? `${b.name} missing` : `${b.name} expired`)).join(", "),
    };
  }

  // --- 2. Conflict check ---------------------------------------------------
  const existingAssignments = await t.courseStaff.list(
    ctx,
    eq(courseStaffTable.instructorId, input.instructorId),
  );
  const otherCourseIds = new Set(existingAssignments.map((a) => a.courseId).filter((id) => id !== input.courseId));
  const existingBookings: ResourceBooking[] = thisCourseSessions
    .filter((s) => otherCourseIds.has(s.courseId))
    .map((s) => ({
      sessionId: s.id,
      resourceId: input.instructorId,
      startAt: toMs(s.startAt),
      endAt: toMs(s.endAt),
      courseId: s.courseId,
    }));

  const clashing = targetSessions.find((s) =>
    hasConflict(
      { sessionId: s.id, resourceId: input.instructorId, startAt: toMs(s.startAt), endAt: toMs(s.endAt) },
      existingBookings,
    ),
  );
  if (clashing && !input.override) {
    return { ok: false, reason: "conflict", detail: `Overlaps another booking on ${clashing.date} ${clashing.slot}` };
  }

  // --- 3. Persist ----------------------------------------------------------
  const overridden = Boolean(input.override && (!fit.fit || clashing));
  const row = await t.courseStaff.insert(ctx, {
    courseId: input.courseId,
    instructorId: input.instructorId,
    roleTypeId: input.roleTypeId,
    status: "assigned",
    isOverride: overridden,
    overrideNote: overridden ? input.overrideNote ?? null : null,
    overriddenBy: overridden ? actorUserId(ctx) : null,
  });

  await writeAudit(repos, ctx, {
    action: overridden ? "assign_staff_override" : "assign_staff",
    entity: "course_staff",
    entityId: row.id,
    after: { courseId: input.courseId, instructorId: input.instructorId, overridden, note: input.overrideNote },
  });

  return { ok: true, courseStaffId: row.id, overridden };
}
