import { eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import { actorUserId, type AnyTenantContext } from "@/lib/tenant/context";
import { rosterWeek as rosterWeekTable } from "@/lib/db/schema";
import { addDays, weekStart } from "./schedule";
import { notifyInstructor } from "./notifications";
import { emailAdmins } from "./admin-mail";
import { writeAudit } from "./audit";
import { syncHoursForCourse } from "./hours";
import { liveSessions } from "@/lib/domain/sessions";

/** Monday (YYYY-MM-DD) of the week a date falls in. */
export const weekOf = (dateIso: string) => weekStart(new Date(`${dateIso}T00:00:00Z`));

/** Weeks the centre has published (Monday → published timestamp). */
export async function publishedWeeks(repos: Repositories, ctx: AnyTenantContext): Promise<Map<string, Date>> {
  const rows = await repos.tenant.rosterWeek.list(ctx);
  return new Map(rows.filter((r) => r.publishedAt).map((r) => [r.weekStart, r.publishedAt!]));
}

export async function isWeekPublished(repos: Repositories, ctx: AnyTenantContext, dateIso: string): Promise<boolean> {
  const rows = await repos.tenant.rosterWeek.list(ctx, eq(rosterWeekTable.weekStart, weekOf(dateIso)));
  return Boolean(rows[0]?.publishedAt);
}

const fmtMonday = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });

export interface PublishWeekResult {
  weekStart: string;
  publishedAt: Date;
  /** Sessions in the week at the moment of publishing. */
  sessions: number;
  /** Distinct instructors told about it. */
  instructorsNotified: number;
  /** True when the week had been published before (a re-publish). */
  republished: boolean;
}

/**
 * Publish (or re-publish) the roster for the week containing `dateIso`.
 * Until a week is published instructors see nothing for it; publishing makes
 * it visible in the app and asks everyone rostered that week to confirm.
 * Idempotent on the week row (one per org + Monday).
 */
export async function publishWeek(
  repos: Repositories,
  ctx: AnyTenantContext,
  dateIso: string,
  opts: { notify?: boolean } = {},
): Promise<PublishWeekResult> {
  const t = repos.tenant;
  const monday = weekOf(dateIso);
  const sunday = addDays(monday, 7);
  const now = new Date();
  const by = actorUserId(ctx);

  const existing = (await t.rosterWeek.list(ctx, eq(rosterWeekTable.weekStart, monday)))[0];
  const republished = Boolean(existing?.publishedAt);
  if (existing) await t.rosterWeek.update(ctx, existing.id, { publishedAt: now, publishedByUserId: by });
  else await t.rosterWeek.insert(ctx, { weekStart: monday, publishedAt: now, publishedByUserId: by });

  const sessions = liveSessions(await t.courseSession.list(ctx)).filter((s) => s.date >= monday && s.date < sunday);
  const courseIds = new Set(sessions.map((s) => s.courseId));
  let instructorsNotified = 0;
  if (opts.notify !== false && courseIds.size > 0) {
    const staff = (await t.courseStaff.list(ctx)).filter((r) => courseIds.has(r.courseId) && r.status !== "declined");
    const label = fmtMonday(monday);
    for (const instructorId of new Set(staff.map((r) => r.instructorId))) {
      const myCourses = new Set(staff.filter((r) => r.instructorId === instructorId).map((r) => r.courseId));
      const n = sessions.filter((s) => myCourses.has(s.courseId)).length;
      await notifyInstructor(repos, ctx, instructorId, {
        title: `Roster published — week of ${label}`,
        body: `You're on ${n} session${n === 1 ? "" : "s"} that week. Open the app to see them and confirm.`,
        email: true,
      });
      instructorsNotified++;
    }
  }

  await writeAudit(repos, ctx, {
    action: republished ? "republish_week" : "publish_week",
    entity: "roster_week",
    entityId: monday,
    after: { weekStart: monday, sessions: sessions.length, instructorsNotified },
  });
  return { weekStart: monday, publishedAt: now, sessions: sessions.length, instructorsNotified, republished };
}

export type ConfirmResult = { ok: true } | { ok: false; error: string };

