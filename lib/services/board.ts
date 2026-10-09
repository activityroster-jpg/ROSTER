import { course as courseTable, courseRoleRequirement as courseRoleRequirementTable, courseSession as courseSessionTable } from "@/lib/db/schema";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { getWeekRota, type RotaDay } from "./schedule";
import { getWeekAvailabilityMatrix } from "./availability";
import { listStaffWithFit, fitReason } from "./staff";
import { getTeachingMatrix } from "./teaching";
import { findProblems, problemLabel, qualificationGap } from "./problems";
import { cleanRoleLines } from "@/lib/domain/staffing";
import { requiredInstructors } from "@/lib/domain/ratio";
import { isUnder18 } from "@/lib/domain/age";
import { addDays } from "./schedule";
import type { EffectiveStatus, AvailabilitySource } from "@/lib/domain/availability";

/** One role still to fill on a session (from the course's role lines, or the ratio when there are none). */
export interface OpenRole { roleTypeId: string; roleName: string; missing: number }

export interface BoardInstructor {
  id: string;
  name: string;
  under18: boolean;
  /** False when licence checks are on and a mandatory check is missing or expired. */
  fit: boolean;
  fitReason: string;
  /** Course type ids this person's qualifications cover (empty = nothing recorded). */
  teaches: string[];
  knownQualifications: boolean;
  /** Effective availability per `${date}|${slot}` for the week. */
  availability: Record<string, { status: EffectiveStatus; source: AvailabilitySource }>;
}

export interface BoardData {
  monday: string;
  days: RotaDay[];
  /** Per session id: roles still open. */
  openRoles: Record<string, OpenRole[]>;
  /** Per session id: course type id and whether the course has more than one session (so "this day only" is offered). */
  sessionMeta: Record<string, {
    courseTypeId: string; multiDay: boolean; courseId: string;
    /** Every role the course needs and how many of each (its role lines, or worked out from the ratio when it has none). */
    needs: { roleTypeId: string; roleName: string; count: number }[];
    /** True when the needs come from the course's own role lines (editable), false when worked out from the ratio. */
    explicitRoles: boolean;
  }>;
  roles: { id: string; name: string; countsTowardRatio: boolean; isSafetyCover: boolean }[];
  instructors: BoardInstructor[];
  problems: Record<string, string[]>;
  /** How many problems this week and how many block. */
  problemCounts: { total: number; blocks: number };
}

/**
 * Everything the roster board needs for one week: the roster itself (through the
 * same assembler as the PDF and the digest), open roles per session, who could
 * fill them with their availability, fit and qualifications for each day, and
 * the week's problems. Tenant scoped; nothing here writes.
 */
