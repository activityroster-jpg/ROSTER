import { eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { course as courseTable, courseSession as courseSessionTable, courseStaff as courseStaffTable, sessionStaffOverride as overrideTable } from "@/lib/db/schema";
import { liveSessions } from "@/lib/domain/sessions";
import { todayIso } from "@/lib/domain/time";
import { runAtomic } from "@/lib/db/batch";
import { auditStatement } from "./audit";
import { syncHoursForCourse } from "./hours";
import { sessionsForInstructor } from "./session-staff";

export interface UpcomingSession { sessionId: string; courseId: string; courseName: string; date: string; slot: string }

/** The sessions from today on that this person is actually on (course-level and one-day adds), soonest first. */
export async function upcomingSessionsFor(repos: Repositories, ctx: AnyTenantContext, instructorId: string): Promise<UpcomingSession[]> {
  const t = repos.tenant;
  const settings = (await t.orgSettings.list(ctx))[0];
  const today = todayIso(settings?.timezone ?? undefined);
  const sessions = (await sessionsForInstructor(repos, ctx, instructorId)).filter((s) => s.date >= today);
  const courses = await t.course.listIn(ctx, courseTable.id, [...new Set(sessions.map((s) => s.courseId))]);
  const nameOf = new Map(courses.map((c) => [c.id, c.name ?? "Course"]));
  return sessions
    .map((s) => ({ sessionId: s.id, courseId: s.courseId, courseName: nameOf.get(s.courseId) ?? "Course", date: s.date, slot: s.slot }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot));
}

/**
 * Take a leaver off everything from today on. A course that is wholly in the
 * future loses their place on it; a course already under way keeps it for the
 * days they worked, with today's and later days skipped; their one-day adds
 * from today on go. Past days and their pay lines are never touched. One
 * all-or-nothing write, audited; pay lines then follow the roster.
 */
export async function removeFromUpcoming(repos: Repositories, ctx: AnyTenantContext, instructorId: string): Promise<{ sessions: number; courses: number }> {
  const t = repos.tenant;
  const settings = (await t.orgSettings.list(ctx))[0];
  const today = todayIso(settings?.timezone ?? undefined);
  const upcoming = await upcomingSessionsFor(repos, ctx, instructorId);
  if (upcoming.length === 0) return { sessions: 0, courses: 0 };
  const [rows, overrides] = await Promise.all([
    t.courseStaff.list(ctx, eq(courseStaffTable.instructorId, instructorId)),
    t.sessionStaffOverride.list(ctx, eq(overrideTable.instructorId, instructorId)),
  ]);
  const upcomingIds = new Set(upcoming.map((u) => u.sessionId));
  const courseIds = [...new Set(upcoming.map((u) => u.courseId))];
  const allSessions = liveSessions(await t.courseSession.listIn(ctx, courseSessionTable.courseId, courseIds));
  const ops: PromiseLike<unknown>[] = [];

  for (const courseId of courseIds) {
    const row = rows.find((r) => r.courseId === courseId && r.status !== "declined");
    const days = allSessions.filter((s) => s.courseId === courseId);
    if (row && days.every((s) => s.date >= today)) {
      // Wholly in the future: off the course (and any day changes on it).
      ops.push(t.courseStaff.deleteStatement(ctx, row.id));
      for (const o of overrides.filter((o) => days.some((d) => d.id === o.courseSessionId))) ops.push(t.sessionStaffOverride.deleteStatement(ctx, o.id));
      continue;
    }
    for (const s of days.filter((d) => upcomingIds.has(d.id))) {
      const existing = overrides.find((o) => o.courseSessionId === s.id);
      if (existing?.mode === "add") ops.push(t.sessionStaffOverride.deleteStatement(ctx, existing.id));
      else if (row && !existing) ops.push(t.sessionStaffOverride.insertStatement(ctx, { courseSessionId: s.id, instructorId, roleTypeId: row.roleTypeId, mode: "skip", note: "Left the centre" }));
    }
  }
  const audit = auditStatement(repos, ctx, {
    action: "leaver_removed_from_upcoming",
    entity: "instructor",
    entityId: instructorId,
    after: { sessions: upcoming.length, courses: courseIds.length, from: today },
  });
  await runAtomic(repos.db, [...ops, ...(audit ? [audit] : [])]);
  for (const courseId of courseIds) await syncHoursForCourse(repos, ctx, courseId);
  return { sessions: upcoming.length, courses: courseIds.length };
}
