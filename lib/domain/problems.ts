/**
 * The problems list (audit A1-3, A2-5, A4-3, A6-3): everything on the roster
 * that contradicts a rule the centre has switched on, found by looking at the
 * data as it stands now rather than only at the moment someone was assigned.
 * Session moves, late Busy answers, approved leave, a boat going into
 * maintenance and declines all show up here.
 *
 * Pure functions: the service gathers the rows, these decide. No DB, no clock.
 */

import { findConflicts, type ResourceBooking } from "./conflict";
import { effectiveAvailability, type AvailabilityHorizon, type AvailabilityIndex } from "./availability";

export type ProblemKind =
  | "double-booked"
  | "busy"
  | "on-leave"
  | "not-answered"
  | "declined"
  | "not-fit"
  | "not-qualified"
  | "working-time"
  | "parent-approval"
  | "unstaffed"
  | "no-safety-cover"
  | "equipment-clash"
  | "equipment-maintenance"
  | "equipment-short";

export type ProblemSeverity = "block" | "warn";

export interface Problem {
  kind: ProblemKind;
  severity: ProblemSeverity;
  /** The first day it bites. */
  date: string;
  slot: string | null;
  courseId: string;
  courseName: string;
  sessionId: string | null;
  /** For a clash: the other course involved, so a course-level view finds it from either side. */
  otherCourseId?: string;
  instructorId: string | null;
  instructorName: string | null;
  /** Plain English, no ids. */
  detail: string;
}

export interface ProblemSession {
  id: string;
  courseId: string;
  date: string;
  slot: string;
  startAt: number;
  endAt: number;
}
export interface ProblemCourse {
  id: string;
  name: string;
  courseTypeId: string;
}
export interface ProblemAssignment {
  id: string;
  courseId: string;
  instructorId: string;
  status: string;
  /** A per-day add: only these sessions of the course. */
  onlySessionIds?: readonly string[];
  /** Per-day skips: these sessions of the course don't count. */
  skipSessionIds?: readonly string[];
}

/** The sessions of a course this assignment actually covers. */
export const sessionsOf = <S extends { id: string }>(a: ProblemAssignment, courseSessions: readonly S[]): S[] =>
  courseSessions.filter((s) => (!a.onlySessionIds || a.onlySessionIds.includes(s.id)) && !(a.skipSessionIds?.includes(s.id)));
export interface ProblemInstructor {
  id: string;
  name: string;
}

const KIND_LABEL: Record<ProblemKind, string> = {
  "double-booked": "Double-booked",
  busy: "Rostered while Busy",
  "on-leave": "Rostered while on leave",
  "not-answered": "Availability not answered",
  declined: "Declined, needs cover",
  "not-fit": "Not cleared to roster",
  "not-qualified": "Not an instructor for this course type",
  "working-time": "Young worker's hours",
  "parent-approval": "Parental permission",
  unstaffed: "Short of instructors",
  "no-safety-cover": "No safety cover",
  "equipment-clash": "Equipment on two courses at once",
  "equipment-maintenance": "Equipment in maintenance",
  "equipment-short": "Not enough equipment",
};
export const problemLabel = (kind: ProblemKind): string => KIND_LABEL[kind];

const SEVERITY_ORDER: Record<ProblemSeverity, number> = { block: 0, warn: 1 };
export function sortProblems(problems: Problem[]): Problem[] {
  return [...problems].sort((a, b) => a.date.localeCompare(b.date) || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.courseName.localeCompare(b.courseName));
}

const live = (a: ProblemAssignment) => a.status !== "declined";
const firstSessionOf = (courseId: string, sessions: readonly ProblemSession[], a?: ProblemAssignment): ProblemSession | undefined => {
  const mine = sessions.filter((s) => s.courseId === courseId);
  return (a ? sessionsOf(a, mine) : mine).sort((x, y) => x.date.localeCompare(y.date) || x.startAt - y.startAt)[0];
};