export async function getBoard(repos: Repositories, ctx: AnyTenantContext, mondayIso: string): Promise<BoardData> {
  const t = repos.tenant;
  const [days, matrix, staff, teaching, problems, roles, courseTypes, settingsRows] = await Promise.all([
    getWeekRota(repos, ctx, mondayIso),
    getWeekAvailabilityMatrix(repos, ctx, mondayIso),
    listStaffWithFit(repos, ctx),
    getTeachingMatrix(repos, ctx),
    findProblems(repos, ctx, { from: mondayIso, to: addDays(mondayIso, 7) }),
    t.roleType.list(ctx),
    t.courseType.list(ctx),
    t.orgSettings.list(ctx),
  ]);
  // Only this week's courses (and all their sessions, to know which are multi-day): never the whole history.
  const weekCourseIds = [...new Set(days.flatMap((d) => d.sessions.map((s) => s.courseId)))];
  const [courses, requirements, allSessions] = await Promise.all([
    t.course.listIn(ctx, courseTable.id, weekCourseIds),
    t.courseRoleRequirement.listIn(ctx, courseRoleRequirementTable.courseId, weekCourseIds),
    t.courseSession.listIn(ctx, courseSessionTable.courseId, weekCourseIds),
  ]);
  const licenceOn = Boolean(settingsRows[0]?.enforceLicenceChecks);
  const roleById = new Map(roles.map((r) => [r.id, r]));
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const ctById = new Map(courseTypes.map((c) => [c.id, c]));
  const liveCount = new Map<string, number>();
  for (const s of allSessions) if (!s.cancelledAt) liveCount.set(s.courseId, (liveCount.get(s.courseId) ?? 0) + 1);

  const openRoles: Record<string, OpenRole[]> = {};
  const sessionMeta: BoardData["sessionMeta"] = {};
  for (const d of days) {
    for (const s of d.sessions) {
      const course = courseById.get(s.courseId);
      const ct = course ? ctById.get(course.courseTypeId) : undefined;
      const covering = s.staff.filter((m) => m.status !== "declined");
      const lines = cleanRoleLines(requirements.filter((r) => r.courseId === s.courseId));
      const open: OpenRole[] = [];
      const needs: { roleTypeId: string; roleName: string; count: number }[] = [];
      if (lines.length) {
        for (const l of lines) {
          needs.push({ roleTypeId: l.roleTypeId, roleName: roleById.get(l.roleTypeId)?.name ?? "Role", count: l.count });
          const filled = covering.filter((m) => m.roleTypeId === l.roleTypeId).length;
          if (filled < l.count) open.push({ roleTypeId: l.roleTypeId, roleName: roleById.get(l.roleTypeId)?.name ?? "Role", missing: l.count - filled });
        }
      } else if (course) {
        const need = requiredInstructors(course.capacity, course.ratio);
        const counting = covering.filter((m) => roleById.get(m.roleTypeId)?.countsTowardRatio).length;
        const instructorRole = roles.find((r) => r.active && r.countsTowardRatio && !r.isSafetyCover) ?? roles.find((r) => r.active && r.countsTowardRatio);
        if (instructorRole && need > 0) needs.push({ roleTypeId: instructorRole.id, roleName: instructorRole.name, count: need });
        if (instructorRole && counting < need) open.push({ roleTypeId: instructorRole.id, roleName: instructorRole.name, missing: need - counting });
        const safetyRole = roles.find((r) => r.active && r.isSafetyCover);
        if (ct?.requiresSafetyBoat && safetyRole) needs.push({ roleTypeId: safetyRole.id, roleName: safetyRole.name, count: 1 });
        if (ct?.requiresSafetyBoat && safetyRole && !covering.some((m) => roleById.get(m.roleTypeId)?.isSafetyCover)) open.push({ roleTypeId: safetyRole.id, roleName: safetyRole.name, missing: 1 });
      }
      openRoles[s.sessionId] = open;
      sessionMeta[s.sessionId] = { courseTypeId: course?.courseTypeId ?? "", multiDay: (liveCount.get(s.courseId) ?? 0) > 1, courseId: s.courseId, needs, explicitRoles: lines.length > 0 };
    }
  }

  const availByInstructor = new Map(matrix.rows.map((r) => [r.instructorId, r]));
  const instructors: BoardInstructor[] = staff
    .filter((x) => x.instructor.status === "active" && !x.instructor.anonymisedAt && !x.instructor.restrictedAt)
    .map((x) => {
      const row = availByInstructor.get(x.instructor.id);
      const availability: BoardInstructor["availability"] = {};
      if (row) for (const k of Object.keys(row.cells)) availability[k] = { status: row.cells[k]!, source: row.sources[k]! };
      const teaches = (teaching.get(x.instructor.id) ?? []).map((c) => c.courseTypeId);
      return {
        id: x.instructor.id,
        name: x.instructor.name,
        under18: isUnder18(x.instructor.dateOfBirth),
        fit: licenceOn ? x.fit.fit : true,
        fitReason: licenceOn ? fitReason(x.fit) : "",
        teaches,
        knownQualifications: teaches.length > 0,
        availability,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const flags: Record<string, string[]> = {};
  for (const [id, ps] of Object.entries(problems.bySession)) flags[id] = ps.map((p) => `${p.instructorName ? `${p.instructorName}: ` : ""}${problemLabel(p.kind)} (${p.detail})`);

  return {
    monday: mondayIso,
    days,
    openRoles,
    sessionMeta,
    roles: roles.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name, countsTowardRatio: Boolean(r.countsTowardRatio), isSafetyCover: Boolean(r.isSafetyCover) })),
    instructors,
    problems: flags,
    problemCounts: { total: problems.problems.length, blocks: problems.blocks },
  };
}

/** Does this person's teaching list cover the course type? (null = nothing recorded) */
export function boardQualified(i: Pick<BoardInstructor, "teaches" | "knownQualifications">, courseTypeId: string): boolean | null {
  const g = qualificationGap(i.teaches.map((courseTypeId) => ({ courseTypeId })), i.knownQualifications, courseTypeId);
  return g.known ? g.qualified : null;
}
