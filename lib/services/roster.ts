import { eq, gte } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { courseSession as courseSessionTable, courseStaff as courseStaffTable } from "@/lib/db/schema";
import { weekStart } from "./schedule";
import { emailAdmins } from "./admin-mail";
import { writeAudit } from "./audit";
import { syncHoursForCourse } from "./hours";
import { liveSessions } from "@/lib/domain/sessions";
import { confirmedDays } from "./roster-days";

/** Monday (YYYY-MM-DD) of the week a date falls in. */
export const weekOf = (dateIso: string) => weekStart(new Date(`${dateIso}T00:00:00Z`));

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
    t.courseSession.list(ctx, eq(courseSessionTable.courseId, row.courseId)),
  ]);
  const courseName = course?.name ?? "a course";
  const dates = sessions.map((s) => s.date).sort();
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
  /** Assignments on confirmed roster days (from `fromIso`) nobody has accepted yet. */
  awaiting: number;
  /** Assignments the instructor has declined. */
  declined: number;
  /** Confirmed assignments. */
  confirmed: number;
}

/** Where staff replies stand for confirmed roster days on or after `fromIso`. */
export async function confirmationSummary(repos: Repositories, ctx: AnyTenantContext, fromIso: string): Promise<ConfirmationSummary> {
  const confirmed = await confirmedDays(repos, ctx);
  if (confirmed.size === 0) return { awaiting: 0, declined: 0, confirmed: 0 };
  const sessions = liveSessions(await repos.tenant.courseSession.list(ctx, gte(courseSessionTable.date, fromIso))).filter((s) => confirmed.has(s.date));
  const courseIds = new Set(sessions.map((s) => s.courseId));
  if (courseIds.size === 0) return { awaiting: 0, declined: 0, confirmed: 0 };
  const staff = await repos.tenant.courseStaff.listIn(ctx, courseStaffTable.courseId, [...courseIds]);
  return {
    awaiting: staff.filter((r) => r.status === "assigned").length,
    declined: staff.filter((r) => r.status === "declined").length,
    confirmed: staff.filter((r) => r.status === "confirmed").length,
  };
}
