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
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">Secure your admin account</h1>
      <p className="mb-6 text-sm text-slate-500">
        {organisation.name} requires two-factor authentication for admins before you can manage the roster.
      </p>
      <div className="rounded-card border border-slate-200 bg-white p-5">
        <TwoFactorSetup />
      </div>
      <Link href="/portal" className="mt-4 text-center text-sm text-slate-500 hover:text-navy">
        Continue to instructor view instead →
      </Link>
    </div>
  );
}
