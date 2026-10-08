import { eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import {
  courseSession as courseSessionTable,
  courseStaff as courseStaffTable,
  hoursRecord as hoursRecordTable,
  type CancelPayRule,
  type CourseSession,
} from "@/lib/db/schema";
import { auditStatement } from "./audit";
import { runAtomic } from "@/lib/db/batch";
import { syncHoursForCourse } from "./hours";
import { notifyInstructor } from "./notifications";
import { publishedWeeks, weekOf } from "./roster";

/**
 * Cancelling (weather, no bookings, an instructor off sick) is the everyday
 * reality of a sailing school, so it is a first-class action, not a label:
 * a cancelled session stays on record but leaves the roster, the PDF, the
 * app, the emergency sheet, the clash and young-worker checks and, per the
 * chosen pay rule, payroll; everyone rostered is told. A course whose
 * sessions are all cancelled is a cancelled course. Delete is only for drafts
 * nobody was ever rostered on (see canDeleteCourse).
 */

export { isLive, liveSessions } from "@/lib/domain/sessions";
import { isLive } from "@/lib/domain/sessions";

export interface CancelInput {
  courseId: string;
  /** Which sessions; omit for every live session of the course. */
  sessionIds?: string[];
  reason: string;
  pay: { rule: CancelPayRule; fee?: number | null };
  now?: Date;
}

export interface CancelResult {
  cancelled: number;
  courseCancelled: boolean;
  notified: number;
}

const fmtDates = (dates: string[]) => {
  const d = [...new Set(dates)].sort();
  return d.length === 0 ? "" : d.length === 1 ? d[0]! : `${d[0]} – ${d[d.length - 1]} (${d.length} days)`;
};

export async function cancelSessions(repos: Repositories, ctx: AnyTenantContext, input: CancelInput): Promise<CancelResult> {
  const t = repos.tenant;
  const now = input.now ?? new Date();
  const course = await t.course.findById(ctx, input.courseId);
  if (!course) throw new Error("Course not found");
  const all = await t.courseSession.list(ctx, eq(courseSessionTable.courseId, course.id));
  const wanted = new Set(input.sessionIds ?? all.filter(isLive).map((s) => s.id));
  const targets = all.filter((s) => wanted.has(s.id) && isLive(s));
  if (targets.length === 0) return { cancelled: 0, courseCancelled: Boolean(course.cancelledAt), notified: 0 };

  const reason = input.reason.trim().slice(0, 500);
  const fee = input.pay.rule === "fee" ? Math.max(0, Number(input.pay.fee ?? 0)) : null;
  const targetIds = targets.map((s) => s.id);
  const [records, staff] = await Promise.all([
    t.hoursRecord.listIn(ctx, hoursRecordTable.courseSessionId, targetIds),
    t.courseStaff.list(ctx, eq(courseStaffTable.courseId, course.id)),
  ]);

  // Every change below, and its change-log entry, is written in one batch:
  // a dropped connection can't leave some days cancelled and others not, or
  // days cancelled with their pay lines untouched.
  const ops: PromiseLike<unknown>[] = [];
  for (const s of targets) {
    ops.push(t.courseSession.updateStatement(ctx, s.id, { cancelledAt: now, cancelReason: reason || null, cancelPay: input.pay.rule, cancelFee: fee }));
  }

  // Payroll follows the rule. Approved lines are never changed silently: they get a note to review.
  for (const r of records) {
    if (r.approved) {
      ops.push(t.hoursRecord.updateStatement(ctx, r.id, { note: [r.note, "Session cancelled after this line was approved: review"].filter(Boolean).join(" · ") }));
      continue;
    }
    if (input.pay.rule === "none") {
      if (r.actualMinutes == null && r.overrideMinutes == null && r.overridePay == null) ops.push(t.hoursRecord.deleteStatement(ctx, r.id));
      else ops.push(t.hoursRecord.updateStatement(ctx, r.id, { overridePay: 0, note: [r.note, "Session cancelled: not paid"].filter(Boolean).join(" · ") }));
    } else if (input.pay.rule === "rostered") {
      ops.push(t.hoursRecord.updateStatement(ctx, r.id, { overrideMinutes: r.overrideMinutes ?? r.scheduledMinutes, note: [r.note, "Session cancelled: paid as rostered"].filter(Boolean).join(" · ") }));
    } else {
      ops.push(t.hoursRecord.updateStatement(ctx, r.id, { overridePay: fee ?? 0, note: [r.note, `Session cancelled: cancellation fee`].filter(Boolean).join(" · ") }));
    }
  }

  const remainingLive = all.filter((s) => isLive(s) && !wanted.has(s.id)).length;
  const courseCancelled = remainingLive === 0;
  if (courseCancelled) ops.push(t.course.updateStatement(ctx, course.id, { status: "cancelled", cancelledAt: now, cancelReason: reason || null }));

  const courseName = course.name ?? "a course";
  const dates = fmtDates(targets.map((s) => s.date));
  const audit = auditStatement(repos, ctx, {
    action: courseCancelled ? "cancel_course" : "cancel_session",
    entity: "course",
    entityId: course.id,
    after: { name: courseName, sessions: targets.length, dates, reason, pay: input.pay.rule, fee },
  });
  await runAtomic(repos.db, [...ops, ...(audit ? [audit] : [])]);

  // Tell everyone rostered (declined people already know they're off).
  let notified = 0;
  for (const instructorId of new Set(staff.filter((a) => a.status !== "declined").map((a) => a.instructorId))) {
    const r = await notifyInstructor(repos, ctx, instructorId, {
      title: courseCancelled ? `${courseName} is cancelled` : `${courseName}: ${targets.length === 1 ? targets[0]!.date : `${targets.length} days`} cancelled`,
      body: `${courseCancelled ? "The whole course" : `The session${targets.length === 1 ? "" : "s"} on ${dates}`} has been cancelled${reason ? `: ${reason}` : ""}. You don't need to come in for ${targets.length === 1 ? "it" : "them"}.`,
      email: true,
    });
    if (r) notified++;
  }
  return { cancelled: targets.length, courseCancelled, notified };
}

/** Bring cancelled sessions back (the weather improved). Pay lines are rebuilt from the roster; people are told. */
export async function restoreSessions(repos: Repositories, ctx: AnyTenantContext, courseId: string, sessionIds?: string[]): Promise<{ restored: number }> {
  const t = repos.tenant;
  const course = await t.course.findById(ctx, courseId);
  if (!course) throw new Error("Course not found");
  const all = await t.courseSession.list(ctx, eq(courseSessionTable.courseId, courseId));
  const targets = all.filter((s) => s.cancelledAt && (!sessionIds || sessionIds.includes(s.id)));
  if (targets.length === 0) return { restored: 0 };
  // The restore and its log entry go in one batch; pay lines are then rebuilt from the roster (re-runnable).
  const ops: PromiseLike<unknown>[] = targets.map((s) => t.courseSession.updateStatement(ctx, s.id, { cancelledAt: null, cancelReason: null, cancelPay: null, cancelFee: null }));
  // Lines the cancellation touched carry its note; clear the cancellation overrides so the roster drives them again.
  const records = await t.hoursRecord.listIn(ctx, hoursRecordTable.courseSessionId, targets.map((s) => s.id));
  for (const r of records) {
    if (r.approved) continue;
    if (r.note?.includes("Session cancelled")) ops.push(t.hoursRecord.updateStatement(ctx, r.id, { overrideMinutes: null, overridePay: null, note: r.note.split(" · ").filter((n) => !n.startsWith("Session cancelled")).join(" · ") || null }));
  }
  if (course.cancelledAt || course.status === "cancelled") ops.push(t.course.updateStatement(ctx, courseId, { status: "scheduled", cancelledAt: null, cancelReason: null }));
  const courseName = course.name ?? "a course";
  const dates = fmtDates(targets.map((s) => s.date));
  const audit = auditStatement(repos, ctx, { action: "restore_session", entity: "course", entityId: courseId, after: { name: courseName, sessions: targets.length, dates } });
  await runAtomic(repos.db, [...ops, ...(audit ? [audit] : [])]);
  await syncHoursForCourse(repos, ctx, courseId);
  const staff = await t.courseStaff.list(ctx, eq(courseStaffTable.courseId, courseId));
  const published = await publishedWeeks(repos, ctx);
  if (targets.some((s) => published.has(weekOf(s.date)))) {
    for (const instructorId of new Set(staff.filter((a) => a.status !== "declined").map((a) => a.instructorId))) {
      await notifyInstructor(repos, ctx, instructorId, { title: `${courseName} is back on`, body: `The cancelled session${targets.length === 1 ? "" : "s"} on ${dates} will now run as rostered.`, email: true });
    }
  }
  return { restored: targets.length };
}

export type DeleteVerdict = { ok: true } | { ok: false; reason: string };

/**
 * Delete is for drafts nobody was ever rostered on. Anything with staff, pay
 * lines that were approved or clocked, or a session in a published week must
 * be cancelled instead, so the history and the money stay right.
 */
export async function canDeleteCourse(repos: Repositories, ctx: AnyTenantContext, courseId: string): Promise<DeleteVerdict> {
  const t = repos.tenant;
  const staff = await t.courseStaff.count(ctx, eq(courseStaffTable.courseId, courseId));
  if (staff > 0) return { ok: false, reason: "People are rostered on this course. Cancel it instead, so they're told and the history stays." };
  const sessions = await t.courseSession.list(ctx, eq(courseSessionTable.courseId, courseId));
  if (sessions.length) {
    const published = await publishedWeeks(repos, ctx);
    if (sessions.some((s) => published.has(weekOf(s.date)))) return { ok: false, reason: "This course is in a published week. Cancel it instead." };
    const records = await t.hoursRecord.listIn(ctx, hoursRecordTable.courseSessionId, sessions.map((s) => s.id));
    if (records.some((r) => r.approved || r.actualMinutes != null || r.overrideMinutes != null || r.overridePay != null)) return { ok: false, reason: "Payroll lines for this course have been approved or edited. Cancel it instead." };
  }
  return { ok: true };
}

/** The same test for removing one session: nobody rostered, week not published, nothing approved. */
export async function canRemoveSession(repos: Repositories, ctx: AnyTenantContext, session: CourseSession): Promise<DeleteVerdict> {
  const t = repos.tenant;
  const staff = await t.courseStaff.count(ctx, eq(courseStaffTable.courseId, session.courseId));
  if (staff > 0) return { ok: false, reason: "People are rostered on this course. Cancel the day instead, so they're told." };
  const published = await publishedWeeks(repos, ctx);
  if (published.has(weekOf(session.date))) return { ok: false, reason: "This week is published. Cancel the day instead." };
  const records = await t.hoursRecord.list(ctx, eq(hoursRecordTable.courseSessionId, session.id));
  if (records.some((r) => r.approved || r.actualMinutes != null || r.overrideMinutes != null || r.overridePay != null)) return { ok: false, reason: "A payroll line for this session has been approved or edited. Cancel the day instead." };
  return { ok: true };
}

/**
 * Before a draft course or session is deleted: its untouched pay lines go with
 * it (nothing to pay for), so none are left behind as unexplained "Other".
 */
export async function dropHoursForSessions(repos: Repositories, ctx: AnyTenantContext, sessionIds: string[]): Promise<number> {
  if (sessionIds.length === 0) return 0;
  const records = await repos.tenant.hoursRecord.listIn(ctx, hoursRecordTable.courseSessionId, sessionIds);
  let n = 0;
  for (const r of records) {
    if (r.approved || r.actualMinutes != null || r.overrideMinutes != null || r.overridePay != null) {
      await repos.tenant.hoursRecord.update(ctx, r.id, { note: [r.note, "Session removed after this line was approved or edited: review"].filter(Boolean).join(" · ") });
      continue;
    }
    await repos.tenant.hoursRecord.delete(ctx, r.id);
    n++;
  }
  return n;
}
