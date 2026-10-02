import Link from "next/link";
import { requireTenant } from "@/lib/tenant/require";
import { getRepositories } from "@/lib/cf/bindings";
import { TwoFactorSetup } from "@/components/office/TwoFactorSetup";
import { RecoveryEmailForm } from "@/components/office/RecoveryEmailForm";

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
        <h2 className="mb-1 font-semibold text-navy">Two-factor authentication</h2>
        <p className="mb-3 text-xs text-slate-500">Add a second step at sign-in — an authenticator app or a code by email.</p>
        <TwoFactorSetup />
      </div>

      <Link href="/office" className="mt-4 text-center text-sm font-semibold text-teal hover:underline">
        Done — go to my dashboard →
      </Link>
    </div>
  );
}
