import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { evaluateRatio, type AssignedRole } from "@/lib/domain";
import { fitReason, listStaffWithFit } from "@/lib/services/staff";
import { getCourseAvailabilityStates } from "@/lib/services/availability";
import { liveSessions } from "@/lib/domain/sessions";
import { getTeachingMatrix } from "@/lib/services/teaching";
import { qualificationGap } from "@/lib/services/problems";

/** Everything the editable CourseCard needs for one course (serialisable). */
export interface CourseEditorData {
  course: { id: string; name: string; courseTypeName: string; status: string; staffRequired: number | null };
  audience: string;
  sessions: { id: string; date: string; startMs: number; endMs: number }[];
  assigned: { id: string; instructorName: string; roleName: string; isOverride: boolean; status: "assigned" | "confirmed" | "declined"; declineNote?: string | null }[];
  instructors: { id: string; name: string; fit: boolean; reason?: string; avail?: string; /** false = their qualifications don't cover this course type; null = nothing recorded for them. */ qualified?: boolean | null }[];
  roles: { id: string; name: string }[];
  ratioOn: boolean;
  ratio?: { ok: boolean; understaffed: boolean; missingSafetyCover: boolean };
  computedRequired?: number;
  roleNeeds?: RoleNeed[];
}

/** One "staff needed" line on a course: how many of a role, and how many filled. */
export interface RoleNeed { roleName: string; count: number; filled: number }

/** Build each course's role-needs lines from its requirements and assignments. */
export function roleNeedsByCourse(
  requirements: { courseId: string; roleTypeId: string; count: number }[],
  assignments: { courseId: string; roleTypeId: string }[],
  roleName: (id: string) => string,
): Map<string, RoleNeed[]> {
  const out = new Map<string, RoleNeed[]>();
  for (const r of requirements) {
    const filled = assignments.filter((a) => a.courseId === r.courseId && a.roleTypeId === r.roleTypeId).length;
    out.set(r.courseId, [...(out.get(r.courseId) ?? []), { roleName: roleName(r.roleTypeId), count: r.count, filled }]);
  }
  return out;
}

const ms = (v: Date | number | string): number => (v instanceof Date ? v.getTime() : Number(v));

/**
 * Assemble the CourseCard props for a single course — the same view the Courses
 * page shows, so a calendar tile can open the identical editor. Tenant scoped
 * throughout; returns null if the course isn't this tenant's.
 */
export async function getCourseEditorData(
  repos: Repositories,
  ctx: AnyTenantContext,
  courseId: string,
): Promise<CourseEditorData | null> {
  const t = repos.tenant;
  const course = await t.course.findById(ctx, courseId);
  if (!course) return null;

  const [courseTypes, sessions, assignments, instructors, roles, settingsRows, staff, availStates, requirements, teaching, quals] = await Promise.all([
    t.courseType.list(ctx),
    t.courseSession.list(ctx).then(liveSessions),
    t.courseStaff.list(ctx),
    t.instructor.list(ctx),
    t.roleType.list(ctx),
    t.orgSettings.list(ctx),
    listStaffWithFit(repos, ctx),
    getCourseAvailabilityStates(repos, ctx),
    t.courseRoleRequirement.list(ctx),
    getTeachingMatrix(repos, ctx),
    t.qualification.list(ctx),
  ]);
  const holdsAny = new Set(quals.map((q) => q.instructorId));
  const qualifiedFor = (instructorId: string): boolean | null => { const g = qualificationGap(teaching.get(instructorId) ?? [], holdsAny.has(instructorId), course.courseTypeId); return g.known ? g.qualified : null; };

  const ct = courseTypes.find((c) => c.id === course.courseTypeId);
  const licenceOn = Boolean(settingsRows[0]?.enforceLicenceChecks);
  const ratioOn = Boolean(settingsRows[0]?.enforceRatioChecks);
  const nameById = new Map(instructors.map((i) => [i.id, i.name]));
  const roleById = new Map(roles.map((r) => [r.id, r]));
  const fitById = new Map(staff.map((s) => [s.instructor.id, s.fit]));
  const avail = availStates.get(course.id);

  const mine = assignments.filter((a) => a.courseId === course.id);
  const assignedRoles: AssignedRole[] = mine.map((a) => {
    const r = roleById.get(a.roleTypeId);
    return { instructorId: a.instructorId, countsTowardRatio: r?.countsTowardRatio ?? false, isSafetyCover: r?.isSafetyCover ?? false };
  });
  const ratio = evaluateRatio({
    groupSize: course.capacity,
    ratio: course.ratio,
    requiresSafetyBoat: ct?.requiresSafetyBoat ?? false,
    assigned: assignedRoles,
  });

  return {
    course: {
      id: course.id,
      name: course.name ?? ct?.name ?? "Course",
      courseTypeName: ct?.name ?? "—",
      status: course.status,
      staffRequired: course.staffRequired ?? null,
    },
    audience: ct?.audience ?? "all",
    sessions: sessions
      .filter((s) => s.courseId === course.id)
      .map((s) => ({ id: s.id, date: s.date, startMs: ms(s.startAt), endMs: ms(s.endAt) }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startMs - b.startMs),
    assigned: mine.map((a) => ({
      id: a.id,
      instructorName: nameById.get(a.instructorId) ?? "Instructor",
      roleName: roleById.get(a.roleTypeId)?.name ?? "role",
      isOverride: Boolean(a.isOverride),
      status: a.status,
      declineNote: a.declineNote,
    })),
    instructors: instructors
      .filter((i) => i.status === "active")
      .map((i) => {
        const f = fitById.get(i.id);
        return {
          id: i.id,
          name: i.name,
          fit: licenceOn ? (f?.fit ?? true) : true,
          reason: licenceOn && f ? fitReason(f) : "",
          avail: avail?.get(i.id) ?? "none",
          qualified: qualifiedFor(i.id),
        };
      }),
    roles: roles.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name })),
    ratioOn,
    ratio: ratioOn ? { ok: ratio.ok, understaffed: ratio.understaffed, missingSafetyCover: ratio.missingSafetyCover } : undefined,
    computedRequired: ratio.requiredStaff,
    roleNeeds: roleNeedsByCourse(
      requirements.filter((r) => r.courseId === course.id),
      mine,
      (id) => roleById.get(id)?.name ?? "Role",
    ).get(course.id),
  };
}
