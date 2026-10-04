/**
 * Who is on one session (audit A3-3, option B). A course's assignments cover
 * every one of its sessions by default; per-day overrides take one person off
 * a day ("skip") or put someone on a day only ("add"). Pure functions: the
 * service gathers the rows, every reader (roster, PDF, emergency sheet, hours,
 * problems, the app) goes through these so they never disagree.
 */

export interface CourseAssignmentLike {
  id: string;
  courseId: string;
  instructorId: string;
  roleTypeId: string;
  status: string;
}

export interface SessionOverrideLike {
  courseSessionId: string;
  instructorId: string;
  roleTypeId: string;
  mode: "add" | "skip";
}

export interface EffectiveStaffMember {
  instructorId: string;
  roleTypeId: string;
  /** assigned / confirmed / declined for course-level people; "assigned" for a day-only add. */
  status: string;
  /** "course" = on the whole course; "day" = this session only. */
  source: "course" | "day";
  /** The course_staff row behind a course-level member (for confirm / decline / remove). */
  assignmentId: string | null;
}

/** The people on one session, declines included (callers filter when cover is what matters). */
export function effectiveStaff(
  courseAssignments: readonly CourseAssignmentLike[],
  overrides: readonly SessionOverrideLike[],
): EffectiveStaffMember[] {
  const skipped = new Set(overrides.filter((o) => o.mode === "skip").map((o) => o.instructorId));
  const out: EffectiveStaffMember[] = [];
  const seen = new Set<string>();
  for (const a of courseAssignments) {
    if (skipped.has(a.instructorId) || seen.has(a.instructorId)) continue;
    seen.add(a.instructorId);
    out.push({ instructorId: a.instructorId, roleTypeId: a.roleTypeId, status: a.status, source: "course", assignmentId: a.id });
  }
  for (const o of overrides) {
    if (o.mode !== "add" || seen.has(o.instructorId)) continue;
    seen.add(o.instructorId);
    out.push({ instructorId: o.instructorId, roleTypeId: o.roleTypeId, status: "assigned", source: "day", assignmentId: null });
  }
  return out;
}

/** Those who count as cover: everyone effective who has not declined. */
export const coveringStaff = (members: readonly EffectiveStaffMember[]): EffectiveStaffMember[] => members.filter((m) => m.status !== "declined");

/**
 * For every session, who is on it. `assignments` are course-level rows for any
 * course; `overrides` any session's rows. Sessions with neither get an empty list.
 */
export function effectiveStaffBySession<S extends { id: string; courseId: string }>(
  sessions: readonly S[],
  assignments: readonly CourseAssignmentLike[],
  overrides: readonly SessionOverrideLike[],
): Map<string, EffectiveStaffMember[]> {
  const byCourse = new Map<string, CourseAssignmentLike[]>();
  for (const a of assignments) byCourse.set(a.courseId, [...(byCourse.get(a.courseId) ?? []), a]);
  const bySession = new Map<string, SessionOverrideLike[]>();
  for (const o of overrides) bySession.set(o.courseSessionId, [...(bySession.get(o.courseSessionId) ?? []), o]);
  const out = new Map<string, EffectiveStaffMember[]>();
  for (const s of sessions) out.set(s.id, effectiveStaff(byCourse.get(s.courseId) ?? [], bySession.get(s.id) ?? []));
  return out;
}

/** The sessions one instructor is actually on (course-level minus skips, plus day adds), declines excluded. */
export function sessionsFor<S extends { id: string; courseId: string }>(
  instructorId: string,
  sessions: readonly S[],
  assignments: readonly CourseAssignmentLike[],
  overrides: readonly SessionOverrideLike[],
): S[] {
  const by = effectiveStaffBySession(sessions, assignments, overrides);
  return sessions.filter((s) => (by.get(s.id) ?? []).some((m) => m.instructorId === instructorId && m.status !== "declined"));
}
