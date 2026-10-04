import { eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { availability as availabilityTable } from "@/lib/db/schema";
import { evaluateFit, evaluateRatio, type AssignedRole, type ComplianceRequirement, type HeldCompliance } from "@/lib/domain";
import { liveSessions } from "@/lib/domain/sessions";
import { isUnder18 } from "@/lib/domain/age";
import { indexAvailability, keyOf } from "@/lib/domain/availability";
import {
  availabilityProblems,
  coverageProblems,
  declinedProblems,
  doubleBookings,
  equipmentProblems,
  equipmentShortfalls,
  perAssignmentProblems,
  sortProblems,
  type Problem,
  type ProblemAssignment,
  type ProblemCourse,
  type ProblemInstructor,
  type ProblemSession,
} from "@/lib/domain/problems";
import { availabilityHorizon } from "./availability";
import { fitReason } from "./staff";
import { getTeachingMatrix } from "./teaching";
import { checkWorkingTime, describeFindings } from "./working-time";
import { parentApprovalFor } from "./guardians";
import { addDays } from "./schedule";
import { todayIso } from "@/lib/domain/time";

export type { Problem, ProblemKind, ProblemSeverity } from "@/lib/domain/problems";
export { describeProblem, problemLabel } from "@/lib/domain/problems";

export interface ProblemsReport {
  from: string;
  to: string;
  problems: Problem[];
  blocks: number;
  warns: number;
  bySession: Record<string, Problem[]>;
  byCourse: Record<string, Problem[]>;
  byInstructor: Record<string, Problem[]>;
}

export interface ProblemsOptions {
  /** Half-open date range [from, to). Defaults to today for eight weeks. */
  from?: string;
  to?: string;
  /** Only this course (after an edit) or only this instructor (their app). */
  courseId?: string;
  instructorId?: string;
}

const ms = (v: Date | number) => (v instanceof Date ? v.getTime() : Number(v));

/**
 * Everything wrong with the roster in a date range, judged against the checks
 * the centre has switched on: double-bookings, rostered while Busy or on leave,
 * declines without cover, expired mandatory checks, the wrong course type for
 * an instructor's qualifications, young workers' hours, parental permission,
 * ratio and safety cover, and equipment clashes or maintenance. Tenant scoped;
 * the decisions are the pure functions in lib/domain/problems.
 */
export async function findProblems(repos: Repositories, ctx: AnyTenantContext, opts: ProblemsOptions = {}): Promise<ProblemsReport> {
  const t = repos.tenant;
  const settingsRows = await t.orgSettings.list(ctx);
  const settings = settingsRows[0] ?? null;
  const from = opts.from ?? todayIso(settings?.timezone ?? undefined);
  const to = opts.to ?? addDays(from, 56);

  const [allSessions, courseRows, courseTypes, assignmentRows, instructorRows, availRows, complianceTypes, complianceItems, roleTypes, courseEquipment, equipment, teaching, qualifications, equipmentTypes, overrideRows] = await Promise.all([
    t.courseSession.list(ctx).then(liveSessions),
    t.course.list(ctx),
    t.courseType.list(ctx),
    t.courseStaff.list(ctx),
    t.instructor.list(ctx),
    opts.instructorId ? t.availability.list(ctx, eq(availabilityTable.instructorId, opts.instructorId)) : t.availability.list(ctx),
    t.complianceType.list(ctx),
    t.complianceItem.list(ctx),
    t.roleType.list(ctx),
    t.courseEquipment.list(ctx),
    t.equipment.list(ctx),
    getTeachingMatrix(repos, ctx),
    t.qualification.list(ctx),
    t.equipmentType.list(ctx),
    t.sessionStaffOverride.list(ctx),
  ]);

  const cancelled = new Set(courseRows.filter((c) => c.cancelledAt || c.status === "cancelled").map((c) => c.id));
  const sessions: ProblemSession[] = allSessions
    .filter((s) => s.date >= from && s.date < to && !cancelled.has(s.courseId))
    .map((s) => ({ id: s.id, courseId: s.courseId, date: s.date, slot: s.slot, startAt: ms(s.startAt), endAt: ms(s.endAt) }));
  const courses = new Map<string, ProblemCourse>(courseRows.map((c) => [c.id, { id: c.id, name: c.name ?? courseTypes.find((ct) => ct.id === c.courseTypeId)?.name ?? "Course", courseTypeId: c.courseTypeId }]));
  const instructors = new Map<string, ProblemInstructor>(instructorRows.map((i) => [i.id, { id: i.id, name: i.name }]));
  const inRange = new Set(sessions.map((s) => s.courseId));
  // Course-level assignments carry their per-day skips; per-day adds are assignments for one session.
  const sessionCourse = new Map(allSessions.map((s) => [s.id, s.courseId]));
  const skipsFor = new Map<string, string[]>();
  for (const o of overrideRows) if (o.mode === "skip") { const k = `${sessionCourse.get(o.courseSessionId) ?? ""}|${o.instructorId}`; skipsFor.set(k, [...(skipsFor.get(k) ?? []), o.courseSessionId]); }
  let assignments: ProblemAssignment[] = [
    ...assignmentRows
      .filter((a) => inRange.has(a.courseId))
      .map((a) => { const skips = skipsFor.get(`${a.courseId}|${a.instructorId}`); return { id: a.id, courseId: a.courseId, instructorId: a.instructorId, status: a.status, ...(skips ? { skipSessionIds: skips } : {}) }; }),
    ...overrideRows
      .filter((o) => o.mode === "add" && sessionCourse.has(o.courseSessionId) && inRange.has(sessionCourse.get(o.courseSessionId)!))
      .map((o) => ({ id: `day:${o.id}`, courseId: sessionCourse.get(o.courseSessionId)!, instructorId: o.instructorId, status: "assigned", onlySessionIds: [o.courseSessionId] })),
  ];
  if (opts.instructorId) assignments = assignments.filter((a) => a.instructorId === opts.instructorId);

  const problems: Problem[] = [];

  // Double-bookings: when the centre checks for them.
  if (settings?.enforceConflictChecks ?? false) problems.push(...doubleBookings(sessions, assignments, courses, instructors));

  // Availability: Busy, leave, or never answered (on by default).
  if (settings?.enforceAvailabilityChecks ?? true) {
    const horizon = availabilityHorizon(settings);
    const perInstructor = new Map<string, { index: ReturnType<typeof indexAvailability>; setBy: Record<string, string> }>();
    const rowsBy = new Map<string, typeof availRows>();
    for (const r of availRows) rowsBy.set(r.instructorId, [...(rowsBy.get(r.instructorId) ?? []), r]);
    for (const [id, rows] of rowsBy) {
      const setBy: Record<string, string> = {};
      for (const r of rows) if (r.date) setBy[keyOf(r.date, r.slot)] = r.setBy;
      perInstructor.set(id, { index: indexAvailability(rows), setBy });
    }
    problems.push(...availabilityProblems(sessions, assignments, courses, instructors, perInstructor, horizon));
  }

  problems.push(...declinedProblems(sessions, assignments, courses, instructors));

  // Mandatory checks: only when the centre enforces them.
  if (settings?.enforceLicenceChecks ?? false) {
    const requirements: ComplianceRequirement[] = complianceTypes.filter((c) => c.active).map((c) => ({ complianceTypeId: c.id, name: c.name, mandatory: c.mandatory, expiryTracked: c.expiryTracked }));
    const held = new Map<string, HeldCompliance[]>();
    for (const c of complianceItems) held.set(c.instructorId, [...(held.get(c.instructorId) ?? []), { complianceTypeId: c.complianceTypeId, expiryDate: c.expiryDate ?? null }]);
    const reasonCache = new Map<string, string>();
    problems.push(...perAssignmentProblems("not-fit", "block", sessions, assignments, courses, instructors, (instructorId) => {
      if (!reasonCache.has(instructorId)) reasonCache.set(instructorId, fitReason(evaluateFit(requirements, held.get(instructorId) ?? [], Date.now(), settings?.alertLeadDays ?? 30)));
      return reasonCache.get(instructorId) || null;
    }));
  }

  // Qualification match: only for people we know something about (see qualificationGap).
  const holdsAny = new Set(qualifications.map((q) => q.instructorId));
  problems.push(...perAssignmentProblems("not-qualified", "warn", sessions, assignments, courses, instructors, (instructorId, course) => {
    const gap = qualificationGap(teaching.get(instructorId) ?? [], holdsAny.has(instructorId), course.courseTypeId);
    return gap.known && !gap.qualified ? `Their qualifications don't cover ${courseTypes.find((ct) => ct.id === course.courseTypeId)?.name ?? "this course type"}` : null;
  }));

  // Young workers' hours and parental permission: under-18s only.
  const young = instructorRows.filter((i) => isUnder18(i.dateOfBirth));
  if (young.length) {
    const byId = new Map(young.map((i) => [i.id, i]));
    const wtCache = new Map<string, string | null>();
    const paCache = new Map<string, string | null>();
    for (const a of assignments) {
      const who = byId.get(a.instructorId);
      if (!who || a.status === "declined") continue;
      const k = `${a.instructorId}|${a.courseId}`;
      if (!wtCache.has(k)) {
        const others = assignmentRows.filter((x) => x.instructorId === a.instructorId && x.courseId !== a.courseId);
        const check = await checkWorkingTime(repos, ctx, { instructorId: a.instructorId, courseId: a.courseId, settings, allSessions: allSessions, existingAssignments: others });
        wtCache.set(k, check.blocks.length ? describeFindings(check.blocks) : null);
      }
      if (!paCache.has(a.instructorId) && settings?.requireParentApproval !== false) {
        const state = await parentApprovalFor(repos, ctx, a.instructorId, who.dateOfBirth);
        paCache.set(a.instructorId, state === "approved" || state === "not-needed" ? null : state === "none" ? "No parent or guardian has been invited to approve" : state === "pending" ? "Their parent or guardian hasn't approved yet" : `Their parent or guardian ${state} it`);
      }
    }
    problems.push(...perAssignmentProblems("working-time", settings?.workingTimeMode === "warn" ? "warn" : "block", sessions, assignments, courses, instructors, (instructorId, course) => wtCache.get(`${instructorId}|${course.id}`) ?? null));
    problems.push(...perAssignmentProblems("parent-approval", "block", sessions, assignments, courses, instructors, (instructorId) => paCache.get(instructorId) ?? null));
  }

  // Ratio and safety cover: when the centre flags them.
  if (settings?.enforceRatioChecks ?? false) {
    const roleById = new Map(roleTypes.map((r) => [r.id, r]));
    const assignedByCourse = new Map<string, AssignedRole[]>();
    for (const a of assignmentRows) {
      if (a.status === "declined") continue;
      const role = roleById.get(a.roleTypeId);
      assignedByCourse.set(a.courseId, [...(assignedByCourse.get(a.courseId) ?? []), { instructorId: a.instructorId, countsTowardRatio: role?.countsTowardRatio ?? false, isSafetyCover: role?.isSafetyCover ?? false }]);
    }
    const coverage = new Map<string, { understaffed: boolean; missingSafetyCover: boolean; assigned: number; required: number }>();
    for (const c of courseRows) {
      if (!inRange.has(c.id)) continue;
      const ct = courseTypes.find((x) => x.id === c.courseTypeId);
      const r = evaluateRatio({ groupSize: c.capacity, ratio: c.ratio, requiresSafetyBoat: ct?.requiresSafetyBoat ?? false, assigned: assignedByCourse.get(c.id) ?? [] });
      coverage.set(c.id, { understaffed: r.understaffed, missingSafetyCover: r.missingSafetyCover, assigned: r.ratioCountingStaff, required: r.requiredStaff });
    }
    if (!opts.instructorId) problems.push(...coverageProblems(sessions, courses, coverage));
  }

  // Equipment: tracked units only.
  if (!opts.instructorId) {
    const units = new Map(equipment.map((e) => [e.id, { name: e.identifier ? `${e.name} (${e.identifier})` : e.name, status: e.status }]));
    problems.push(...equipmentProblems(sessions, courseEquipment, units, courses));
    if (settings?.checkEquipmentQuantities ?? true) {
      problems.push(...equipmentShortfalls(
        sessions,
        courseEquipment,
        new Map(equipment.map((e) => [e.id, e.equipmentTypeId])),
        new Map(equipmentTypes.map((et) => [et.id, { name: et.name, quantity: et.quantity ?? null }])),
        courses,
      ));
    }
  }

  let list = sortProblems(problems);
  if (opts.courseId) list = list.filter((p) => p.courseId === opts.courseId || p.otherCourseId === opts.courseId);
  if (opts.instructorId) list = list.filter((p) => p.instructorId === opts.instructorId);

  const bySession: Record<string, Problem[]> = {};
  const byCourse: Record<string, Problem[]> = {};
  const byInstructor: Record<string, Problem[]> = {};
  for (const p of list) {
    if (p.sessionId) (bySession[p.sessionId] ??= []).push(p);
    (byCourse[p.courseId] ??= []).push(p);
    if (p.instructorId) (byInstructor[p.instructorId] ??= []).push(p);
  }
  return { from, to, problems: list, blocks: list.filter((p) => p.severity === "block").length, warns: list.filter((p) => p.severity === "warn").length, bySession, byCourse, byInstructor };
}

/**
 * Does this instructor's teaching list cover a course type? `known` is false
 * when the centre has recorded nothing for them (no qualifications, no
 * approvals), in which case nobody is blocked and the picker says so.
 */
export function qualificationGap(teachable: readonly { courseTypeId: string }[], holdsAnyQualification: boolean, courseTypeId: string): { known: boolean; qualified: boolean } {
  const known = teachable.length > 0 || holdsAnyQualification;
  return { known, qualified: !known || teachable.some((c) => c.courseTypeId === courseTypeId) };
}

/** The problems one instructor should hear about in their app: their own assignments only. */
export async function problemsForInstructor(repos: Repositories, ctx: AnyTenantContext, instructorId: string, opts: Pick<ProblemsOptions, "from" | "to"> = {}): Promise<Problem[]> {
  return (await findProblems(repos, ctx, { ...opts, instructorId })).problems;
}

/** The problems one course has right now, for the message after an edit. */
export async function problemsForCourse(repos: Repositories, ctx: AnyTenantContext, courseId: string): Promise<Problem[]> {
  const sessions = (await repos.tenant.courseSession.list(ctx)).filter((s) => s.courseId === courseId && !s.cancelledAt);
  if (sessions.length === 0) return [];
  const dates = sessions.map((s) => s.date).sort();
  return (await findProblems(repos, ctx, { from: dates[0]!, to: addDays(dates[dates.length - 1]!, 1), courseId })).problems;
}

/** "Session updated. ⚠ 2 problems: …" suffix for an action's message. */
export function problemsSuffix(problems: Problem[]): string {
  if (problems.length === 0) return "";
  const shown = problems.slice(0, 3).map((p) => `${p.instructorName ? `${p.instructorName} ` : ""}${p.kind === "double-booked" ? "double-booked" : p.kind === "busy" ? "is Busy" : p.kind === "on-leave" ? "is on leave" : p.kind === "not-answered" ? "hasn't answered availability" : p.kind.replace(/-/g, " ")} (${p.date}${p.slot ? ` ${p.slot}` : ""})`);
  return ` ⚠ ${problems.length} problem${problems.length === 1 ? "" : "s"}: ${shown.join("; ")}${problems.length > 3 ? "; …" : ""}`;
}
