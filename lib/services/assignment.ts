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
import { courseStaff as courseStaffTable, availability as availabilityTable } from "@/lib/db/schema";
import { writeAudit } from "./audit";
import { syncHoursForCourse } from "./hours";

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
  | { ok: false; reason: "not-fit" | "conflict" | "unavailable" | "invalid"; detail: string };

function toMs(v: Date | number): number {
  return v instanceof Date ? v.getTime() : Number(v);
}

/** Plain-English reason an assignment was refused. */
export function assignBlockMessage(reason: "not-fit" | "conflict" | "unavailable" | "invalid", detail: string): string {
  if (reason === "not-fit") return `Not cleared to roster: ${detail}`;
  if (reason === "conflict") return `Double-booked: ${detail}`;
  if (reason === "unavailable") return `${detail} in their availability`;
  return detail;
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

  // Staff can be rostered before a course's sessions are finalised; the conflict
  // check below simply has nothing to compare against until sessions exist.
  const targetSessions = thisCourseSessions.filter((s) => s.courseId === input.courseId);

  // --- 1. Fit check (only when the centre has opted into licence checks) ----
  const [complianceTypes, complianceItems, settingsRows] = await Promise.all([
    t.complianceType.list(ctx),
    t.complianceItem.list(ctx),
    t.orgSettings.list(ctx),
  ]);
  const settings = settingsRows[0];
  const licenceChecksOn = settings?.enforceLicenceChecks ?? false;
  const conflictChecksOn = settings?.enforceConflictChecks ?? false;

  const requirements: ComplianceRequirement[] = complianceTypes
    .filter((c) => c.active)
    .map((c) => ({ complianceTypeId: c.id, name: c.name, mandatory: c.mandatory, expiryTracked: c.expiryTracked }));
  const held: HeldCompliance[] = complianceItems
    .filter((c) => c.instructorId === input.instructorId)
    .map((c) => ({ complianceTypeId: c.complianceTypeId, expiryDate: c.expiryDate ?? null }));
  const fit = licenceChecksOn
    ? evaluateFit(requirements, held, Date.now(), settings?.alertLeadDays ?? 30)
    : { fit: true as const, blocks: [] };

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

  const clashing = conflictChecksOn
    ? targetSessions.find((s) =>
        hasConflict(
          { sessionId: s.id, resourceId: input.instructorId, startAt: toMs(s.startAt), endAt: toMs(s.endAt) },
          existingBookings,
        ),
      )
    : undefined;
  if (clashing && !input.override) {
    return { ok: false, reason: "conflict", detail: `Overlaps another booking on ${clashing.date} ${clashing.slot}` };
  }

  // --- 3. Availability: "Busy" blocks (on by default), override allowed ----
  const availabilityOn = settings?.enforceAvailabilityChecks ?? true;
  let busy: { date: string; slot: string } | undefined;
  if (availabilityOn && targetSessions.length) {
    const avail = await t.availability.list(ctx, eq(availabilityTable.instructorId, input.instructorId));
    const busyKeys = new Set(avail.filter((a) => a.status === "unavailable" && a.date).map((a) => `${a.date}|${a.slot}`));
    busy = targetSessions.find((s) => busyKeys.has(`${s.date}|${s.slot}`));
  }
  if (busy && !input.override) {
    return { ok: false, reason: "unavailable", detail: `Marked busy on ${busy.date} ${busy.slot}` };
  }

  // --- 4. Persist ----------------------------------------------------------
  const overridden = Boolean(input.override && (!fit.fit || clashing || busy));
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

  // Hours come from the roster: give every session of this course an hours record.
  await syncHoursForCourse(repos, ctx, input.courseId);

  return { ok: true, courseStaffId: row.id, overridden };
}

export interface BulkAssignInput {
  courseIds: string[];
  instructorId: string;
  roleTypeId: string;
  override?: boolean;
  overrideNote?: string;
}

export interface BulkAssignOutcome {
  courseId: string;
  status: "assigned" | "overridden" | "already" | "skipped";
  detail?: string;
}

export interface BulkAssignResult {
  assigned: number;
  overridden: number;
  already: number;
  skipped: number;
  outcomes: BulkAssignOutcome[];
}

/**
 * Assign one instructor (in one role) to several courses in a single pass.
 * Each course runs the same fit + conflict moat as {@link assignStaff}; a course
 * where the instructor already holds that role is reported as "already" and left
 * untouched (idempotent), and a blocked course without override is "skipped"
 * with the reason. Nothing is all-or-nothing — every course is attempted and the
 * per-course outcome is returned so the UI can show exactly what happened.
 */
export async function bulkAssignStaff(
  repos: Repositories,
  ctx: AnyTenantContext,
  input: BulkAssignInput,
): Promise<BulkAssignResult> {
  const t = repos.tenant;
  const courseIds = [...new Set(input.courseIds)].filter(Boolean);
  const existing = await t.courseStaff.list(ctx, eq(courseStaffTable.instructorId, input.instructorId));
  const alreadyInRole = new Set(
    existing.filter((a) => a.roleTypeId === input.roleTypeId).map((a) => a.courseId),
  );

  const outcomes: BulkAssignOutcome[] = [];
  let assigned = 0;
  let overridden = 0;
  let already = 0;
  let skipped = 0;

  for (const courseId of courseIds) {
    if (alreadyInRole.has(courseId)) {
      already++;
      outcomes.push({ courseId, status: "already" });
      continue;
    }
    const res = await assignStaff(repos, ctx, {
      courseId,
      instructorId: input.instructorId,
      roleTypeId: input.roleTypeId,
      override: input.override,
      overrideNote: input.overrideNote,
    });
    if (res.ok) {
      if (res.overridden) { overridden++; outcomes.push({ courseId, status: "overridden" }); }
      else { assigned++; outcomes.push({ courseId, status: "assigned" }); }
    } else {
      skipped++;
      outcomes.push({ courseId, status: "skipped", detail: res.detail });
    }
  }

  return { assigned, overridden, already, skipped, outcomes };
}
