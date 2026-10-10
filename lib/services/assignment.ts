import { runAtomic } from "@/lib/db/batch";
import { and, eq, gte, lte } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { actorUserId } from "@/lib/tenant/context";
import {
  evaluateFit,
  hasConflict,
  clashModeFor,
  timeOverlapsOnly,
  type ComplianceRequirement,
  type HeldCompliance,
  type ResourceBooking,
} from "@/lib/domain";
import { complianceItem as complianceItemTable, courseSession as courseSessionTable, courseStaff as courseStaffTable } from "@/lib/db/schema";
import { availabilityHorizon, loadInstructorAvailability } from "./availability";
import { blocksRostering, describeBusy, effectiveAvailability, managedByOffice } from "@/lib/domain/availability";
import { auditStatement } from "./audit";
import { planHoursForCourse } from "./hours";
import { notifyInstructor } from "./notifications";
import { publishedWeeks, weekOf } from "./roster";
import { liveSessions } from "@/lib/domain/sessions";
import { fmtWallTime } from "@/lib/domain/time";
import { getTeachingMatrix } from "./teaching";
import { qualificationGap } from "./problems";
import { sessionsForInstructor } from "./session-staff";
import { qualification as qualificationTable } from "@/lib/db/schema";

export interface AssignInput {
  courseId: string;
  instructorId: string;
  roleTypeId: string;
  /** Admin override of a fit/conflict block — requires a note, recorded to audit. */
  override?: boolean;
  overrideNote?: string;
}

export type AssignBlockReason = "not-fit" | "not-qualified" | "conflict" | "unavailable" | "invalid";

export type AssignResult =
  | { ok: true; courseStaffId: string; overridden: boolean; /** Non-blocking notes for the office. */ warnings: string[] }
  | { ok: false; reason: AssignBlockReason; detail: string; /** True when the centre's setting forbids overriding this block. */ noOverride?: boolean };

function toMs(v: Date | number): number {
  return v instanceof Date ? v.getTime() : Number(v);
}

/** Plain-English reason an assignment was refused. */
export function assignBlockMessage(reason: AssignBlockReason, detail: string): string {
  if (reason === "not-fit") return `Not cleared to roster: ${detail}`;
  if (reason === "not-qualified") return `Not an instructor for this course type: ${detail}`;
  if (reason === "conflict") return `Double-booked: ${detail}`;
  if (reason === "unavailable") return `${detail} in their availability`;
  return detail;
}

/**
 * Assign an instructor to a course, enforcing the compliance moat:
 *   1. FIT — instructor blocked if any mandatory check is missing/expired.
 *   2. CONFLICT — instructor already booked on an overlapping session.
 *   3. AVAILABILITY — the instructor marked the slot busy.
 * Each block can be overridden by an admin, which is recorded to the audit log
 * with the overriding user. Working hours (including under-18s') are the
 * centre's to manage: the roster and availability show each person's hours for
 * the week, and nothing here checks them. Ratio/safety-cover is a course-level
 * flag surfaced elsewhere, not a hard block here.
 */
/** A course's own sessions plus every session from 14 days before its first to 14 days after its last. */
export async function sessionsAround(repos: Repositories, ctx: AnyTenantContext, courseId: string, days = 14) {
  const t = repos.tenant;
  const own = await t.courseSession.list(ctx, eq(courseSessionTable.courseId, courseId));
  if (own.length === 0) return own;
  const dates = own.map((s) => s.date).sort();
  const nearby = await t.courseSession.list(ctx, and(gte(courseSessionTable.date, addDaysIso(dates[0]!, -days)), lte(courseSessionTable.date, addDaysIso(dates[dates.length - 1]!, days))));
  const byId = new Map([...own, ...nearby].map((s) => [s.id, s]));
  return [...byId.values()];
}