/** The same instructor on two overlapping sessions of different courses. One problem per clash, dated by the earlier session. */
export function doubleBookings(sessions: readonly ProblemSession[], assignments: readonly ProblemAssignment[], courses: ReadonlyMap<string, ProblemCourse>, instructors: ReadonlyMap<string, ProblemInstructor>): Problem[] {
  const byCourse = new Map<string, ProblemSession[]>();
  for (const s of sessions) byCourse.set(s.courseId, [...(byCourse.get(s.courseId) ?? []), s]);
  const bookings: ResourceBooking[] = [];
  for (const a of assignments) {
    if (!live(a)) continue;
    for (const s of sessionsOf(a, byCourse.get(a.courseId) ?? [])) bookings.push({ sessionId: s.id, resourceId: a.instructorId, startAt: s.startAt, endAt: s.endAt, courseId: a.courseId });
  }
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  return findConflicts(bookings).map((c) => {
    const sa = sessionById.get(c.a.sessionId)!;
    const sb = sessionById.get(c.b.sessionId)!;
    const first = sa.startAt <= sb.startAt ? sa : sb;
    const other = first === sa ? sb : sa;
    return {
      kind: "double-booked", severity: "block",
      date: first.date, slot: first.slot, courseId: first.courseId, courseName: courses.get(first.courseId)?.name ?? "Course", sessionId: first.id, otherCourseId: other.courseId,
      instructorId: c.resourceId, instructorName: instructors.get(c.resourceId)?.name ?? "Instructor",
      detail: `Also on ${courses.get(other.courseId)?.name ?? "another course"} at the same time (${other.date} ${other.slot})`,
    };
  });
}

/** Rostered on a slot that is Busy (said so, usual week, or leave), or inside the window and never answered. */
export function availabilityProblems(
  sessions: readonly ProblemSession[],
  assignments: readonly ProblemAssignment[],
  courses: ReadonlyMap<string, ProblemCourse>,
  instructors: ReadonlyMap<string, ProblemInstructor>,
  availability: ReadonlyMap<string, { index: AvailabilityIndex; setBy: Record<string, string> }>,
  horizon: AvailabilityHorizon,
): Problem[] {
  const out: Problem[] = [];
  const byCourse = new Map<string, ProblemSession[]>();
  for (const s of sessions) byCourse.set(s.courseId, [...(byCourse.get(s.courseId) ?? []), s]);
  for (const a of assignments) {
    if (!live(a)) continue;
    const mine = availability.get(a.instructorId) ?? { index: { dated: {}, pattern: {} }, setBy: {} };
    for (const s of sessionsOf(a, byCourse.get(a.courseId) ?? [])) {
      const e = effectiveAvailability(mine.index, horizon, s.date, s.slot);
      if (e.status !== "unavailable") continue;
      const base = { date: s.date, slot: s.slot, courseId: s.courseId, courseName: courses.get(s.courseId)?.name ?? "Course", sessionId: s.id, instructorId: a.instructorId, instructorName: instructors.get(a.instructorId)?.name ?? "Instructor" };
      if (e.source === "default") out.push({ ...base, kind: "not-answered", severity: "warn", detail: "Hasn't marked this slot Free yet, so it counts as Busy" });
      else if (mine.setBy[`${s.date}|${s.slot}`] === "leave") out.push({ ...base, kind: "on-leave", severity: "block", detail: "On approved leave that day" });
      else out.push({ ...base, kind: "busy", severity: "block", detail: e.source === "pattern" ? "Usually busy then (their usual week)" : "Marked this slot Busy" });
    }
  }
  return out;
}

/** Someone said they can't make it and is still the only record of cover. */
export function declinedProblems(sessions: readonly ProblemSession[], assignments: readonly ProblemAssignment[], courses: ReadonlyMap<string, ProblemCourse>, instructors: ReadonlyMap<string, ProblemInstructor>): Problem[] {
  const out: Problem[] = [];
  for (const a of assignments) {
    if (a.status !== "declined") continue;
    const first = firstSessionOf(a.courseId, sessions, a);
    if (!first) continue;
    out.push({ kind: "declined", severity: "warn", date: first.date, slot: first.slot, courseId: a.courseId, courseName: courses.get(a.courseId)?.name ?? "Course", sessionId: first.id, instructorId: a.instructorId, instructorName: instructors.get(a.instructorId)?.name ?? "Instructor", detail: "Said they can't make it; find cover or remove them" });
  }
  return out;
}

