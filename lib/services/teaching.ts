import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import type { CourseAudience } from "@/lib/db/schema";
import { roleType as roleTypeSchema } from "@/lib/db/schema";
import type { StaffingRole } from "@/lib/domain/staffing";

type RoleType = typeof roleTypeSchema.$inferSelect;
import { canFillPlace, canTeachByRules, defaultPlaceType, fillablePlaces, rulesByCourse, typesForCourse, type TeachRule, type TypeInfo } from "@/lib/domain/teaching";

export interface TeachableCourse {
  courseTypeId: string;
  name: string;
  audience: CourseAudience;
  category: string | null;
  /** true when a course-type staffing rule matched; false when inferred by discipline. */
  explicit: boolean;
}

export interface InstructorTeaching {
  instructorId: string;
  courses: TeachableCourse[];
}

/** Map a scheme name (RYA, PADI, …) to the qualification discipline that covers it. Used only for a course with no course map rows. */
export function schemeDiscipline(scheme: string | null): string | null {
  const s = (scheme ?? "").toLowerCase();
  if (s.includes("freedive")) return "freediving";
  if (s.includes("efr") || s.includes("first aid")) return "first_aid";
  if (s.includes("padi") || s.includes("scuba") || s.includes("dive") || s.includes("ssi") || s.includes("bsac")) return "diving";
  if (s.includes("windsurf")) return "windsurf";
  if (s.includes("paddleboard") || s.includes("sup")) return "sup";
  if (s.includes("powerboat")) return "powerboat";
  if (s.includes("keelboat")) return "keelboat";
  if (s.includes("motor")) return "motor_cruising";
  if (s.includes("cruising")) return "cruising";
  if (s.includes("shorebased")) return "shorebased";
  if (s.includes("sailability")) return "dinghy";
  if (s.includes("sailing") || s.includes("onboard")) return "dinghy";
  return null;
}

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
 * Work out which course types each instructor can teach. A course with course
 * map rows follows them (lib/domain/teaching). A course without any falls back,
 * in order, to the centre's per-person "can teach" ticks, its explicit staffing
 * rules (every listed qualification required), then the activity of the course
 * against the ladders the person holds. Pure data assembly over tenant-scoped
 * reads.
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
  const out = new Map<string, TeachableCourse[]>();

  for (const ins of instructors) {
    const types = tc.held.get(ins.id) ?? new Set<string>();
    const disc = new Set([...types].map((id) => tc.types.get(id)?.discipline).filter((d): d is string => Boolean(d)));
    const approved = tc.approved.get(ins.id) ?? new Set<string>();
    const teachable: TeachableCourse[] = [];

    for (const ct of activeTypes) {
      let can: boolean;
      let explicit = true;
      const byMap = canTeachByRules(tc.rulesByCourse.get(ct.id), types, approved);
      if (byMap !== null) can = byMap;
      else if (approved.has(ct.id)) can = true;
      else {
        const required = requiredByType.get(ct.id);
        if (required && required.length > 0) can = required.every((qid) => types.has(qid));
        else {
          explicit = false;
          const d = schemeDiscipline(ct.scheme);
          can = d ? disc.has(d) : false;
        }
      }
      if (can) {
        teachable.push({ courseTypeId: ct.id, name: ct.name, audience: ct.audience, category: ct.category ?? null, explicit });
      }
    }
    out.set(ins.id, teachable);
  }

  return out;
}