/** The instructor confirms they'll be there. Only the assigned instructor may do this. */
export async function confirmAssignment(
  repos: Repositories,
  ctx: AnyTenantContext,
  instructorId: string,
  assignmentId: string,
): Promise<ConfirmResult> {
  const row = await repos.tenant.courseStaff.findById(ctx, assignmentId);
  if (!row || row.instructorId !== instructorId) return { ok: false, error: "That session isn't on your roster." };
  await repos.tenant.courseStaff.update(ctx, assignmentId, {
    status: "confirmed",
    confirmedAt: new Date(),
    declinedAt: null,
    declineNote: null,
  });
  await syncHoursForCourse(repos, ctx, row.courseId);
  await writeAudit(repos, ctx, { action: "confirm_assignment", entity: "course_staff", entityId: assignmentId, after: { instructorId, courseId: row.courseId } });
  return { ok: true };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * The instructor says they can't make it. A short reason is required so the
 * office can find cover; the admins get an email, the assignment stays on the
 * course marked "declined" (the admin decides whether to remove it or post an
 * open shift) and the instructor's scheduled hours for it are dropped.
 */
export async function declineAssignment(
  repos: Repositories,
  ctx: AnyTenantContext,
  instructorId: string,
  assignmentId: string,
  note: string,
): Promise<ConfirmResult> {
  const clean = note.trim().slice(0, 500);
  if (clean.length < 2) return { ok: false, error: "Tell your centre why, so they can find cover." };
  const t = repos.tenant;
  const row = await t.courseStaff.findById(ctx, assignmentId);
  if (!row || row.instructorId !== instructorId) return { ok: false, error: "That session isn't on your roster." };
  await t.courseStaff.update(ctx, assignmentId, {
    status: "declined",
    declinedAt: new Date(),
    declineNote: clean,
    confirmedAt: null,
  });
  await syncHoursForCourse(repos, ctx, row.courseId);

  const [instructor, course, sessions] = await Promise.all([
    t.instructor.findById(ctx, instructorId),
    t.course.findById(ctx, row.courseId),
    t.courseSession.list(ctx),
  ]);
  const courseName = course?.name ?? "a course";
  const dates = sessions.filter((s) => s.courseId === row.courseId).map((s) => s.date).sort();
  const when = dates.length ? ` (${dates[0]}${dates.length > 1 ? ` – ${dates[dates.length - 1]}` : ""})` : "";
  const who = instructor?.name ?? "An instructor";
  await emailAdmins(repos, ctx, {
    subject: `${who} can't make ${courseName}`,
    html: `<p><strong>${esc(who)}</strong> has said they can't make <strong>${esc(courseName)}</strong>${esc(when)}.</p><p>Reason: ${esc(clean)}</p><p>They're still shown on the course as “can't make it” until you remove them or find cover.</p>`,
    path: `/office/courses/${row.courseId}`,
    cta: "Find cover",
  });
  await writeAudit(repos, ctx, { action: "decline_assignment", entity: "course_staff", entityId: assignmentId, after: { instructorId, courseId: row.courseId, note: clean } });
  return { ok: true };
}

export interface ConfirmationSummary {
  /** Assignments in published weeks (from `fromIso`) nobody has answered yet. */
  awaiting: number;
  /** Assignments the instructor has declined. */
  declined: number;
  /** Confirmed assignments. */
  confirmed: number;
}

/** Where confirmations stand for published weeks on or after `fromIso`. */
export async function confirmationSummary(repos: Repositories, ctx: AnyTenantContext, fromIso: string): Promise<ConfirmationSummary> {
  const published = await publishedWeeks(repos, ctx);
  if (published.size === 0) return { awaiting: 0, declined: 0, confirmed: 0 };
  const sessions = liveSessions(await repos.tenant.courseSession.list(ctx)).filter((s) => s.date >= fromIso && published.has(weekOf(s.date)));
  const courseIds = new Set(sessions.map((s) => s.courseId));
  if (courseIds.size === 0) return { awaiting: 0, declined: 0, confirmed: 0 };
  const staff = (await repos.tenant.courseStaff.list(ctx)).filter((r) => courseIds.has(r.courseId));
  return {
    awaiting: staff.filter((r) => r.status === "assigned").length,
    declined: staff.filter((r) => r.status === "declined").length,
    confirmed: staff.filter((r) => r.status === "confirmed").length,
  };
}
