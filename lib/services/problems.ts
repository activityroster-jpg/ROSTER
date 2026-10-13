import { and, eq, gte, isNull, lt, or } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { availability as availabilityTable, course as courseTable, courseEquipment as courseEquipmentTable, courseRoleRequirement as courseRoleRequirementTable, courseSession as courseSessionTable, courseStaff as courseStaffTable, sessionStaffOverride as overrideTable } from "@/lib/db/schema";
import { clashModeFor, evaluateFit, type ComplianceRequirement, type HeldCompliance } from "@/lib/domain";
import { cleanRoleLines } from "@/lib/domain/staffing";
import { liveSessions } from "@/lib/domain/sessions";
import { indexAvailability, keyOf, managedByOffice } from "@/lib/domain/availability";
import {
  availabilityProblems,
  sessionCoverageProblems,
  type CourseCover,
  declinedProblems,
  doubleBookings,
  equipmentProblems,
  equipmentShortfalls,
  perAssignmentProblems,
  sessionsOf,
  sortProblems,
  type Problem,
  type ProblemAssignment,
  type ProblemCourse,
  type ProblemInstructor,
  type ProblemSession,
} from "@/lib/domain/problems";
import { availabilityHorizon } from "./availability";
import { fitReason } from "./staff";
import { getTeachingContext, getTeachingMatrix, type TeachingContext } from "./teaching";
import { canFillPlace, expiredTypesFor, unsupervised, type SlotPerson } from "@/lib/domain/teaching";
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
 * an instructor's qualifications,
 * ratio and safety cover, and equipment clashes or maintenance. Tenant scoped;
 * the decisions are the pure functions in lib/domain/problems.
 */
