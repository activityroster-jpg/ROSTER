import Link from "next/link";
import { cookies, headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getRepositories } from "@/lib/cf/bindings";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { Card } from "@/components/ui";
import { AdminTotpEnrol, AdminTotpVerify } from "@/components/admin/AdminTotp";
import { maskEmail } from "@/lib/security/mask";
import { EVENT_LABEL, WARN_EVENTS, describeAgent } from "@/lib/security/events";
import { authSecret } from "@/lib/security/secrets";
import { TOTP_COOKIE, verifyTotpCookie } from "@/lib/auth/pin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Security" };

/**
 * Dev Center security: authenticator-app enrolment and the per-session code.
 * Exempt from the TOTP gate (see enforceTotpGate) so it can never loop. Once
 * the code has been entered this session it shows the second step's status
 * and recent sign-in events instead, and never sends another code.
 */
export default async function AdminSecurityPage({ searchParams }: { searchParams: Promise<{ next?: string; enrol?: string; verify?: string }> }) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const h = new Headers(await headers());
  const auth = await getAuth();
  const s = await auth.api.getSession({ headers: h });
  const { control } = await getRepositories();
  const me = s?.user ? await control.userById(s.user.id) : null;
  const enrolled = Boolean(me?.twoFactorEnabled);
  const prefs = s?.user ? await control.getTwoFactorPrefs(s.user.id) : null;
  const method = prefs?.method ?? "app";
  const hint = method === "email" && me?.email ? maskEmail(me.email) : null;
  let hasPassword = false;
  try {
    const accounts = await auth.api.listUserAccounts({ headers: h });
    hasPassword = accounts.some((a) => a.providerId === "credential");
  } catch { hasPassword = false; }
  const next = typeof sp.next === "string" ? sp.next : "/admin";
  const verified = Boolean(enrolled && s?.session?.id && await verifyTotpCookie(authSecret(), s.session.id, (await cookies()).get(TOTP_COOKIE)?.value));
  const events = verified && s?.user ? await control.listSecurityEvents(s.user.id, 20) : [];

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 font-display text-2xl font-bold text-navy">Security</h1>
      <p className="mb-6 text-sm text-slate-500">The Dev Center spans every centre, so it needs a second step on top of your password and PIN: an authenticator app or a code by email.</p>

      {!enrolled ? (
        <Card>
          <h2 className="mb-1 font-semibold text-navy">Set up your second step</h2>
          <p className="mb-4 text-xs text-slate-500">One-off. Pick a method, confirm a code, and keep the backup codes somewhere safe.</p>
          <AdminTotpEnrol hasPassword={hasPassword} />
          <p className="mt-4 text-xs text-slate-400">Once this is on, every sign-in with your password asks for a code, and the Dev Center asks once per session.</p>
        </Card>
      ) : verified ? (
        <>
          <Card className="mb-4">
            <h2 className="mb-1 font-semibold text-navy">Second step is on</h2>
            <p className="text-sm text-slate-600">{method === "app" ? "Authenticator app" : `Code by email${hint ? ` to ${hint}` : ""}`}. You&apos;ve entered it for this session, so the Dev Center won&apos;t ask again until you sign in afresh.</p>
            <p className="mt-2 text-xs text-slate-400">Change the method, or see your backup codes, on the <Link href="/security" className="underline">centre security page</Link>.</p>
          </Card>
          <Card>
            <h2 className="mb-1 font-semibold text-navy">Recent sign-in events</h2>
            <p className="mb-3 text-xs text-slate-500">On your own account. Anything you don&apos;t recognise: change your password.</p>
            {events.length === 0 ? <p className="text-sm text-slate-400">Nothing recorded yet.</p> : (
              <ul className="divide-y divide-slate-100 text-sm">
                {events.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 py-2">
                    <div>
                      <span className={WARN_EVENTS.has(e.kind) ? "font-medium text-amber" : "font-medium text-navy"}>{EVENT_LABEL[e.kind] ?? e.kind}</span>
                      <span className="block text-xs text-slate-400">{describeAgent(e.userAgent)}{e.country ? ` · ${e.country}` : ""}</span>
                    </div>
                    <time className="whitespace-nowrap text-xs text-slate-400" dateTime={e.createdAt.toISOString()}>{e.createdAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}</time>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : (
        <Card>
          <h2 className="mb-1 font-semibold text-navy">{method === "app" ? "Enter your authenticator code" : "Enter the code we emailed you"}</h2>
          <p className="mb-4 text-xs text-slate-500">{method === "app" ? "Open your authenticator app and type the current 6-digit code for ActivityRoster." : "It's 6 digits and expires after a few minutes."}</p>
          <AdminTotpVerify next={next} method={method} hint={hint} />
          <p className="mt-4 text-xs text-slate-400">Lost the phone or the inbox? Use a backup code at sign-in, then change your method here. <Link href="/security" className="underline">Centre security page</Link> has the same controls for your own centre.</p>
        </Card>
      )}
      <p className="mt-4 text-center text-xs text-slate-400"><Link href="/admin" className="hover:underline">← Dev Center</Link></p>
    </div>
  );
}
