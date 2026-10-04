import { and, eq, lt } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import type { CloudflareEnv } from "@/lib/cf/bindings";
import type { Repositories } from "@/lib/db/repositories";
import { createRepositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import {
  auditLog as auditLogTable,
  availability as availabilityTable,
  hoursRecord as hoursRecordTable,
  leaveRequest as leaveRequestTable,
  notification as notificationTable,
  timeEntry as timeEntryTable,
  type OrgSettings,
} from "@/lib/db/schema";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { anonymisePerson } from "./person-data";
import { writeAudit } from "./audit";
import { sendEmail, escapeHtml } from "@/lib/mail";

/**
 * Data retention (compliance P1-D, docs/retention.md). Each centre keeps each
 * kind of record for a number of months; the hourly tick runs one sweep per
 * centre per day. Anything past its period enters a 14-day grace window:
 * admins are emailed what will go, and it is deleted (or, for people,
 * anonymised) once the window has passed. Every run is written to the
 * deletion log so it can be replayed after a restore.
 */
export interface RetentionPolicy {
  /** Former staff: months after leaving before the profile is anonymised. */
  staffMonths: number;
  /** Leave requests, by end date. */
  leaveMonths: number;
  /** Clock entries and payroll hours (statutory minimum 6 years). */
  clockMonths: number;
  /** Availability entries, by date. */
  availabilityMonths: number;
  /** In-app notifications. */
  notificationsMonths: number;
  /** Change log (statutory/minimum 3 years; the database refuses earlier deletion). */
  auditMonths: number;
}
export const RETENTION_DEFAULTS: RetentionPolicy = { staffMonths: 12, leaveMonths: 24, clockMonths: 72, availabilityMonths: 12, notificationsMonths: 6, auditMonths: 36 };
export const RETENTION_MIN: RetentionPolicy = { staffMonths: 1, leaveMonths: 1, clockMonths: 72, availabilityMonths: 1, notificationsMonths: 1, auditMonths: 36 };
export const RETENTION_MAX = 120;
export const GRACE_DAYS = 14;
const DAY = 86_400_000;

export function parseRetention(json: string | null | undefined): RetentionPolicy {
  let raw: Partial<Record<keyof RetentionPolicy, unknown>> = {};
  try { raw = json ? (JSON.parse(json) as typeof raw) : {}; } catch { raw = {}; }
  const out = { ...RETENTION_DEFAULTS };
  for (const k of Object.keys(RETENTION_DEFAULTS) as (keyof RetentionPolicy)[]) {
    const n = Number(raw[k]);
    if (Number.isFinite(n)) out[k] = Math.min(RETENTION_MAX, Math.max(RETENTION_MIN[k], Math.round(n)));
  }
  return out;
}

function monthsAgo(now: Date, months: number): Date { const d = new Date(now); d.setUTCMonth(d.getUTCMonth() - months); return d; }
const isoOf = (d: Date) => d.toISOString().slice(0, 10);
const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });

export interface RetentionPlan {
  policy: RetentionPolicy;
  /** Counts of records past their period (in the grace window or overdue). */
  pending: { staff: number; leave: number; clock: number; availability: number; notifications: number; audit: number };
  /** Counts that would be removed by a run right now (past period + grace). */
  due: RetentionPlan["pending"];
  /** Former staff in the window, for the reminder and the profile banner. */
  staffDue: { id: string; name: string; deleteOn: Date; overdue: boolean }[];
}

