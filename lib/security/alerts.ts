import { getEnv } from "@/lib/cf/bindings";
import { sendEmail } from "@/lib/mail";
import { rateLimit } from "./rate-limit";

/**
 * Alerts to the platform owner (compliance P1-B): repeated unusual sign-in
 * activity on one account, and an unusual volume of data exports from one
 * centre. Thresholds are counted in Workers KV; each alert is sent at most
 * once a day per subject so a noisy hour does not become a noisy inbox.
 * Best-effort: never throws into the action that triggered it.
 */
export const FAILURE_KINDS = new Set(["reauth_failed", "pin_failed", "pin_locked", "pin_reset_failed", "join_code_failed"]);
export const EXPORT_ACTIONS = new Set(["data_export", "export_person", "export_audit_log", "view_young_worker_register", "export_rota_pdf", "view_emergency_sheet", "view_protected_contacts"]);
export const SIGNIN_FAILURES_PER_HOUR = 8;
export const EXPORTS_PER_HOUR = 15;

function owners(): string[] {
  return (getEnv().PLATFORM_ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

async function sendOnce(dedupeKey: string, subject: string, html: string): Promise<boolean> {
  try {
    const kv = getEnv().TENANT_CACHE;
    const k = `alert:sent:${dedupeKey}`;
    if (await kv.get(k)) return false;
    await kv.put(k, new Date().toISOString(), { expirationTtl: 24 * 3600 });
    await Promise.all(owners().map((to) => sendEmail({ to, subject, html }).catch(() => {})));
    return true;
  } catch (err) {
    console.error("[alerts] could not send:", (err as Error).message);
    return false;
  }
}

/** Called after a security event is recorded. Counts failures per user per hour. */
export async function noteSecurityEvent(kind: string, userId: string, organisationId?: string | null): Promise<void> {
  if (!FAILURE_KINDS.has(kind)) return;
  try {
    const r = await rateLimit(`alert:fail:${userId}`, SIGNIN_FAILURES_PER_HOUR, 3600);
    if (r.allowed) return;
    await sendOnce(`fail:${userId}`, "ActivityRoster: repeated sign-in failures on one account",
      `<p>One account has had more than ${SIGNIN_FAILURES_PER_HOUR} failed PIN, identity or join-code checks in the last hour.</p><p>User id: <code>${userId}</code>${organisationId ? `<br>Centre id: <code>${organisationId}</code>` : ""}</p><p>Look at Dev Center → Security for the events. If it is an attack, the lockout is already slowing it; consider forgetting the user's trusted devices from their centre page.</p>`);
  } catch { /* best effort */ }
}

/** Called after an audit row is written. Counts export-type actions per centre per hour. */
export async function noteAuditAction(action: string, organisationId: string, slug?: string | null): Promise<void> {
  if (!EXPORT_ACTIONS.has(action)) return;
  try {
    const r = await rateLimit(`alert:export:${organisationId}`, EXPORTS_PER_HOUR, 3600);
    if (r.allowed) return;
    await sendOnce(`export:${organisationId}`, `ActivityRoster: unusual number of exports from ${slug ?? organisationId}`,
      `<p>More than ${EXPORTS_PER_HOUR} data exports or sensitive-record views have come from one centre in the last hour (centre: <code>${slug ?? organisationId}</code>).</p><p>This can be legitimate (a new admin downloading everything) or a sign that an admin account is misused. The centre's change log lists each one with who did it.</p>`);
  } catch { /* best effort */ }
}
