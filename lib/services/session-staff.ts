import { eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { courseSession as courseSessionTable, courseStaff as courseStaffTable, sessionStaffOverride as overrideTable, type CourseSession, type CourseStaff, type SessionStaffMode, type SessionStaffOverride } from "@/lib/db/schema";
import { effectiveStaffBySession, type EffectiveStaffMember } from "@/lib/domain/session-staff";
import { hasConflict, type ResourceBooking } from "@/lib/domain";
import { effectiveAvailability, blocksRostering, describeBusy } from "@/lib/domain/availability";
import { availabilityHorizon, loadInstructorAvailability } from "./availability";
import { auditStatement } from "./audit";
import { runAtomic } from "@/lib/db/batch";
import { planHoursForCourse } from "./hours";
import { notifyInstructor } from "./notifications";
import { isWeekPublished } from "./roster";
import { liveSessions } from "@/lib/domain/sessions";

export type { EffectiveStaffMember } from "@/lib/domain/session-staff";

const ms = (v: Date | number) => (v instanceof Date ? v.getTime() : Number(v));

/** Overrides for some sessions (or all of the centre's). */
export async function loadOverrides(repos: Repositories, ctx: AnyTenantContext, sessionIds?: readonly string[]): Promise<SessionStaffOverride[]> {
  if (sessionIds && sessionIds.length === 0) return [];
  return sessionIds ? repos.tenant.sessionStaffOverride.listIn(ctx, overrideTable.courseSessionId, sessionIds) : repos.tenant.sessionStaffOverride.list(ctx);
}

/**
 * Who is on each of these sessions, course-level assignments and per-day
 * overrides combined. Pass `assignments` when the caller already has them.
 */
export async function staffBySession(
  repos: Repositories,
  ctx: AnyTenantContext,
  sessions: readonly Pick<CourseSession, "id" | "courseId">[],
  assignments?: readonly CourseStaff[],
): Promise<Map<string, EffectiveStaffMember[]>> {
  const [rows, overrides] = await Promise.all([
    assignments ? Promise.resolve(assignments) : repos.tenant.courseStaff.list(ctx),
    loadOverrides(repos, ctx, sessions.map((s) => s.id)),
  ]);
  return effectiveStaffBySession(sessions, rows, overrides);
}

/** The live sessions one instructor is actually on, across the centre. */
export async function sessionsForInstructor(repos: Repositories, ctx: AnyTenantContext, instructorId: string, sessions?: readonly CourseSession[]): Promise<CourseSession[]> {
  const [mine, overrides] = await Promise.all([
    repos.tenant.courseStaff.list(ctx, eq(courseStaffTable.instructorId, instructorId)),
    repos.tenant.sessionStaffOverride.list(ctx, eq(overrideTable.instructorId, instructorId)),
  ]);
  // Without a list to look in, read only the sessions this person could be on: their courses' and their day adds'.
  const candidates = sessions ?? [
    ...(await repos.tenant.courseSession.listIn(ctx, courseSessionTable.courseId, mine.map((a) => a.courseId))),
    ...(await repos.tenant.courseSession.listIn(ctx, courseSessionTable.id, overrides.filter((o) => o.mode === "add").map((o) => o.courseSessionId))),
  ];
  const all = liveSessions([...new Map(candidates.map((s) => [s.id, s])).values()]);
  const by = effectiveStaffBySession(all, mine, overrides);
  return all.filter((s) => (by.get(s.id) ?? []).some((m) => m.instructorId === instructorId && m.status !== "declined"));
}

export type DayStaffResult = { ok: true; overridden: boolean; warnings: string[] } | { ok: false; error: string };

export interface DayStaffInput {
  sessionId: string;
  instructorId: string;
  roleTypeId: string;
  mode: SessionStaffMode;
  /** Push through a Busy or a clash with a note (recorded). */
  override?: boolean;
  note?: string | null;
}

/**
 * Put someone on one day only ("add") or take them off one day ("skip").
 * An add runs the day's own checks: Busy in availability and a clash with
 * anything else they are on that day (override with a note allowed). Hours
 * follow; the instructor hears if the week is published. Audited.
 */
export async function setDayStaff(repos: Repositories, ctx: AnyTenantContext, input: DayStaffInput): Promise<DayStaffResult> {
  const t = repos.tenant;
  const session = await t.courseSession.findById(ctx, input.sessionId);
  if (!session || session.cancelledAt) return { ok: false, error: "Session not found" };
  const [instructor, role, course] = await Promise.all([t.instructor.findById(ctx, input.instructorId), t.roleType.findById(ctx, input.roleTypeId), t.course.findById(ctx, session.courseId)]);
  if (!instructor || instructor.anonymisedAt || instructor.restrictedAt) return { ok: false, error: "Instructor not found" };
  if (!role || !course) return { ok: false, error: "Role or course not found" };

  const courseRows = await t.courseStaff.list(ctx, eq(courseStaffTable.courseId, session.courseId));
  const onCourse = courseRows.some((a) => a.instructorId === input.instructorId && a.status !== "declined");
  if (input.mode === "skip" && !onCourse) return { ok: false, error: `${instructor.name} isn't on this course, so there is nothing to skip` };
  if (input.mode === "add" && onCourse) return { ok: false, error: `${instructor.name} is already on the whole course` };

  const warnings: string[] = [];
  let overridden = false;
  if (input.mode === "add") {
    const settings = (await t.orgSettings.list(ctx))[0];
    const reasons: string[] = [];
    if (settings?.enforceAvailabilityChecks ?? true) {
      const { index } = await loadInstructorAvailability(repos, ctx, input.instructorId);
      const e = effectiveAvailability(index, availabilityHorizon(settings), session.date, session.slot);
      if (blocksRostering(e)) reasons.push(describeBusy(e, session.date, session.slot));
    }
    if (settings?.enforceConflictChecks ?? false) {
      const others = await sessionsForInstructor(repos, ctx, input.instructorId);
      const bookings: ResourceBooking[] = others.filter((s) => s.id !== session.id).map((s) => ({ sessionId: s.id, resourceId: input.instructorId, startAt: ms(s.startAt), endAt: ms(s.endAt), courseId: s.courseId }));
      if (hasConflict({ sessionId: session.id, resourceId: input.instructorId, startAt: ms(session.startAt), endAt: ms(session.endAt) }, bookings)) reasons.push(`Already on another session at that time (${session.date} ${session.slot})`);
    }
    if (reasons.length && !input.override) return { ok: false, error: reasons.join("; ") };
    overridden = reasons.length > 0;
    if (overridden) warnings.push(...reasons);
  }

  // The day change, its pay lines and its log entry are one batch: all or nothing.
  const existing = (await t.sessionStaffOverride.list(ctx, eq(overrideTable.courseSessionId, session.id))).find((o) => o.instructorId === input.instructorId);
  const values = { courseSessionId: session.id, instructorId: input.instructorId, roleTypeId: input.roleTypeId, mode: input.mode, note: input.note ?? null };
  const write = existing ? t.sessionStaffOverride.updateStatement(ctx, existing.id, { roleTypeId: values.roleTypeId, mode: values.mode, note: values.note }) : t.sessionStaffOverride.insertStatement(ctx, values);
  const hours = await planHoursForCourse(repos, ctx, session.courseId, {
    adjustOverrides: (rows) => [...rows.filter((o) => !(o.courseSessionId === session.id && o.instructorId === input.instructorId)), values],
  });
  const audit = auditStatement(repos, ctx, { action: "set_day_staff", entity: "course_session", entityId: session.id, after: { courseId: session.courseId, date: session.date, instructorId: input.instructorId, roleTypeId: input.roleTypeId, mode: input.mode, overridden, note: input.note ?? null } });
  await runAtomic(repos.db, [write, ...hours.statements, ...(audit ? [audit] : [])]);
  if (await isWeekPublished(repos, ctx, session.date)) {
    await notifyInstructor(repos, ctx, input.instructorId, {
      title: input.mode === "add" ? "Added to a day" : "Taken off a day",
      body: input.mode === "add" ? `You're on ${course.name ?? "a course"} on ${session.date} (${session.slot}).` : `You're no longer needed on ${course.name ?? "a course"} on ${session.date} (${session.slot}); the rest of the course stands.`,
      email: true,
    }).catch(() => {});
  }
  return { ok: true, overridden, warnings };
}

/** Undo a per-day change: the course-level roster applies to that day again. */
export async function clearDayStaff(repos: Repositories, ctx: AnyTenantContext, sessionId: string, instructorId: string): Promise<{ ok: boolean; error?: string }> {
  const t = repos.tenant;
  const session = await t.courseSession.findById(ctx, sessionId);
  if (!session) return { ok: false, error: "Session not found" };
  const row = (await t.sessionStaffOverride.list(ctx, eq(overrideTable.courseSessionId, sessionId))).find((o) => o.instructorId === instructorId);
  if (!row) return { ok: false, error: "Nothing to undo" };
  const hours = await planHoursForCourse(repos, ctx, session.courseId, { adjustOverrides: (rows) => rows.filter((o) => !(o.courseSessionId === sessionId && o.instructorId === instructorId)) });
  const audit = auditStatement(repos, ctx, { action: "clear_day_staff", entity: "course_session", entityId: sessionId, after: { courseId: session.courseId, date: session.date, instructorId, was: row.mode } });
  await runAtomic(repos.db, [t.sessionStaffOverride.deleteStatement(ctx, row.id), ...hours.statements, ...(audit ? [audit] : [])]);
  return { ok: true };
}
