import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import type { CourseAudience, roleType as roleTypeSchema } from "@/lib/db/schema";
import type { StaffingRole } from "@/lib/domain/staffing";

type RoleType = typeof roleTypeSchema.$inferSelect;
import { canFillPlace, coursesTaught, defaultPlaceType, fillablePlaces, rulesByCourse, schemeDiscipline, typesForCourse, type TeachingData, type TeachRule, type TypeInfo } from "@/lib/domain/teaching";

export interface TeachableCourse {
  courseTypeId: string;
  name: string;
  audience: CourseAudience;
  category: string | null;
  /** False when only the activity fallback put it there (no course map, tick or staffing rule). */
  explicit: boolean;
}

export interface InstructorTeaching {
  instructorId: string;
  courses: TeachableCourse[];
}

export { schemeDiscipline };

/**
 * Everything "who can teach what" needs, read once: the instructor types, the
 * centre's course map, what each person holds and has been approved for, and
 * which instructor type each place is.
 */
export interface TeachingContext {
  types: Map<string, TypeInfo>;
  rules: TeachRule[];
  rulesByCourse: Map<string, TeachRule[]>;
  /** instructorId → instructor type ids held. */
  held: Map<string, Set<string>>;
  /** instructorId → course type ids approved (the Principal's approval, or a legacy "can teach" tick). */
  approved: Map<string, Set<string>>;
  /** role (place) id → its instructor type id, or null. */
  placeType: Map<string, string | null>;
  places: { id: string; name: string; qualificationTypeId: string | null; countsTowardRatio: boolean; active: boolean }[];
  /** courseTypeId → the activity its scheme belongs to. */
  courseDiscipline: Map<string, string | null>;
}

export async function getTeachingContext(repos: Repositories, ctx: AnyTenantContext): Promise<TeachingContext> {
  const t = repos.tenant;
  const [quals, qualTypes, courseTypes, rows, approvals, roles] = await Promise.all([
    t.qualification.list(ctx),
    t.qualificationType.list(ctx),
    t.courseType.list(ctx),
    t.qualificationCourseType.list(ctx),
    t.instructorCourseType.list(ctx),
    t.roleType.list(ctx),
  ]);
  const types = new Map<string, TypeInfo>(qualTypes.map((q) => [q.id, { id: q.id, name: q.name, discipline: q.discipline ?? null, rank: q.rank, needsSupervision: Boolean(q.needsSupervision), supervises: Boolean(q.supervises) }]));
  const rules: TeachRule[] = rows.map((r) => ({ qualificationTypeId: r.qualificationTypeId, courseTypeId: r.courseTypeId, alsoRequiresTypeId: r.alsoRequiresTypeId ?? null, needsApproval: Boolean(r.needsApproval) }));
  const held = new Map<string, Set<string>>();
  for (const q of quals) held.set(q.instructorId, (held.get(q.instructorId) ?? new Set<string>()).add(q.qualificationTypeId));
  const approved = new Map<string, Set<string>>();
  for (const a of approvals) approved.set(a.instructorId, (approved.get(a.instructorId) ?? new Set<string>()).add(a.courseTypeId));
  return {
    types,
    rules,
    rulesByCourse: rulesByCourse(rules),
    held,
    approved,
    placeType: new Map(roles.map((r) => [r.id, r.qualificationTypeId ?? null])),
    places: roles.map((r) => ({ id: r.id, name: r.name, qualificationTypeId: r.qualificationTypeId ?? null, countsTowardRatio: Boolean(r.countsTowardRatio), active: Boolean(r.active) })),
    courseDiscipline: new Map(courseTypes.map((c) => [c.id, schemeDiscipline(c.scheme)])),
  };
}

/** Can this person fill this place (hold its instructor type, or a higher one on the same ladder)? */
export function canFill(tc: TeachingContext, instructorId: string, roleTypeId: string): boolean {
  return canFillPlace(tc.held.get(instructorId) ?? new Set(), tc.placeType.get(roleTypeId) ?? null, tc.types);
}

/**
 * The place a course's staff default to when the office hasn't set its places:
 * the place for its lead instructor type (Dinghy Instructor for Youth Stage 1,
 * Powerboat Instructor for Level 1). Null when the course has no course map
 * rows or the centre has no such place (the caller then uses a generic place).
 */
export function leadPlaceFor(tc: TeachingContext, courseTypeId: string): string | null {
  const typeId = defaultPlaceType(tc.rulesByCourse.get(courseTypeId), tc.types, tc.courseDiscipline.get(courseTypeId) ?? null);
  if (!typeId) return null;
  return tc.places.find((p) => p.active && p.qualificationTypeId === typeId)?.id ?? null;
}

/**
 * The places that matter for a course, for the short list in a place picker:
 * every place whose instructor type can teach it. Everything else sits behind
 * "Other…".
 */
export function relevantPlacesFor(tc: TeachingContext, courseTypeId: string): string[] {
  const types = typesForCourse(tc.rulesByCourse.get(courseTypeId));
  return tc.places.filter((p) => p.active && p.qualificationTypeId && types.has(p.qualificationTypeId)).map((p) => p.id);
}