export async function findProblems(repos: Repositories, ctx: AnyTenantContext, opts: ProblemsOptions = {}): Promise<ProblemsReport> {
  const t = repos.tenant;
  const settingsRows = await t.orgSettings.list(ctx);
  const settings = settingsRows[0] ?? null;
  const from = opts.from ?? todayIso(settings?.timezone ?? undefined);
  const to = opts.to ?? addDays(from, 56);

  // Bounded read (audit C2): the range plus a week either side, which is all the
  // clash checks ever look at.
  const windowFrom = addDays(from, -7);
  const windowTo = addDays(to, 7);
  const allSessions = await t.courseSession.list(ctx, and(gte(courseSessionTable.date, windowFrom), lt(courseSessionTable.date, windowTo))).then(liveSessions);
  // Everything else only for the courses and dates in that window.
  const windowCourseIds = [...new Set(allSessions.map((x) => x.courseId))];
  const availInWindow = or(and(gte(availabilityTable.date, windowFrom), lt(availabilityTable.date, windowTo)), isNull(availabilityTable.date));
  const [courseRows, courseTypes, assignmentRows, instructorRows, availRows, complianceTypes, complianceItems, roleTypes, courseEquipment, equipment, teachingCtx, qualifications, equipmentTypes, overrideRows, roleLineRows] = await Promise.all([
    t.course.listIn(ctx, courseTable.id, windowCourseIds),
    t.courseType.list(ctx),
    t.courseStaff.listIn(ctx, courseStaffTable.courseId, windowCourseIds),
    t.instructor.list(ctx),
    t.availability.list(ctx, opts.instructorId ? and(eq(availabilityTable.instructorId, opts.instructorId), availInWindow) : availInWindow),
    t.complianceType.list(ctx),
    t.complianceItem.list(ctx),
    t.roleType.list(ctx),
    t.courseEquipment.listIn(ctx, courseEquipmentTable.courseId, windowCourseIds),
    t.equipment.list(ctx),
    getTeachingContext(repos, ctx),
    t.qualification.list(ctx),
    t.equipmentType.list(ctx),
    t.sessionStaffOverride.listIn(ctx, overrideTable.courseSessionId, allSessions.map((x) => x.id)),
    t.courseRoleRequirement.listIn(ctx, courseRoleRequirementTable.courseId, windowCourseIds),
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
      .map((a) => { const skips = skipsFor.get(`${a.courseId}|${a.instructorId}`); return { id: a.id, courseId: a.courseId, instructorId: a.instructorId, status: a.status, roleTypeId: a.roleTypeId, ...(skips ? { skipSessionIds: skips } : {}) }; }),
    ...overrideRows
      .filter((o) => o.mode === "add" && sessionCourse.has(o.courseSessionId) && inRange.has(sessionCourse.get(o.courseSessionId)!))
      .map((o) => ({ id: `day:${o.id}`, courseId: sessionCourse.get(o.courseSessionId)!, instructorId: o.instructorId, status: "assigned", roleTypeId: o.roleTypeId, onlySessionIds: [o.courseSessionId] })),
  ];
  if (opts.instructorId) assignments = assignments.filter((a) => a.instructorId === opts.instructorId);

  const problems: Problem[] = [];

  // Double-bookings: when the centre checks for them.
  if (settings?.enforceConflictChecks ?? false) problems.push(...doubleBookings(sessions, assignments, courses, instructors, clashModeFor(settings?.slotStyle)));

  // Availability: Busy, leave, or never answered (on by default).
  if (settings?.enforceAvailabilityChecks ?? true) {
    const horizon = availabilityHorizon(settings);
    const perInstructor = new Map<string, { index: ReturnType<typeof indexAvailability>; setBy: Record<string, string> }>();
    const rowsBy = new Map<string, typeof availRows>();
    for (const r of availRows) rowsBy.set(r.instructorId, [...(rowsBy.get(r.instructorId) ?? []), r]);
    // Everyone, so office-managed people with no answers still count as Free.
    for (const person of instructorRows) {
      const rows = rowsBy.get(person.id) ?? [];
      const setBy: Record<string, string> = {};
      for (const r of rows) if (r.date) setBy[keyOf(r.date, r.slot)] = r.setBy;
      perInstructor.set(person.id, { index: indexAvailability(rows, { assumeFree: managedByOffice(person, settings) }), setBy });
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

  // Qualified for the place (lib/services/place-check): a teaching place needs
  // the course in their instructor types; a place that is an instructor type
  // needs that type or a higher one on its ladder. Only for people we know
  // something about (see qualificationGap). Volunteers skip the course check.
  const teaching = await getTeachingMatrix(repos, ctx, teachingCtx);
  const holdsAny = new Set(qualifications.map((q) => q.instructorId));
  const roleRow = new Map(roleTypes.map((r) => [r.id, r]));
  problems.push(...perAssignmentProblems("not-qualified", "warn", sessions, assignments, courses, instructors, (instructorId, course, a) => {
    const role = a.roleTypeId ? roleRow.get(a.roleTypeId) : undefined;
    if (!holdsAny.has(instructorId)) return null;
    if (!role || role.countsTowardRatio) {
      const gap = qualificationGap(teaching.get(instructorId) ?? [], true, course.courseTypeId);
      if (gap.known && !gap.qualified) return `Their instructor types don't cover ${courseTypes.find((ct) => ct.id === course.courseTypeId)?.name ?? "this course type"}`;
    }
    if (role?.qualificationTypeId && !canFillPlace(teachingCtx.held.get(instructorId) ?? new Set(), role.qualificationTypeId, teachingCtx.types)) {
      return `In a ${role.name} place without being a ${teachingCtx.types.get(role.qualificationTypeId)?.name ?? role.name} (or higher)`;
    }
    return null;
  }));

  // Supervision: someone who teaches under a Senior Instructor (Assistant, Dinghy
  // Instructor…) is on, and nobody who supervises their ladder is on duty in that
  // slot anywhere at the centre. Only once the centre has recorded a supervisor.
  if (!opts.instructorId) problems.push(...supervisionProblems(sessions, assignments, courses, roleRow, teachingCtx));
  // An expired instructor type behind someone's place: a warning, never a block.
  problems.push(...expiredTypeProblems(sessions, assignments, courses, roleRow, teachingCtx));

  // Ratio and safety cover, per session (one-day changes counted), judged as
  // the roster board judges it: against the course's role lines when it has
  // them, else its ratio. When the centre flags them.
  if ((settings?.enforceRatioChecks ?? false) && !opts.instructorId) {
    const roleById = new Map(roleTypes.map((r) => [r.id, { countsTowardRatio: Boolean(r.countsTowardRatio), isSafetyCover: Boolean(r.isSafetyCover) }]));
    const info = new Map<string, CourseCover>();
    for (const c of courseRows) {
      if (!inRange.has(c.id)) continue;
      const ct = courseTypes.find((x) => x.id === c.courseTypeId);
      info.set(c.id, { capacity: c.capacity, ratio: c.ratio, staffRequired: c.staffRequired, requiresSafetyBoat: ct?.requiresSafetyBoat ?? false, lines: cleanRoleLines(roleLineRows.filter((l) => l.courseId === c.id)) });
    }
    problems.push(...sessionCoverageProblems(sessions, assignments, courses, info, roleById));
  }

  // Equipment: tracked units only.
  if (!opts.instructorId) {
    const units = new Map(equipment.map((e) => [e.id, { name: e.identifier ? `${e.name} (${e.identifier})` : e.name, status: e.status, maintenanceNote: e.maintenanceNote ?? null, backOn: e.backOn ?? null }]));
    problems.push(...equipmentProblems(sessions, courseEquipment, units, courses, clashModeFor(settings?.slotStyle)));
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
  const sessions = (await repos.tenant.courseSession.list(ctx, eq(courseSessionTable.courseId, courseId))).filter((s) => !s.cancelledAt);
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

/** One warning per person per session whose instructor type for that place has expired by the day. */
function expiredTypeProblems(
  sessions: readonly ProblemSession[],
  assignments: readonly ProblemAssignment[],
  courses: ReadonlyMap<string, ProblemCourse>,
  roles: ReadonlyMap<string, { name: string; qualificationTypeId: string | null }>,
  tc: TeachingContext,
): Problem[] {
  const byCourse = new Map<string, ProblemSession[]>();
  for (const s of sessions) byCourse.set(s.courseId, [...(byCourse.get(s.courseId) ?? []), s]);
  const out: Problem[] = [];
  for (const a of assignments) {
    if (a.status === "declined") continue;
    const expiry = tc.expiry.get(a.instructorId);
    if (!expiry) continue;
    const course = courses.get(a.courseId);
    const placeTypeId = a.roleTypeId ? roles.get(a.roleTypeId)?.qualificationTypeId ?? null : null;
    for (const s of sessionsOf(a, byCourse.get(a.courseId) ?? [])) {
      const gone = expiredTypesFor(expiry, s.date, placeTypeId, course?.courseTypeId ?? null, tc.rulesByCourse, tc.types);
      if (!gone.length) continue;
      const until = new Date(`${expiry.get(gone[0]!.id)!}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
      out.push({ kind: "type-expired", severity: "warn", date: s.date, slot: s.slot, courseId: s.courseId, courseName: course?.name ?? "Course", sessionId: s.id, instructorId: a.instructorId, instructorName: null, detail: `${gone.map((t) => t.name).join(", ")} expired on ${until}` });
    }
  }
  return out;
}

/** One warning per person per slot who teaches under supervision with no supervisor for their ladder on duty in that slot. */
function supervisionProblems(
  sessions: readonly ProblemSession[],
  assignments: readonly ProblemAssignment[],
  courses: ReadonlyMap<string, ProblemCourse>,
  roles: ReadonlyMap<string, { name: string; qualificationTypeId: string | null }>,
  tc: TeachingContext,
): Problem[] {
  // Starts once the centre has recorded at least one supervisor (a Senior
  // Instructor or above): before that every slot would warn.
  const anySupervisor = [...tc.held.values()].some((held) => [...held].some((id) => tc.types.get(id)?.supervises));
  if (!anySupervisor) return [];
  const bySlot = new Map<string, ProblemSession[]>();
  for (const s of sessions) bySlot.set(`${s.date}|${s.slot}`, [...(bySlot.get(`${s.date}|${s.slot}`) ?? []), s]);
  const byCourse = new Map<string, ProblemSession[]>();
  for (const s of sessions) byCourse.set(s.courseId, [...(byCourse.get(s.courseId) ?? []), s]);
  const out: Problem[] = [];
  for (const slotSessions of bySlot.values()) {
    const ids = new Set(slotSessions.map((s) => s.id));
    const people: (SlotPerson & { session: ProblemSession })[] = [];
    for (const a of assignments) {
      if (a.status === "declined") continue;
      for (const s of sessionsOf(a, byCourse.get(a.courseId) ?? [])) {
        if (!ids.has(s.id)) continue;
        const role = a.roleTypeId ? roles.get(a.roleTypeId) : undefined;
        people.push({ instructorId: a.instructorId, name: "", placeTypeId: role?.qualificationTypeId ?? null, held: tc.held.get(a.instructorId) ?? new Set(), session: s });
      }
    }
    for (const { person, placeType } of unsupervised(people, tc.types)) {
      const p = people.find((x) => x.instructorId === person.instructorId && x.placeTypeId === person.placeTypeId)!;
      const course = courses.get(p.session.courseId);
      out.push({ kind: "no-supervisor", severity: "warn", date: p.session.date, slot: p.session.slot, courseId: p.session.courseId, courseName: course?.name ?? "Course", sessionId: p.session.id, instructorId: person.instructorId, instructorName: null, detail: `${placeType.name} with no Senior Instructor on duty in this slot` });
    }
  }
  return out;
}
