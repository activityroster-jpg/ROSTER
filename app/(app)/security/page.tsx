import Link from "next/link";
import { requireTenant } from "@/lib/tenant/require";
import { TwoFactorSetup } from "@/components/office/TwoFactorSetup";

export const dynamic = "force-dynamic";

/**
 * Admin 2FA setup. Lives outside the office layout so the MFA gate can redirect
 * here without looping. skipMfaGate lets an un-enrolled admin reach it.
 */
export default async function SecurityPage() {
  const { organisation } = await requireTenant({ role: "admin", skipMfaGate: true });

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">Add two-factor authentication</h1>
      <p className="mb-6 text-sm text-slate-500">
        Optional, but recommended for {organisation.name}. Add a second step at sign-in — an authenticator app or a
        code by email. You can enable or change this anytime from Settings.
      </p>
      <div className="rounded-card border border-slate-200 bg-white p-5">
        <TwoFactorSetup />
      </div>
      <Link href="/office" className="mt-4 text-center text-sm font-semibold text-teal hover:underline">
        Skip for now — go to my dashboard →
      </Link>
    </div>
  );
}
