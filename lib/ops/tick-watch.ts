import { getEnv } from "@/lib/cf/bindings";
import { platformAdminEmails } from "@/lib/platform/admin";
import { sendEmail } from "@/lib/mail";

const LAST_TICK = "ops:last-tick";
const ALERTED = "ops:tick-alert";
/** The hourly job runs at :05 (Cloudflare) and :40 (GitHub backup); over two hours without one means both have stopped. */
export const TICK_OVERDUE_MS = 2 * 60 * 60 * 1000;

/** Called at the end of every hourly tick. Clears any "stopped" alert so the next outage is reported afresh. */
export async function recordTick(now = new Date()): Promise<void> {
  try {
    const kv = getEnv().TENANT_CACHE;
    await kv.put(LAST_TICK, now.toISOString());
    if (await kv.get(ALERTED)) {
      await kv.delete(ALERTED);
      await mailAdmins("✅ The hourly job is running again", `<p>The hourly background job ran again at ${fmt(now)}. Nothing to do.</p>`);
    }
  } catch { /* informational */ }
}

export async function lastTick(): Promise<Date | null> {
  try { const v = await getEnv().TENANT_CACHE.get(LAST_TICK); return v ? new Date(v) : null; } catch { return null; }
}

/** Pure: should we raise the alert now? Not before the first tick has ever been recorded, and only once per outage. */
export function tickOverdue(last: Date | null, alreadyAlerted: boolean, now: Date): boolean {
  if (!last || alreadyAlerted) return false;
  return now.getTime() - last.getTime() > TICK_OVERDUE_MS;
}

/**
 * Run from the two-minute delivery job: if the hourly job hasn't run for two
 * hours, email the platform owner once. Best-effort; never throws.
 */
export async function checkTickHealth(now = new Date()): Promise<"ok" | "alerted" | "already"> {
  try {
    const kv = getEnv().TENANT_CACHE;
    const [last, alerted] = await Promise.all([lastTick(), kv.get(ALERTED)]);
    if (alerted) return "already";
    if (!tickOverdue(last, false, now)) return "ok";
    await kv.put(ALERTED, now.toISOString());
    await mailAdmins("⚠ The hourly job has stopped", `<p>The hourly background job last ran at ${fmt(last!)}. Until it runs again: email retries, the morning digest, invite reminders, retention and outreach are paused. Roster saves and the two-minute delivery of notices still work.</p><p>Check Cloudflare → Workers → roster-tick (Triggers and Logs), and GitHub → Actions → Hourly tick (backup). You'll get another email when it runs again.</p>`);
    return "alerted";
  } catch { return "ok"; }
}

const fmt = (d: Date) => d.toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });
async function mailAdmins(subject: string, html: string) {
  await Promise.all([...platformAdminEmails()].map((to) => sendEmail({ to, subject, html }).catch(() => {})));
}