/** The centre's places as the staffing rules see them: with each one's instructor type and rank. */
export function staffingRolesOf(roles: readonly RoleType[], tc: Pick<TeachingContext, "types">): StaffingRole[] {
  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    countsTowardRatio: Boolean(r.countsTowardRatio),
    isSafetyCover: Boolean(r.isSafetyCover),
    active: Boolean(r.active),
    qualificationTypeId: r.qualificationTypeId ?? null,
    rank: r.qualificationTypeId ? tc.types.get(r.qualificationTypeId)?.rank ?? 0 : 0,
  }));
}

/** A place as the pickers and their checks need it. */
export interface PickerPlace { id: string; name: string; countsTowardRatio: boolean; qualificationTypeId: string | null; rank: number }

/** The centre's active places for a picker, with each one's instructor type and rank. */
export function pickerPlaces(roles: readonly RoleType[], tc: Pick<TeachingContext, "types">): PickerPlace[] {
  return staffingRolesOf(roles, tc).filter((r) => r.active).map((r) => ({ id: r.id, name: r.name, countsTowardRatio: r.countsTowardRatio, qualificationTypeId: r.qualificationTypeId ?? null, rank: r.rank ?? 0 }));
}

/** The place ids each person can fill. */
export function fillsByInstructor(tc: TeachingContext, instructorIds: readonly string[]): Map<string, string[]> {
  return new Map(instructorIds.map((id) => [id, fillablePlaces(tc.held.get(id) ?? new Set(), tc.places, tc.types)]));
}

/**
 * Work out which course types each instructor can teach (lib/domain/teaching
 * coursesTaught): the course map, else the per-person tick, the older staffing
 * rules, then the activity. Pure data assembly over tenant-scoped reads.
 */
export async function getTeachingMatrix(
  repos: Repositories,
  ctx: AnyTenantContext,
  pre?: TeachingContext,
): Promise<Map<string, TeachableCourse[]>> {
  const t = repos.tenant;
  const [tc, instructors, courseTypes, staffingRules] = await Promise.all([
    pre ? Promise.resolve(pre) : getTeachingContext(repos, ctx),
    t.instructor.list(ctx),
    t.courseType.list(ctx),
    t.courseTypeStaffing.list(ctx),
  ]);

  // Required qualification-type ids per course type (explicit rules, legacy).
  const requiredByType = new Map<string, string[]>();
  for (const r of staffingRules) {
    requiredByType.set(r.courseTypeId, [...(requiredByType.get(r.courseTypeId) ?? []), r.qualificationTypeId]);
  }

  const activeTypes = courseTypes.filter((c) => c.active);
  const forTeaching = activeTypes.map((c) => ({ id: c.id, discipline: schemeDiscipline(c.scheme) }));
  const out = new Map<string, TeachableCourse[]>();
  for (const ins of instructors) {
    const taught = coursesTaught(forTeaching, tc.rulesByCourse, tc.held.get(ins.id) ?? new Set<string>(), tc.approved.get(ins.id) ?? new Set<string>(), tc.types, requiredByType);
    out.set(ins.id, activeTypes.filter((ct) => taught.has(ct.id)).map((ct) => ({ courseTypeId: ct.id, name: ct.name, audience: ct.audience, category: ct.category ?? null, explicit: taught.get(ct.id)! })));
  }
  return out;
}

/**
 * What the instructor-type tick boxes need (setup wizard, adding someone, the
 * staff profile): the active types, the courses the centre runs, the course
 * map and the older staffing rules.
 */
export async function getTeachingData(repos: Repositories, ctx: AnyTenantContext, opts: { includeInactive?: boolean } = {}): Promise<TeachingData> {
  const t = repos.tenant;
  const [qualTypes, courseTypes, rows, staffing] = await Promise.all([
    t.qualificationType.list(ctx),
    t.courseType.list(ctx),
    t.qualificationCourseType.list(ctx),
    t.courseTypeStaffing.list(ctx),
  ]);
  // The setup wizard picks which courses the centre runs, so it gets every listed course (and filters as ticks change).
  const running = courseTypes.filter((c) => c.listed && (opts.includeInactive || c.active));
  const runningIds = new Set(running.map((c) => c.id));
  const rules: TeachRule[] = rows.filter((r) => runningIds.has(r.courseTypeId)).map((r) => ({ qualificationTypeId: r.qualificationTypeId, courseTypeId: r.courseTypeId, alsoRequiresTypeId: r.alsoRequiresTypeId ?? null, needsApproval: Boolean(r.needsApproval) }));
  const relevant = new Set<string>();
  for (const r of rules) { relevant.add(r.qualificationTypeId); if (r.alsoRequiresTypeId) relevant.add(r.alsoRequiresTypeId); }
  return {
    types: qualTypes.filter((q) => q.active).sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)).map((q) => ({ id: q.id, name: q.name, code: q.code, discipline: q.discipline ?? null, rank: q.rank })),
    courses: running.sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, name: c.name, discipline: schemeDiscipline(c.scheme), group: c.category || (c.audience === "youth" ? "Youth" : c.audience === "adult" ? "Adult" : "Courses") })),
    rules,
    staffing: staffing.filter((r) => runningIds.has(r.courseTypeId)).map((r) => ({ courseTypeId: r.courseTypeId, qualificationTypeId: r.qualificationTypeId })),
    relevantTypeIds: [...relevant],
  };
}
