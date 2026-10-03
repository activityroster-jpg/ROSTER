import Link from "next/link";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getRepositories } from "@/lib/cf/bindings";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { Card } from "@/components/ui";
import { AdminTotpEnrol, AdminTotpVerify } from "@/components/admin/AdminTotp";

export const dynamic = "force-dynamic";
export const metadata = { title: "Security" };

/**
 * Dev Center security: authenticator-app enrolment and the per-session code.
 * Exempt from the TOTP gate (see enforceTotpGate) so it can never loop.
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
  let hasPassword = false;
  try {
    const accounts = await auth.api.listUserAccounts({ headers: h });
    hasPassword = accounts.some((a) => a.providerId === "credential");
  } catch { hasPassword = false; }
  const next = typeof sp.next === "string" ? sp.next : "/admin";

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 font-display text-2xl font-bold text-navy">Security</h1>
      <p className="mb-6 text-sm text-slate-500">The Dev Center spans every centre, so it needs an authenticator app on top of your password and PIN.</p>

      {!enrolled ? (
        <Card>
          <h2 className="mb-1 font-semibold text-navy">Set up your authenticator app</h2>
          <p className="mb-4 text-xs text-slate-500">One-off. Scan the code with Google Authenticator, 1Password, Authy or similar, then enter the 6-digit code it shows. Keep the backup codes somewhere safe.</p>
          <AdminTotpEnrol hasPassword={hasPassword} />
          <p className="mt-4 text-xs text-slate-400">Once this is on, every sign-in with your password asks for a code, and the Dev Center asks once per session.</p>
        </Card>
      ) : (
        <Card>
          <h2 className="mb-1 font-semibold text-navy">Enter your authenticator code</h2>
          <p className="mb-4 text-xs text-slate-500">Open your authenticator app and type the current 6-digit code for ActivityRoster.</p>
          <AdminTotpVerify next={next} />
          <p className="mt-4 text-xs text-slate-400">Lost the phone? Use one of your backup codes at sign-in, then re-enrol a new device here.</p>
        </Card>
      )}
      <p className="mt-4 text-center text-xs text-slate-400"><Link href="/admin" className="hover:underline">← Dev Center</Link></p>
    </div>
  );
}
