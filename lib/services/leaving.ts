import type { Database } from "@/lib/db/client";
import type { CloudflareEnv } from "@/lib/cf/bindings";
import { ControlPlaneRepository } from "@/lib/db/repositories/control-plane";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import type { Organisation, OrgStatus } from "@/lib/db/schema";
import { sendEmail, escapeHtml } from "@/lib/mail";

/**
 * Leaving a centre (compliance P0-A: "90-day export, deletion, written
 * confirmation"). When a centre is suspended or cancelled its admins get a
 * written confirmation with the export link and the deletion date; a reminder
 * goes 14 days before; when the 90 days are up the platform owner is told and
 * erases the centre by hand from the Dev Center. Nothing is deleted
 * automatically: production data is only ever removed by a person.
 */
export const LEAVING_DAYS = 90;
export const LEAVING_REMINDER_DAYS = 14;
const DAY = 86_400_000;

export const isLeavingStatus = (s: OrgStatus | string): boolean => s === "suspended" || s === "cancelled";

export function leavingDeadline(org: Pick<Organisation, "status" | "statusChangedAt">): Date | null {
  if (!isLeavingStatus(org.status) || !org.statusChangedAt) return null;
  return new Date(org.statusChangedAt.getTime() + LEAVING_DAYS * DAY);
}

const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });

function platformAdmins(env: CloudflareEnv): string[] {
  return (env.PLATFORM_ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/**
 * Called by the Dev Center when a centre's status changes. Stamps the change
 * and, when the centre is leaving, sends the written confirmation.
 */
export async function onOrganisationStatusChanged(db: Database, env: CloudflareEnv, org: Organisation, previous: OrgStatus, now = new Date()): Promise<{ notified: boolean }> {
  const control = new ControlPlaneRepository(db);
  if (org.status === previous) return { notified: false };
  await control.updateOrganisation(org.id, { statusChangedAt: now, leavingReminderSentAt: null, leavingDueNotifiedAt: null });
  if (!isLeavingStatus(org.status)) return { notified: false };

  const deadline = new Date(now.getTime() + LEAVING_DAYS * DAY);
  const apex = env.APP_APEX_DOMAIN || "activityroster.com";
  const exportUrl = `https://${org.slug}.${apex}/office/settings`;
  const admins = await control.adminEmailsForOrg(org.id);
  const html = `
    <p>Hello,</p>
    <p>This confirms that <strong>${escapeHtml(org.name)}</strong> on ActivityRoster is now <strong>${org.status}</strong>.</p>
    <p><strong>Your data stays available to export until ${fmt(deadline)}.</strong> Sign in and go to Settings → Export your data to download everything as a file: <a href="${exportUrl}">${exportUrl}</a>. The centre is read-only in the meantime.</p>
    <p>After that date the centre and all its records (staff, courses, rosters, documents and the change log) are permanently deleted, and we will confirm by email when it is done. If you would like it deleted sooner, or you change your mind, reply to this email.</p>
    <p>Thank you for using ActivityRoster.</p>`;
  const to = [...new Set([...admins, ...platformAdmins(env)])];
  await Promise.all(to.map((email) => sendEmail({ to: email, subject: `${org.name}: your data is available until ${fmt(deadline)}`, html }).catch(() => {})));
  return { notified: to.length > 0 };
}

/** Hourly sweep: the 14-day reminder, then the "90 days are up" note to the platform owner. */
export async function sweepLeaving(db: Database, env: CloudflareEnv, now = new Date()): Promise<{ checked: number; reminded: number; due: number }> {
  const platform = new PlatformRepository(db);
  const control = new ControlPlaneRepository(db);
  const orgs = (await platform.listOrganisations()).filter((o) => isLeavingStatus(o.status) && o.statusChangedAt);
  const apex = env.APP_APEX_DOMAIN || "activityroster.com";
  let reminded = 0, due = 0;
  for (const org of orgs) {
    const deadline = leavingDeadline(org)!;
    const msLeft = deadline.getTime() - now.getTime();
    if (msLeft <= LEAVING_REMINDER_DAYS * DAY && msLeft > 0 && !org.leavingReminderSentAt) {
      const admins = await control.adminEmailsForOrg(org.id);
      const exportUrl = `https://${org.slug}.${apex}/office/settings`;
      const html = `<p>Hello,</p><p>A reminder that <strong>${escapeHtml(org.name)}</strong>'s data on ActivityRoster will be permanently deleted on <strong>${fmt(deadline)}</strong>, ${Math.ceil(msLeft / DAY)} days from now.</p><p>If you still want a copy, download it before then from Settings → Export your data: <a href="${exportUrl}">${exportUrl}</a>. If you'd like to keep the centre, reply to this email.</p>`;
      await Promise.all(admins.map((email) => sendEmail({ to: email, subject: `${org.name}: data deleted in ${Math.ceil(msLeft / DAY)} days`, html }).catch(() => {})));
      await control.updateOrganisation(org.id, { leavingReminderSentAt: now });
      reminded++;
    }
    if (msLeft <= 0 && !org.leavingDueNotifiedAt) {
      const html = `<p><strong>${escapeHtml(org.name)}</strong> (${escapeHtml(org.slug)}) has been ${org.status} for ${LEAVING_DAYS} days; the export window closed on ${fmt(deadline)}.</p><p>Nothing is deleted automatically. When you are ready, open the centre in the Dev Center and use "Erase this centre", then reply to the centre's admins confirming it is done.</p><p><a href="https://${apex}/admin/centres/${org.id}">https://${apex}/admin/centres/${org.id}</a></p>`;
      await Promise.all(platformAdmins(env).map((email) => sendEmail({ to: email, subject: `Ready to erase: ${org.name}`, html }).catch(() => {})));
      await control.updateOrganisation(org.id, { leavingDueNotifiedAt: now });
      due++;
    }
  }
  return { checked: orgs.length, reminded, due };
}