const addDaysIso = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export async function assignStaff(
  repos: Repositories,
  ctx: AnyTenantContext,
  input: AssignInput,
): Promise<AssignResult> {
  const t = repos.tenant;

  const [course, everySession] = await Promise.all([
    t.course.findById(ctx, input.courseId),
    sessionsAround(repos, ctx, input.courseId),
  ]);
  // This course's sessions plus everything a fortnight either side: enough for
  // clashes, rest periods and weekly hours, without reading the whole history.
  const thisCourseSessions = liveSessions(everySession);
  if (!course) return { ok: false, reason: "invalid", detail: "Course not found" };
  // Both ids must belong to this centre (findById is tenant scoped).
  const [instructorRow, roleRow] = await Promise.all([t.instructor.findById(ctx, input.instructorId), t.roleType.findById(ctx, input.roleTypeId)]);
  if (!instructorRow) return { ok: false, reason: "invalid", detail: "Instructor not found" };
  if (instructorRow.restrictedAt) return { ok: false, reason: "invalid", detail: "Processing is restricted for this person (Staff → Data & privacy); they cannot be rostered until the restriction is lifted" };
  if (instructorRow.anonymisedAt) return { ok: false, reason: "invalid", detail: "This record has been anonymised and cannot be rostered" };
  if (!roleRow) return { ok: false, reason: "invalid", detail: "Role not found" };

  // Staff can be rostered before a course's sessions are finalised; the conflict
  // check below simply has nothing to compare against until sessions exist.
  const targetSessions = thisCourseSessions.filter((s) => s.courseId === input.courseId);

  // --- 1. Fit check (only when the centre has opted into licence checks) ----
  const [complianceTypes, complianceItems, settingsRows] = await Promise.all([
    t.complianceType.list(ctx),
    t.complianceItem.list(ctx, eq(complianceItemTable.instructorId, input.instructorId)),
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

  // --- 1a. Qualification match: the course type must be one they can teach ----
  // Only judged when the centre has recorded something for them (a qualification
  // or an approval); with nothing on file nobody is blocked. Override allowed.
  const [teaching, heldQuals] = await Promise.all([getTeachingMatrix(repos, ctx), t.qualification.list(ctx, eq(qualificationTable.instructorId, input.instructorId))]);
  const gap = qualificationGap(teaching.get(input.instructorId) ?? [], heldQuals.length > 0, course.courseTypeId);
  const notQualified = gap.known && !gap.qualified;
  if (notQualified && !input.override) {
    const ctName = (await t.courseType.findById(ctx, course.courseTypeId))?.name ?? "this course type";
    return { ok: false, reason: "not-qualified", detail: `${instructorRow.name}'s qualifications don't cover ${ctName}` };
  }

  // --- 2. Conflict check ---------------------------------------------------
  const existingAssignments = await t.courseStaff.list(
    ctx,
    eq(courseStaffTable.instructorId, input.instructorId),
  );
  // Already on this course in this role: nothing to add (the unique key would refuse it anyway).
  if (existingAssignments.some((a) => a.courseId === input.courseId && a.roleTypeId === input.roleTypeId)) {
    return { ok: false, reason: "invalid", detail: `${instructorRow.name} is already on this course as ${roleRow.name}` };
  }
  // What they are actually on elsewhere: course-level minus per-day skips, plus per-day adds.
  const existingBookings: ResourceBooking[] = (await sessionsForInstructor(repos, ctx, input.instructorId, thisCourseSessions))
    .filter((s) => s.courseId !== input.courseId)
    .map((s) => ({
      sessionId: s.id,
      resourceId: input.instructorId,
      startAt: toMs(s.startAt),
      endAt: toMs(s.endAt),
      courseId: s.courseId,
      date: s.date,
      slot: s.slot,
    }));
  const clashMode = clashModeFor(settings?.slotStyle);
  const candidateOf = (s: { id: string; startAt: Date | number; endAt: Date | number; date: string; slot: string }) =>
    ({ sessionId: s.id, resourceId: input.instructorId, startAt: toMs(s.startAt), endAt: toMs(s.endAt), date: s.date, slot: s.slot });

  const clashing = conflictChecksOn
    ? targetSessions.find((s) =>
        hasConflict(candidateOf(s), existingBookings, clashMode),
      )
    : undefined;
  if (clashing && !input.override) {
    return { ok: false, reason: "conflict", detail: `Already on another course in the same session (${clashing.date} ${clashing.slot})` };
  }

  // --- 3. Availability: "Busy" blocks (on by default), override allowed ----
  const availabilityOn = settings?.enforceAvailabilityChecks ?? true;
  // No blank: inside the centre's window a slot is Busy until marked Free or Maybe
  // (their usual week counts); beyond the window nobody has been asked, so nothing blocks.
  let busy: { date: string; slot: string; why: string } | undefined;
  if (availabilityOn && targetSessions.length) {
    const { index } = await loadInstructorAvailability(repos, ctx, input.instructorId);
    const horizon = availabilityHorizon(settings);
    for (const s of targetSessions) {
      const e = effectiveAvailability(index, horizon, s.date, s.slot);
      if (blocksRostering(e)) { busy = { date: s.date, slot: s.slot, why: describeBusy(e, s.date, s.slot) }; break; }
    }
  }
  if (busy && !input.override) {
    return { ok: false, reason: "unavailable", detail: busy.why };
  }

  const warnings: string[] = [];
  // Slot-run centres: a session before or after is fine, but say so when the typed times run into each other.
  if (clashMode === "slots") {
    const seen = new Set<string>();
    for (const s of targetSessions) {
      for (const o of timeOverlapsOnly(candidateOf(s), existingBookings)) {
        const key = `${s.id}|${o.sessionId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const from = Math.max(toMs(s.startAt), o.startAt);
        const to = Math.min(toMs(s.endAt), o.endAt);
        warnings.push(`Times overlap on ${s.date}: this ${s.slot} session (${fmtWallTime(s.startAt)}–${fmtWallTime(s.endAt)}) and their ${o.slot} session (${fmtWallTime(o.startAt)}–${fmtWallTime(o.endAt)}) overlap ${fmtWallTime(from)}–${fmtWallTime(to)}`);
      }
    }
  }

  // --- 4. Persist ----------------------------------------------------------
  const overridden = Boolean(input.override && (!fit.fit || notQualified || clashing || busy));
  // The assignment, its pay lines and the change-log entry are written in one
  // batch: all of it lands or none of it does.
  const row = {
    id: crypto.randomUUID(),
    courseId: input.courseId,
    instructorId: input.instructorId,
    roleTypeId: input.roleTypeId,
    // Office-managed people aren't asked to confirm: the office speaks for them.
    status: (managedByOffice(instructorRow, settings) ? "confirmed" : "assigned") as "confirmed" | "assigned",
    confirmedAt: managedByOffice(instructorRow, settings) ? new Date() : null,
    isOverride: overridden,
    overrideNote: overridden ? input.overrideNote ?? null : null,
    overriddenBy: overridden ? actorUserId(ctx) : null,
  };
  const current = await t.courseStaff.list(ctx, eq(courseStaffTable.courseId, input.courseId));
  const hours = await planHoursForCourse(repos, ctx, input.courseId, { staffOverride: [...current, row] });
  const audit = auditStatement(repos, ctx, {
    action: overridden ? "assign_staff_override" : "assign_staff",
    entity: "course_staff",
    entityId: row.id,
    after: {
      courseId: input.courseId, instructorId: input.instructorId, overridden, note: input.overrideNote,
    },
  });
  try {
    await runAtomic(repos.db, [t.courseStaff.insertStatement(ctx, row), ...hours.statements, ...(audit ? [audit] : [])]);
  } catch (err) {
    if (/UNIQUE/i.test(String((err as Error)?.message ?? err))) return { ok: false, reason: "invalid", detail: "They are already on this course in that role" };
    throw err;
  }

  // Two admins can each pass the clash check in the same second and double-book
  // someone. Check again now that the write has landed; if a clash appeared in
  // the meantime, take this assignment back out (with its pay lines) and say why.
  if (conflictChecksOn && !clashing) {
    const freshSessions = liveSessions(await sessionsAround(repos, ctx, input.courseId));
    const now = (await sessionsForInstructor(repos, ctx, input.instructorId, freshSessions)).filter((s) => s.courseId !== input.courseId);
    const late = targetSessions.find((s) => hasConflict(
      candidateOf(s),
      now.map((o) => ({ sessionId: o.id, resourceId: input.instructorId, startAt: toMs(o.startAt), endAt: toMs(o.endAt), courseId: o.courseId, date: o.date, slot: o.slot })),
      clashMode,
    ));
    if (late) {
      const after = await t.courseStaff.list(ctx, eq(courseStaffTable.courseId, input.courseId));
      const undoHours = await planHoursForCourse(repos, ctx, input.courseId, { staffOverride: after.filter((a) => a.id !== row.id) });
      const undoAudit = auditStatement(repos, ctx, { action: "assign_staff_undone", entity: "course_staff", entityId: row.id, after: { courseId: input.courseId, instructorId: input.instructorId, reason: "clash appeared while saving" } });
      await runAtomic(repos.db, [t.courseStaff.deleteStatement(ctx, row.id), ...undoHours.statements, ...(undoAudit ? [undoAudit] : [])]);
      return { ok: false, reason: "conflict", detail: `Someone else put ${instructorRow.name} on another course at the same time (${late.date} ${late.slot}) while you were saving. Nothing was changed here; check the roster and try again.` };
    }
  }

  // Tell them — but only once the week is published (publishing itself notifies).
  await notifyRosterChange(repos, ctx, input.instructorId, course.name ?? "a course", targetSessions.map((s) => s.date), "added");

  return { ok: true, courseStaffId: row.id, overridden, warnings };
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


/**
 * In-app + push (and email, if they allow it) about a roster change, for the
 * dates whose week has been published. Unpublished weeks stay quiet: the
 * instructor hears about those when the week is published.
 */
export async function notifyRosterChange(
  repos: Repositories,
  ctx: AnyTenantContext,
  instructorId: string,
  courseName: string,
  dates: string[],
  change: "added" | "removed" | "moved",
): Promise<void> {
  try {
    const published = await publishedWeeks(repos, ctx);
    const affected = [...new Set(dates)].filter((d) => published.has(weekOf(d))).sort();
    if (affected.length === 0) return;
    const when = affected.length === 1 ? `on ${affected[0]}` : `on ${affected.length} dates from ${affected[0]}`;
    const title = change === "added" ? `You're on ${courseName}` : change === "removed" ? `You're off ${courseName}` : `${courseName} has moved`;
    const body = change === "added"
      ? `You've been rostered on ${courseName} ${when}. Open the app to see the details and confirm.`
      : change === "removed"
        ? `You're no longer on ${courseName} ${when}.`
        : `The time or date of ${courseName} has changed ${when} — check your schedule.`;
    await notifyInstructor(repos, ctx, instructorId, { title, body, email: true });
  } catch (err) {
    console.error("[rota-notify] failed:", (err as Error).message);
  }
}