/** A per-instructor finding (not fit, not qualified, working time, parental permission) applied to each course they are on. */
export function perAssignmentProblems(
  kind: Extract<ProblemKind, "not-fit" | "not-qualified" | "working-time" | "parent-approval">,
  severity: ProblemSeverity,
  sessions: readonly ProblemSession[],
  assignments: readonly ProblemAssignment[],
  courses: ReadonlyMap<string, ProblemCourse>,
  instructors: ReadonlyMap<string, ProblemInstructor>,
  /** detail for an (instructorId, courseId) pair, or null when there is no problem. */
  detailFor: (instructorId: string, course: ProblemCourse) => string | null,
): Problem[] {
  const out: Problem[] = [];
  for (const a of assignments) {
    if (!live(a)) continue;
    const course = courses.get(a.courseId);
    const first = firstSessionOf(a.courseId, sessions, a);
    if (!course || !first) continue;
    const detail = detailFor(a.instructorId, course);
    if (!detail) continue;
    out.push({ kind, severity, date: first.date, slot: first.slot, courseId: a.courseId, courseName: course.name, sessionId: first.id, instructorId: a.instructorId, instructorName: instructors.get(a.instructorId)?.name ?? "Instructor", detail });
  }
  return out;
}

/** Ratio and safety cover per course, dated by its first session in range. */
export function coverageProblems(sessions: readonly ProblemSession[], courses: ReadonlyMap<string, ProblemCourse>, coverage: ReadonlyMap<string, { understaffed: boolean; missingSafetyCover: boolean; assigned: number; required: number }>): Problem[] {
  const out: Problem[] = [];
  const seen = new Set<string>();
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.startAt - b.startAt)) {
    if (seen.has(s.courseId)) continue;
    seen.add(s.courseId);
    const cov = coverage.get(s.courseId);
    if (!cov) continue;
    const name = courses.get(s.courseId)?.name ?? "Course";
    const base = { date: s.date, slot: s.slot, courseId: s.courseId, courseName: name, sessionId: s.id, instructorId: null, instructorName: null };
    if (cov.missingSafetyCover) out.push({ ...base, kind: "no-safety-cover", severity: "block", detail: "Needs safety-boat cover and nobody is rostered for it" });
    if (cov.understaffed) out.push({ ...base, kind: "unstaffed", severity: "warn", detail: cov.required ? `${cov.assigned} of ${cov.required} instructors rostered` : "Nobody rostered" });
  }
  return out;
}

/** Tracked equipment on two overlapping sessions, or booked while in maintenance. */
export function equipmentProblems(
  sessions: readonly ProblemSession[],
  courseEquipment: readonly { courseId: string; equipmentId: string | null }[],
  units: ReadonlyMap<string, { name: string; status: string }>,
  courses: ReadonlyMap<string, ProblemCourse>,
): Problem[] {
  const out: Problem[] = [];
  const byCourse = new Map<string, ProblemSession[]>();
  for (const s of sessions) byCourse.set(s.courseId, [...(byCourse.get(s.courseId) ?? []), s]);
  const bookings: ResourceBooking[] = [];
  const seenMaint = new Set<string>();
  for (const ce of courseEquipment) {
    if (!ce.equipmentId) continue;
    const unit = units.get(ce.equipmentId);
    const mine = byCourse.get(ce.courseId) ?? [];
    for (const s of mine) bookings.push({ sessionId: s.id, resourceId: ce.equipmentId, startAt: s.startAt, endAt: s.endAt, courseId: ce.courseId });
    const first = firstSessionOf(ce.courseId, sessions);
    if (unit && unit.status !== "available" && first && !seenMaint.has(`${ce.courseId}|${ce.equipmentId}`)) {
      seenMaint.add(`${ce.courseId}|${ce.equipmentId}`);
      out.push({ kind: "equipment-maintenance", severity: "warn", date: first.date, slot: first.slot, courseId: ce.courseId, courseName: courses.get(ce.courseId)?.name ?? "Course", sessionId: first.id, instructorId: null, instructorName: null, detail: `${unit.name} is ${unit.status === "retired" ? "retired" : "in maintenance"}` });
    }
  }
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  for (const c of findConflicts(bookings)) {
    const sa = sessionById.get(c.a.sessionId)!;
    const sb = sessionById.get(c.b.sessionId)!;
    const first = sa.startAt <= sb.startAt ? sa : sb;
    const other = first === sa ? sb : sa;
    out.push({ kind: "equipment-clash", severity: "block", date: first.date, slot: first.slot, courseId: first.courseId, courseName: courses.get(first.courseId)?.name ?? "Course", sessionId: first.id, otherCourseId: other.courseId, instructorId: null, instructorName: null, detail: `${units.get(c.resourceId)?.name ?? "A unit"} is also on ${courses.get(other.courseId)?.name ?? "another course"} at the same time` });
  }
  return out;
}

