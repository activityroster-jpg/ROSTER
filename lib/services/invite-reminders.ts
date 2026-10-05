import type { Database } from "@/lib/db/client";
import type { CloudflareEnv } from "@/lib/cf/bindings";
import { ControlPlaneRepository } from "@/lib/db/repositories/control-plane";
import { sendEmail } from "@/lib/mail";
import { inviteReminderEmail } from "@/lib/mail/invite-email";

const DAY = 24 * 60 * 60 * 1000;

/**
 * One reminder, a day after an invitation, to anyone who hasn't signed in yet
 * (decided 5 Oct). Then nothing more; a re-send from the staff list starts the
 * clock again. The reminder carries no sign-in link: it points at the centre's
 * sign-in page with the address filled in, where a fresh link is one click.
 * Run from the hourly tick.
 */
export async function sweepInviteReminders(db: Database, env: CloudflareEnv, now = new Date()): Promise<{ due: number; sent: number }> {
  const control = new ControlPlaneRepository(db);
  const apex = env.APP_APEX_DOMAIN || "activityroster.com";
  const due = await control.invitesDueReminder(new Date(now.getTime() - DAY));
  let sent = 0;
  for (const r of due) {
    const kind = r.role === "admin" ? "office" : "instructor";
    const signInUrl = `https://${r.slug}.${apex}/sign-in?next=${kind === "office" ? "/office" : "/portal"}&email=${encodeURIComponent(r.email)}`;
    // Mark first, so a failed send never turns into a reminder every hour.
    await control.markInviteReminded(r.userId, r.organisationId);
    try {
      await sendEmail({ to: r.email, ...inviteReminderEmail({ kind, centreName: r.centreName, inviterName: r.invitedByName, signInUrl, email: r.email }) });
      sent++;
    } catch { /* the outbox retries passing failures */ }
  }
  return { due: due.length, sent };
}