/** What a sweep would do. Pure reads; used by Settings and the reminder. */
export async function retentionPlan(repos: Repositories, ctx: AnyTenantContext, settings: Pick<OrgSettings, "retention"> | null | undefined, now = new Date()): Promise<RetentionPlan> {
  const t = repos.tenant;
  const policy = parseRetention(settings?.retention);
  const grace = GRACE_DAYS * DAY;
  const cut = (months: number) => monthsAgo(now, months);
  const dueCut = (months: number) => new Date(cut(months).getTime() - grace);

  const instructors = await t.instructor.list(ctx);
  const staffDue = instructors
    .filter((i) => i.status === "inactive" && !i.anonymisedAt && !i.restrictedAt)
    .map((i) => { const left = i.leftAt ?? i.updatedAt; const deleteOn = new Date(monthsAgo(left, -policy.staffMonths).getTime() + grace); return { id: i.id, name: i.name, left, deleteOn }; })
    .filter((x) => x.left.getTime() <= cut(policy.staffMonths).getTime())
    .map((x) => ({ id: x.id, name: x.name, deleteOn: x.deleteOn, overdue: x.deleteOn.getTime() <= now.getTime() }));

  const [leave, clock, hours, avail, notes, audit] = await Promise.all([
    t.leaveRequest.list(ctx, lt(leaveRequestTable.endDate, isoOf(cut(policy.leaveMonths)))),
    t.timeEntry.list(ctx, lt(timeEntryTable.clockInAt, cut(policy.clockMonths))),
    t.hoursRecord.list(ctx, lt(hoursRecordTable.createdAt, cut(policy.clockMonths))),
    t.availability.list(ctx, lt(availabilityTable.date, isoOf(cut(policy.availabilityMonths)))),
    t.notification.list(ctx, lt(notificationTable.createdAt, cut(policy.notificationsMonths))),
    t.auditLog.list(ctx, lt(auditLogTable.createdAt, cut(policy.auditMonths))),
  ]);
  const dueOf = <T,>(rows: T[], when: (r: T) => number, cutoff: Date) => rows.filter((r) => when(r) < cutoff.getTime()).length;
  const pending = { staff: staffDue.length, leave: leave.length, clock: clock.length + hours.length, availability: avail.length, notifications: notes.length, audit: audit.length };
  const due = {
    staff: staffDue.filter((x) => x.overdue).length,
    leave: dueOf(leave, (r) => Date.parse(`${r.endDate}T00:00:00Z`), dueCut(policy.leaveMonths)),
    clock: dueOf(clock, (r) => r.clockInAt.getTime(), dueCut(policy.clockMonths)) + dueOf(hours, (r) => r.createdAt.getTime(), dueCut(policy.clockMonths)),
    availability: dueOf(avail, (r) => Date.parse(`${r.date}T00:00:00Z`), dueCut(policy.availabilityMonths)),
    notifications: dueOf(notes, (r) => r.createdAt.getTime(), dueCut(policy.notificationsMonths)),
    audit: dueOf(audit, (r) => r.createdAt.getTime(), dueCut(policy.auditMonths)),
  };
  return { policy, pending, due, staffDue };
}

/** Delete what is past its period plus the grace window. Idempotent; logged. */
export async function runRetention(repos: Repositories, ctx: AnyTenantContext, settings: Pick<OrgSettings, "retention"> | null | undefined, now = new Date()): Promise<RetentionPlan["due"]> {
  const t = repos.tenant;
  const plan = await retentionPlan(repos, ctx, settings, now);
  const grace = GRACE_DAYS * DAY;
  const dueCut = (months: number) => new Date(monthsAgo(now, months).getTime() - grace);
  const removed = { staff: 0, leave: 0, clock: 0, availability: 0, notifications: 0, audit: 0 };

  for (const s of plan.staffDue.filter((x) => x.overdue)) { const r = await anonymisePerson(repos, ctx, s.id); if (r.ok) removed.staff++; }
  for (const r of await t.leaveRequest.list(ctx, lt(leaveRequestTable.endDate, isoOf(dueCut(plan.policy.leaveMonths))))) { await t.leaveRequest.delete(ctx, r.id); removed.leave++; }
  for (const r of await t.timeEntry.list(ctx, lt(timeEntryTable.clockInAt, dueCut(plan.policy.clockMonths)))) { await t.timeEntry.delete(ctx, r.id); removed.clock++; }
  for (const r of await t.hoursRecord.list(ctx, lt(hoursRecordTable.createdAt, dueCut(plan.policy.clockMonths)))) { await t.hoursRecord.delete(ctx, r.id); removed.clock++; }
  for (const r of await t.availability.list(ctx, lt(availabilityTable.date, isoOf(dueCut(plan.policy.availabilityMonths))))) { await t.availability.delete(ctx, r.id); removed.availability++; }
  for (const r of await t.notification.list(ctx, lt(notificationTable.createdAt, dueCut(plan.policy.notificationsMonths)))) { await t.notification.delete(ctx, r.id); removed.notifications++; }
  for (const r of await t.auditLog.list(ctx, lt(auditLogTable.createdAt, dueCut(plan.policy.auditMonths)))) { try { await t.auditLog.delete(ctx, r.id); removed.audit++; } catch { /* still inside the database's 3-year floor */ } }

  const total = Object.values(removed).reduce((a, b) => a + b, 0);
  if (total > 0) {
    await t.deletionLog.insert(ctx, { subjectKind: "retention", subjectId: isoOf(now), subjectHash: `retention:${isoOf(now)}`, summary: JSON.stringify({ policy: plan.policy, removed }), actorUserId: null });
    await writeAudit(repos, ctx, { action: "retention_run", entity: "org_settings", after: removed });
  }
  return removed;
}