/**
 * Equipment quantities (audit Part E, decision 9): for every date and slot, the
 * units of each type the courses running then need (bulk lines by quantity,
 * tracked units one each) against how many the centre owns. Types with no
 * quantity recorded are never checked. One problem per type per date/slot,
 * attached to the first course that needs it.
 */
export function equipmentShortfalls(
  sessions: readonly ProblemSession[],
  courseEquipment: readonly { courseId: string; equipmentId: string | null; equipmentTypeId: string | null; quantity: number }[],
  unitType: ReadonlyMap<string, string>,
  types: ReadonlyMap<string, { name: string; quantity: number | null }>,
  courses: ReadonlyMap<string, ProblemCourse>,
): Problem[] {
  // Demand per course per type.
  const demand = new Map<string, Map<string, number>>();
  for (const ce of courseEquipment) {
    const typeId = ce.equipmentId ? unitType.get(ce.equipmentId) : ce.equipmentTypeId;
    if (!typeId) continue;
    const per = demand.get(ce.courseId) ?? new Map<string, number>();
    per.set(typeId, (per.get(typeId) ?? 0) + (ce.equipmentId ? 1 : Math.max(1, ce.quantity)));
    demand.set(ce.courseId, per);
  }
  // Sum per date|slot|type across the courses running then (one session per course per slot counts once).
  const slots = new Map<string, { date: string; slot: string; perType: Map<string, { need: number; first: ProblemSession }> }>();
  const seenCourseSlot = new Set<string>();
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.startAt - b.startAt)) {
    const per = demand.get(s.courseId);
    if (!per) continue;
    const csKey = `${s.courseId}|${s.date}|${s.slot}`;
    if (seenCourseSlot.has(csKey)) continue;
    seenCourseSlot.add(csKey);
    const key = `${s.date}|${s.slot}`;
    const bucket = slots.get(key) ?? { date: s.date, slot: s.slot, perType: new Map() };
    for (const [typeId, n] of per) {
      const cur = bucket.perType.get(typeId);
      if (cur) cur.need += n; else bucket.perType.set(typeId, { need: n, first: s });
    }
    slots.set(key, bucket);
  }
  const out: Problem[] = [];
  for (const b of slots.values()) {
    for (const [typeId, { need, first }] of b.perType) {
      const type = types.get(typeId);
      if (!type || type.quantity === null || type.quantity === undefined) continue;
      if (need <= type.quantity) continue;
      out.push({ kind: "equipment-short", severity: "warn", date: b.date, slot: b.slot, courseId: first.courseId, courseName: courses.get(first.courseId)?.name ?? "Course", sessionId: first.id, instructorId: null, instructorName: null, detail: `Courses that ${b.slot} need ${need} × ${type.name}; you have ${type.quantity}` });
    }
  }
  return out;
}

/** One line for a message, a digest row or an app banner. */
export function describeProblem(p: Problem): string {
  const who = p.instructorName ? `${p.instructorName}: ` : "";
  return `${who}${problemLabel(p.kind).toLowerCase()} on ${p.courseName}, ${p.date}${p.slot ? ` ${p.slot}` : ""} (${p.detail})`;
}
