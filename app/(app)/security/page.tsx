import Link from "next/link";
import { requireTenant } from "@/lib/tenant/require";
import { getRepositories } from "@/lib/cf/bindings";
import { TwoFactorSetup } from "@/components/office/TwoFactorSetup";
import { RecoveryEmailForm } from "@/components/office/RecoveryEmailForm";
import { describeAgent } from "@/lib/security/events";
import { TrustedDevices } from "@/components/office/TrustedDevices";
import { maskEmail } from "@/lib/security/mask";

const EVENT_LABEL: Record<string, string> = {
  pin_set: "PIN set",
  pin_reset: "PIN reset",
  pin_reset_failed: "Failed PIN reset attempt",
  pin_failed: "Wrong PIN entered",
  pin_locked: "PIN locked after repeated attempts",
  pin_reset_code_sent: "PIN reset code emailed",
  recovery_email_set: "Recovery email changed",
  password_changed: "Password changed",
  new_device: "Sign-in from a new device",
  reauth_passed: "Identity re-confirmed",
  reauth_failed: "Failed identity check",
  invite_accepted: "Centre invite accepted",
  ghost_start: "Ghost Mode started (platform owner)",
  ghost_end: "Ghost Mode ended (platform owner)",
  two_factor_enabled: "Second step turned on",
  two_factor_disabled: "Second step turned off",
};
const WARN = new Set(["pin_reset_failed", "pin_failed", "pin_locked", "reauth_failed", "new_device"]);

export const dynamic = "force-dynamic";

/**
 * Admin security: recovery email + 2FA setup. Lives outside the office layout so
 * the MFA gate can redirect here without looping. skipMfaGate lets an
 * un-enrolled admin reach it.
 */
export default async function SecurityPage() {
  const { ctx, organisation } = await requireTenant({ role: "admin", skipMfaGate: true });
  const { control } = await getRepositories();
  const me = await control.userById(ctx.userId);
  const recoveryEmail = me?.recoveryEmail ?? null;
  const events = await control.listSecurityEvents(ctx.userId, 12);
  const prefs = await control.getTwoFactorPrefs(ctx.userId);
  const twoFactor = prefs ? {
    enabled: prefs.enabled,
    method: prefs.method,
    hint: prefs.method === "email" && me?.email ? maskEmail(me.email) : null,
  } : undefined;
  const devices = (await control.listTrustedDevices(ctx.userId)).map((d) => ({
    id: d.id,
    device: describeAgent(d.userAgent),
    ip: d.ip,
    country: d.country,
    lastSeen: d.lastSeenAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }),
  }));

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">Security</h1>
      <p className="mb-6 text-sm text-slate-500">
        Keep your access to {organisation.name} safe. We recommend setting a recovery email and adding a second step at sign-in.
      </p>

      <div className="rounded-card border border-slate-200 bg-white p-5">
        <h2 className="mb-1 font-semibold text-navy">Recovery email {recoveryEmail ? null : <span className="ml-1 rounded-full bg-amber/15 px-2 py-0.5 text-xs font-semibold text-amber">Recommended</span>}</h2>
        <p className="mb-3 text-xs text-slate-500">A second address to recover your account if you&apos;re ever locked out.</p>
        <RecoveryEmailForm current={recoveryEmail} />
      </div>

      <div className="mt-5 rounded-card border border-slate-200 bg-white p-5">
        <h2 className="mb-1 font-semibold text-navy">Second step at sign-in</h2>
        <p className="mb-3 text-xs text-slate-500">Choose an authenticator app or a code by email. You&apos;ll be asked for it when you sign in with your password.</p>
        <TwoFactorSetup current={twoFactor} redirectTo="/office" />
      </div>

      <div className="mt-5 rounded-card border border-slate-200 bg-white p-5">
        <h2 className="mb-1 font-semibold text-navy">Confirmed devices</h2>
        <p className="mb-3 text-xs text-slate-500">Signing in from a new device, network or country asks for your password again. These are the ones you&apos;ve confirmed.</p>
        <TrustedDevices rows={devices} />
      </div>

      <div className="mt-5 rounded-card border border-slate-200 bg-white p-5">
        <h2 className="mb-1 font-semibold text-navy">Recent security activity</h2>
        <p className="mb-3 text-xs text-slate-500">PIN, password and recovery-email events on your account. If you see something you don&apos;t recognise, change your password.</p>
        {events.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 py-2">
                <div>
                  <span className={WARN.has(e.kind) ? "font-medium text-amber" : "font-medium text-navy"}>{EVENT_LABEL[e.kind] ?? e.kind}</span>
                  <span className="block text-xs text-slate-400">{describeAgent(e.userAgent)}{e.country ? ` · ${e.country}` : ""}{e.ip ? ` · ${e.ip}` : ""}</span>
                </div>
                <time className="whitespace-nowrap text-xs text-slate-400" dateTime={e.createdAt.toISOString()}>
                  {e.createdAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link href="/office" className="mt-4 text-center text-sm font-semibold text-teal hover:underline">
        Done — go to my dashboard →
      </Link>
    </div>
  );
}
