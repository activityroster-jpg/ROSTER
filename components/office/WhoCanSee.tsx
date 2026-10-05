import Link from "next/link";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { describeAccess, type OfficeFeature } from "@/lib/auth/rbac";
import { listOfficeMembers } from "@/lib/services/office-access";

/** The names of everyone who can open this part of the office, with a link to change it (superadmin). */
export async function whoCanSeeText(repos: Repositories, ctx: AnyTenantContext, feature: OfficeFeature): Promise<string> {
  return describeAccess(await listOfficeMembers(repos, ctx), feature).text;
}

export async function WhoCanSee({ repos, ctx, feature, className = "" }: { repos: Repositories; ctx: AnyTenantContext; feature: OfficeFeature; className?: string }) {
  const text = await whoCanSeeText(repos, ctx, feature);
  return (
    <p className={`text-xs text-slate-500 print:hidden ${className}`}>
      <span aria-hidden>👁 </span>{text}{" "}
      <Link href="/office/staff#office-access" className="text-teal hover:underline">Change who has access</Link>
    </p>
  );
}
