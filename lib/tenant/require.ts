import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getRepositories } from "@/lib/cf/bindings";
import type { Organisation } from "@/lib/db/schema";
import type { TenantContext } from "./context";
import { resolveTenant } from "./resolve";

export interface RequiredTenant {
  ctx: TenantContext;
  organisation: Organisation;
  repos: Awaited<ReturnType<typeof getRepositories>>;
}

/**
 * For server components / route handlers on a centre subdomain. Resolves and
 * authorises the tenant or redirects appropriately. Never returns an
 * unauthorised context.
 */
export async function requireTenant(opts?: { role?: "admin"; skipMfaGate?: boolean }): Promise<RequiredTenant> {
  const h = new Headers(await headers());
  const res = await resolveTenant(h);

  if (!res.ok) {
    switch (res.reason) {
      case "unauthenticated":
        redirect("/sign-in");
      // eslint-disable-next-line no-fallthrough
      case "not-a-member":
        redirect("/no-access");
      // eslint-disable-next-line no-fallthrough
      case "suspended":
        redirect("/suspended");
      // eslint-disable-next-line no-fallthrough
      default:
        redirect("/no-access");
    }
  }

  if (opts?.role === "admin" && res.ctx.role !== "admin") {
    redirect("/portal");
  }

  const repos = await getRepositories();

  // MFA enforcement for admins (brief §8): an admin without 2FA is sent to the
  // security setup page (/security, outside the office layout to avoid a redirect
  // loop) until they enrol. That page passes skipMfaGate.
  if (res.ctx.role === "admin" && !opts?.skipMfaGate) {
    const account = await repos.control.userById(res.ctx.userId);
    if (account && !account.twoFactorEnabled) {
      redirect("/security");
    }
  }

  return { ctx: res.ctx, organisation: res.organisation, repos };
}