/** The 14-day notice: one email to the centre's admins when something has entered the window, at most once a fortnight. */
export async function sendRetentionReminder(repos: Repositories, ctx: AnyTenantContext, env: CloudflareEnv, settings: OrgSettings, now = new Date()): Promise<boolean> {
  const plan = await retentionPlan(repos, ctx, settings, now);
  const inWindow = Object.values(plan.pending).reduce((a, b) => a + b, 0);
  if (inWindow === 0) return false;
  if (settings.retentionReminderAt && now.getTime() - settings.retentionReminderAt.getTime() < GRACE_DAYS * DAY) return false;
  const org = await repos.control.organisationById(ctx.organisationId);
  const admins = await repos.control.adminEmailsForOrg(ctx.organisationId);
  if (!org || admins.length === 0) return false;
  const apex = env.APP_APEX_DOMAIN || "activityroster.com";
  const lines: string[] = [];
  if (plan.staffDue.length) lines.push(`<li><strong>${plan.staffDue.length}</strong> former staff profile${plan.staffDue.length === 1 ? "" : "s"} will be anonymised (name, contact details, certificates and files removed; roster and payroll history kept): ${plan.staffDue.slice(0, 10).map((s) => `${escapeHtml(s.name)} on ${fmt(s.deleteOn)}`).join(", ")}${plan.staffDue.length > 10 ? "…" : ""}. To keep someone, open their profile and press <em>Keep for another ${plan.policy.staffMonths} months</em>.</li>`);
  const simple: [string, number, number][] = [["leave requests", plan.pending.leave, plan.policy.leaveMonths], ["clock and payroll records", plan.pending.clock, plan.policy.clockMonths], ["availability entries", plan.pending.availability, plan.policy.availabilityMonths], ["notifications", plan.pending.notifications, plan.policy.notificationsMonths], ["change-log entries", plan.pending.audit, plan.policy.auditMonths]];
  for (const [label, n, months] of simple) if (n) lines.push(`<li><strong>${n}</strong> ${label} older than ${months} months will be deleted.</li>`);
  const html = `<p>Hello,</p><p>Under ${escapeHtml(org.name)}'s data retention settings, the following will be removed over the next ${GRACE_DAYS} days:</p><ul>${lines.join("")}</ul><p>Nothing has gone yet. If you need any of it, download your data first (Settings → Export your data) or change the periods under Settings → Data retention: <a href="https://${org.slug}.${apex}/office/settings#retention">https://${org.slug}.${apex}/office/settings#retention</a>.</p>`;
  await Promise.all(admins.map((to) => sendEmail({ to, subject: `${org.name}: data due for deletion in ${GRACE_DAYS} days`, html }).catch(() => {})));
  await repos.tenant.orgSettings.update(ctx, settings.id, { retentionReminderAt: now });
  return true;
}

/** Hourly tick: for each active centre, once a day, send the reminder if needed and run the sweep. */
export async function sweepRetention(db: Database, env: CloudflareEnv, now = new Date()): Promise<{ centres: number; ran: number; reminded: number; platform: Record<string, number> }> {
  const platform = new PlatformRepository(db);
  const repos = createRepositories(db);
  const orgs = (await platform.listOrganisations()).filter((o) => o.status === "active" || o.status === "pending");
  let ran = 0, reminded = 0;
  for (const org of orgs) {
    const ctx: AnyTenantContext = { organisationId: org.id, slug: org.slug, system: true, reason: "retention sweep" };
    const settings = (await repos.tenant.orgSettings.list(ctx))[0];
    if (!settings) continue;
    if (settings.retentionRanAt && now.getTime() - settings.retentionRanAt.getTime() < DAY) continue;
    try {
      if (await sendRetentionReminder(repos, ctx, env, settings, now)) reminded++;
      await runRetention(repos, ctx, settings, now);
      await repos.tenant.orgSettings.update(ctx, settings.id, { retentionRanAt: now });
      ran++;
    } catch (err) {
      console.error(`[retention] ${org.slug}:`, (err as Error).message);
    }
  }
  // Platform-side records (docs/retention.md): 12 months for security events, devices and error reports; 3 years after closure for privacy requests.
  const twelve = monthsAgo(now, 12), thirtySix = monthsAgo(now, 36);
  const platformCounts: Record<string, number> = {};
  try {
    const sec = await repos.control.purgeSecurityData(twelve);
    platformCounts.securityEvents = sec.events; platformCounts.trustedDevices = sec.devices;
    platformCounts.errorReports = await platform.purgeErrorReports(twelve);
    platformCounts.privacyRequests = await platform.purgeClosedPrivacyRequests(thirtySix);
  } catch (err) { console.error("[retention] platform:", (err as Error).message); }
  return { centres: orgs.length, ran, reminded, platform: platformCounts };
}

export { and, eq };
