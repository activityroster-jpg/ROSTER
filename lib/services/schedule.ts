import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import {
  evaluateRatio,
  findConflicts,
  type AssignedRole,
  type Conflict,
  type RatioResult,
  type ResourceBooking,
} from "@/lib/domain";
import type { SlotCode } from "@/lib/db/schema";

export interface CourseCoverage {
  courseId: string;
  courseName: string;
  courseTypeName: string;
  status: string;
  ratio: RatioResult;
}

export interface WeekSession {
  sessionId: string;
  courseId: string;
  courseName: string;
  date: string;
  slot: SlotCode;
  startAt: number;
  endAt: number;
  coverage: RatioResult;
}

/** ISO date (YYYY-MM-DD) for the Monday of the week containing `d`. */
export function weekStart(d: Date): string {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = copy.getUTCDay(); // 0=Sun
  const diff = (day + 6) % 7; // days since Monday
  copy.setUTCDate(copy.getUTCDate() - diff);
  return copy.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function toMs(v: Date | number): number {
  return v instanceof Date ? v.getTime() : Number(v);
}

export interface ScheduleConflicts {
  instructor: Conflict[];
  equipment: Conflict[];
  /** Set of courseIds involved in any conflict, for per-course flagging. */
  courseIds: Set<string>;
}

/**
 * Detect double-bookings across the whole schedule: the same instructor OR the
 * same tracked equipment unit on two overlapping sessions (brief §6). Bulk
 * (untracked) equipment is not unit-conflicted. Pure `findConflicts` does the
 * work; this just builds the bookings from tenant-scoped reads.
 */
export async function getScheduleConflicts(
  repos: Repositories,
  ctx: AnyTenantContext,
): Promise<ScheduleConflicts> {
  const t = repos.tenant;
  const [sessions, staff, courseEquip] = await Promise.all([
    t.courseSession.list(ctx),
    t.courseStaff.list(ctx),
    t.courseEquipment.list(ctx),
  ]);

  const sessionsByCourse = new Map<string, typeof sessions>();
  for (const s of sessions) {
    sessionsByCourse.set(s.courseId, [...(sessionsByCourse.get(s.courseId) ?? []), s]);
  }

  const instructorBookings: ResourceBooking[] = [];
  for (const a of staff) {
    for (const s of sessionsByCourse.get(a.courseId) ?? []) {
      instructorBookings.push({
        sessionId: s.id,
        resourceId: a.instructorId,
        startAt: toMs(s.startAt),
        endAt: toMs(s.endAt),
        courseId: a.courseId,
      });
    }
  }

  const equipmentBookings: ResourceBooking[] = [];
  for (const ce of courseEquip) {
    if (!ce.equipmentId) continue; // only tracked units conflict
    for (const s of sessionsByCourse.get(ce.courseId) ?? []) {
      equipmentBookings.push({
        sessionId: s.id,
        resourceId: ce.equipmentId,
        startAt: toMs(s.startAt),
        endAt: toMs(s.endAt),
        courseId: ce.courseId,
      });
    }
  }

  const instructor = findConflicts(instructorBookings);
  const equipment = findConflicts(equipmentBookings);
  const courseIds = new Set<string>();
  for (const c of [...instructor, ...equipment]) {
    if (c.a.courseId) courseIds.add(c.a.courseId);
    if (c.b.courseId) courseIds.add(c.b.courseId);
  }
  return { instructor, equipment, courseIds };
}

/**
 * Compute coverage (ratio + safety cover) for every course, and the sessions in
 * a given week annotated with that coverage. All reads are tenant scoped; the
 * verdict comes from the pure `evaluateRatio`.
 */
export async function getWeekSchedule(
  repos: Repositories,
  ctx: AnyTenantContext,
  mondayIso: string,
): Promise<{ sessions: WeekSession[]; coverageByCourse: Map<string, CourseCoverage> }> {
  const t = repos.tenant;
  const [courses, courseTypes, sessions, staffAssignments, roleTypes] = await Promise.all([
    t.course.list(ctx),
    t.courseType.list(ctx),
    t.courseSession.list(ctx),
    t.courseStaff.list(ctx),
    t.roleType.list(ctx),
  ]);

  const courseTypeById = new Map(courseTypes.map((c) => [c.id, c]));
  const roleById = new Map(roleTypes.map((r) => [r.id, r]));

  const assignedByCourse = new Map<string, AssignedRole[]>();
  for (const sa of staffAssignments) {
    const role = roleById.get(sa.roleTypeId);
    const arr = assignedByCourse.get(sa.courseId) ?? [];
    arr.push({
      instructorId: sa.instructorId,
      countsTowardRatio: role?.countsTowardRatio ?? false,
      isSafetyCover: role?.isSafetyCover ?? false,
    });
    assignedByCourse.set(sa.courseId, arr);
  }

  const coverageByCourse = new Map<string, CourseCoverage>();
  for (const course of courses) {
    const ct = courseTypeById.get(course.courseTypeId);
    const ratio = evaluateRatio({
      groupSize: course.capacity,
      ratio: course.ratio,
      requiresSafetyBoat: ct?.requiresSafetyBoat ?? false,
      assigned: assignedByCourse.get(course.id) ?? [],
    });
    coverageByCourse.set(course.id, {
      courseId: course.id,
      courseName: course.name ?? ct?.name ?? "Course",
      courseTypeName: ct?.name ?? "—",
      status: course.status,
      ratio,
    });
  }

  const sunday = addDays(mondayIso, 7);
  const weekSessions: WeekSession[] = sessions
    .filter((s) => s.date >= mondayIso && s.date < sunday)
    .map((s) => {
      const cov = coverageByCourse.get(s.courseId);
      return {
        sessionId: s.id,
        courseId: s.courseId,
        courseName: cov?.courseName ?? "Course",
        date: s.date,
        slot: s.slot,
        startAt: s.startAt instanceof Date ? s.startAt.getTime() : Number(s.startAt),
        endAt: s.endAt instanceof Date ? s.endAt.getTime() : Number(s.endAt),
        coverage:
          cov?.ratio ?? { ratioCountingStaff: 0, requiredStaff: 0, understaffed: false, missingSafetyCover: false, ok: true },
      };
    })
    .sort((a, b) => a.startAt - b.startAt);

  return { sessions: weekSessions, coverageByCourse };
}
