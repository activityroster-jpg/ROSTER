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
import { and, gte, lt, courseSessionTable, type CourseAudience, type SlotCode } from "@/lib/db/schema-helpers";
import { liveSessions } from "@/lib/domain/sessions";
import { welfareForRange } from "./welfare";
import { effectiveStaffBySession, coveringStaff } from "@/lib/domain/session-staff";
import { course as courseTable, courseEquipment as courseEquipmentTable, courseLocation as courseLocationTable, courseStaff as courseStaffTable, sessionStaffOverride as overrideTable, type Course, type CourseStaff, type CourseType, roleType as roleTypeSchema } from "@/lib/db/schema";
type RoleType = typeof roleTypeSchema.$inferSelect;
import { inArray } from "drizzle-orm";

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
  const [allSessions, staff, courseEquip] = await Promise.all([
    t.courseSession.list(ctx),
    t.courseStaff.list(ctx),
    t.courseEquipment.list(ctx),
  ]);
  const sessions = liveSessions(allSessions);

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
/** Whole-course cover (ratio and safety boat) for the given courses. Pure. */
function coverageOf(
  courses: readonly Course[],
  courseTypes: readonly CourseType[],
  staffAssignments: readonly CourseStaff[],
  roleTypes: readonly RoleType[],
): Map<string, CourseCoverage> {
  const courseTypeById = new Map(courseTypes.map((c) => [c.id, c]));
  const roleById = new Map(roleTypes.map((r) => [r.id, r]));
  const assignedByCourse = new Map<string, AssignedRole[]>();
  for (const sa of staffAssignments) {
    if (sa.status === "declined") continue; // someone who can't make it doesn't count as cover
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
  return coverageByCourse;
}

/** Cover for just these courses (the Courses page's view), reading only their assignments. */
export async function coverageForCourses(repos: Repositories, ctx: AnyTenantContext, courseIds: readonly string[]): Promise<Map<string, CourseCoverage>> {
  const t = repos.tenant;
  const [courses, courseTypes, staffAssignments, roleTypes] = await Promise.all([
    t.course.listIn(ctx, courseTable.id, courseIds),
    t.courseType.list(ctx),
    t.courseStaff.listIn(ctx, courseStaffTable.courseId, courseIds),
    t.roleType.list(ctx),
  ]);
  return coverageOf(courses, courseTypes, staffAssignments, roleTypes);
}

export async function getWeekSchedule(
  repos: Repositories,
  ctx: AnyTenantContext,
  mondayIso: string,
): Promise<{ sessions: WeekSession[]; coverageByCourse: Map<string, CourseCoverage> }> {
  const t = repos.tenant;
  const weekEnd = addDays(mondayIso, 7);
  // The week's sessions, and only their courses and assignments.
  const [courseTypes, allSessions, roleTypes] = await Promise.all([
    t.courseType.list(ctx),
    t.courseSession.list(ctx, and(gte(courseSessionTable.date, mondayIso), lt(courseSessionTable.date, weekEnd))),
    t.roleType.list(ctx),
  ]);
  const sessions = liveSessions(allSessions);
  const weekCourseIds = [...new Set(allSessions.map((s) => s.courseId))];
  const [courses, staffAssignments] = await Promise.all([
    t.course.listIn(ctx, courseTable.id, weekCourseIds),
    t.courseStaff.listIn(ctx, courseStaffTable.courseId, weekCourseIds),
  ]);

  const courseTypeById = new Map(courseTypes.map((c) => [c.id, c]));
  const roleById = new Map(roleTypes.map((r) => [r.id, r]));

  const coverageByCourse = coverageOf(courses, courseTypes, staffAssignments, roleTypes);

  const sunday = addDays(mondayIso, 7);
  const inWeek = sessions.filter((s) => s.date >= mondayIso && s.date < sunday);
  // Per-day overrides change who is on a given session, so cover is judged per session.
  const overrides = inWeek.length ? await t.sessionStaffOverride.list(ctx, inArray(overrideTable.courseSessionId, inWeek.map((s) => s.id))) : [];
  const staffBySessionId = effectiveStaffBySession(inWeek, staffAssignments, overrides);
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const weekSessions: WeekSession[] = inWeek
    .map((s) => {
      const course = courseById.get(s.courseId);
      const ct = course ? courseTypeById.get(course.courseTypeId) : undefined;
      const members = coveringStaff(staffBySessionId.get(s.id) ?? []).map((m) => { const role = roleById.get(m.roleTypeId); return { instructorId: m.instructorId, countsTowardRatio: role?.countsTowardRatio ?? false, isSafetyCover: role?.isSafetyCover ?? false }; });
      const cov = course ? { courseName: course.name ?? ct?.name ?? "Course", ratio: evaluateRatio({ groupSize: course.capacity, ratio: course.ratio, requiresSafetyBoat: ct?.requiresSafetyBoat ?? false, assigned: members }) } : coverageByCourse.get(s.courseId);
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

export interface SessionEvent {
  id: string;
  courseId: string;
  date: string;
  slot: SlotCode;
  startAt: number;
  endAt: number;
  courseName: string;
  audience: CourseAudience;
}

/**
 * Lightweight session events in a date window, for the courses calendar. Tenant
 * scoped. Returns everything between fromIso (inclusive) and toIso (exclusive).
 */
export async function getSessionEvents(
  repos: Repositories,
  ctx: AnyTenantContext,
  fromIso: string,
  toIso: string,
): Promise<SessionEvent[]> {
  const t = repos.tenant;
  const [allSessions, courseTypes] = await Promise.all([
    t.courseSession.list(ctx, and(gte(courseSessionTable.date, fromIso), lt(courseSessionTable.date, toIso))),
    t.courseType.list(ctx),
  ]);
  const courses = await t.course.listIn(ctx, courseTable.id, allSessions.map((s) => s.courseId));
  const sessions = liveSessions(allSessions);
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const ctById = new Map(courseTypes.map((c) => [c.id, c]));
  return sessions
    .filter((s) => s.date >= fromIso && s.date < toIso)
    .map((s) => {
      const course = courseById.get(s.courseId);
      const ct = course ? ctById.get(course.courseTypeId) : undefined;
      return {
        id: s.id,
        courseId: s.courseId,
        date: s.date,
        slot: s.slot,
        startAt: s.startAt instanceof Date ? s.startAt.getTime() : Number(s.startAt),
        endAt: s.endAt instanceof Date ? s.endAt.getTime() : Number(s.endAt),
        courseName: course?.name ?? ct?.name ?? "Session",
        audience: (ct?.audience ?? "all") as CourseAudience,
      };
    });
}

export interface RotaSession {
  sessionId: string;
  courseId: string;
  slot: SlotCode;
  startAt: number;
  endAt: number;
  courseName: string;
  courseTypeName: string;
  audience: CourseAudience;
  status: string;
  coverageOk: boolean;
  understaffed: boolean;
  missingSafetyCover: boolean;
  staff: { name: string; role: string; status: "assigned" | "confirmed" | "declined"; /** On this day only (a per-day add). */ dayOnly?: boolean; instructorId: string; roleTypeId: string; /** The course_staff row for course-level people; null for a per-day add. */ assignmentId: string | null }[];
  locations: string[];
  /** Equipment on the course, e.g. "Safety RIB 1", "Pico ×2". */
  equipment: string[];
  /** Places on the course (its capacity): the number of students the session is planned for. */
  students: number;
}
export interface RotaDay {
  date: string;
  label: string;
  sessions: RotaSession[];
  /** Welfare officer on duty per slot (a name from Settings), when the centre lists any. */
  welfare?: Partial<Record<SlotCode, string>>;
}

/**
 * A print-ready roster for one week: every session, who is on it (name + role),
 * where (locations / classrooms) and when. All reads tenant scoped; this is the
 * assembled view the office and instructors work from and export as PDF.
 */
export async function getWeekRota(
  repos: Repositories,
  ctx: AnyTenantContext,
  mondayIso: string,
): Promise<RotaDay[]> {
  return getRotaDays(repos, ctx, mondayIso, 7);
}

/** The same assembled roster for any run of consecutive days (a day, a week, a month). */
export async function getRotaDays(
  repos: Repositories,
  ctx: AnyTenantContext,
  fromIso: string,
  dayCount: number,
): Promise<RotaDay[]> {
  const mondayIso = fromIso;
  const t = repos.tenant;
  const allSessions = await t.courseSession.list(ctx, and(gte(courseSessionTable.date, fromIso), lt(courseSessionTable.date, addDays(fromIso, dayCount))));
  // Only the courses running in the range, and their people, places and kit.
  const rangeCourseIds = [...new Set(allSessions.map((s) => s.courseId))];
  const [courses, courseTypes, staffAssignments, roleTypes, instructors, courseLocations, locations, courseEquipment, equipment] =
    await Promise.all([
      t.course.listIn(ctx, courseTable.id, rangeCourseIds),
      t.courseType.list(ctx),
      t.courseStaff.listIn(ctx, courseStaffTable.courseId, rangeCourseIds),
      t.roleType.list(ctx),
      t.instructor.list(ctx),
      t.courseLocation.listIn(ctx, courseLocationTable.courseId, rangeCourseIds),
      t.location.list(ctx),
      t.courseEquipment.listIn(ctx, courseEquipmentTable.courseId, rangeCourseIds),
      t.equipment.list(ctx),
    ]);
  const sessions = liveSessions(allSessions);

  // Whole-course cover for the courses in the range (one read, not one per week).
  const coverageByCourse = coverageOf(courses, courseTypes, staffAssignments, roleTypes);
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const ctById = new Map(courseTypes.map((c) => [c.id, c]));
  const roleName = new Map(roleTypes.map((r) => [r.id, r.name]));
  const instructorName = new Map(instructors.map((i) => [i.id, i.name]));
  const locationName = new Map(locations.map((l) => [l.id, l.name]));

  const roleById = new Map(roleTypes.map((r) => [r.id, r]));
  const locsByCourse = new Map<string, string[]>();
  for (const cl of courseLocations) {
    const arr = locsByCourse.get(cl.courseId) ?? [];
    const n = locationName.get(cl.locationId);
    if (n) arr.push(n);
    locsByCourse.set(cl.courseId, arr);
  }

  const equipmentName = new Map(equipment.map((e) => [e.id, e.identifier ? `${e.name} (${e.identifier})` : e.name]));
  const equipByCourse = new Map<string, string[]>();
  for (const ce of courseEquipment) {
    const n = ce.equipmentId ? equipmentName.get(ce.equipmentId) : undefined;
    if (!n) continue;
    equipByCourse.set(ce.courseId, [...(equipByCourse.get(ce.courseId) ?? []), ce.quantity > 1 ? `${n} ×${ce.quantity}` : n]);
  }

  const sunday = addDays(mondayIso, dayCount);
  const inWeek = sessions.filter((s) => s.date >= mondayIso && s.date < sunday);
  const overrides = inWeek.length ? await t.sessionStaffOverride.list(ctx, inArray(overrideTable.courseSessionId, inWeek.map((s) => s.id))) : [];
  const staffBySessionId = effectiveStaffBySession(inWeek, staffAssignments, overrides);
  const slotRank: Record<SlotCode, number> = { AM: 0, PM: 1, EV: 2 };
  const welfare = await welfareForRange(repos, ctx, mondayIso, sunday);

  const days: RotaDay[] = [];
  for (let i = 0; i < dayCount; i++) {
    const date = addDays(mondayIso, i);
    const label = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
    const daySessions: RotaSession[] = inWeek
      .filter((s) => s.date === date)
      .map((s) => {
        const course = courseById.get(s.courseId);
        const ct = course ? ctById.get(course.courseTypeId) : undefined;
        const members = staffBySessionId.get(s.id) ?? [];
        const assignedRoles = coveringStaff(members).map((m) => { const role = roleById.get(m.roleTypeId); return { instructorId: m.instructorId, countsTowardRatio: role?.countsTowardRatio ?? false, isSafetyCover: role?.isSafetyCover ?? false }; });
        const cov = course ? { ratio: evaluateRatio({ groupSize: course.capacity, ratio: course.ratio, requiresSafetyBoat: ct?.requiresSafetyBoat ?? false, assigned: assignedRoles }) } : coverageByCourse.get(s.courseId);
        return {
          sessionId: s.id,
          courseId: s.courseId,
          slot: s.slot,
          startAt: s.startAt instanceof Date ? s.startAt.getTime() : Number(s.startAt),
          endAt: s.endAt instanceof Date ? s.endAt.getTime() : Number(s.endAt),
          courseName: course?.name ?? ct?.name ?? "Session",
          courseTypeName: ct?.name ?? "—",
          audience: (ct?.audience ?? "all") as CourseAudience,
          status: course?.status ?? "scheduled",
          coverageOk: cov?.ratio.ok ?? true,
          understaffed: cov?.ratio.understaffed ?? false,
          missingSafetyCover: cov?.ratio.missingSafetyCover ?? false,
          staff: members.map((m) => ({ name: instructorName.get(m.instructorId) ?? "—", role: roleName.get(m.roleTypeId) ?? "Staff", status: m.status as "assigned" | "confirmed" | "declined", instructorId: m.instructorId, roleTypeId: m.roleTypeId, assignmentId: m.assignmentId, ...(m.source === "day" ? { dayOnly: true } : {}) })),
          locations: locsByCourse.get(s.courseId) ?? [],
          equipment: equipByCourse.get(s.courseId) ?? [],
          students: course?.capacity ?? 0,
        };
      })
      .sort((a, b) => slotRank[a.slot] - slotRank[b.slot] || a.startAt - b.startAt);
    const w = welfare.byDate.get(date);
    days.push({ date, label, sessions: daySessions, ...(w ? { welfare: w } : {}) });
  }
  return days;
}
