import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getRepositories } from "@/lib/cf/bindings";
import type { Organisation } from "@/lib/db/schema";
import { enforcePinGate } from "@/lib/auth/pin-gate";
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

  // Centre admins must pass the 4-digit PIN gate each session; instructors don't.
  if (res.ctx.role === "admin") {
    await enforcePinGate(res.ctx.userId, res.sessionId, "/office");
  }

  const repos = await getRepositories();

  // Two-factor authentication is OPTIONAL: admins can enable it from /security
  // (authenticator app or email code) but are never forced to. `skipMfaGate` is
  // accepted for backwards compatibility and no longer changes behaviour.
  void opts?.skipMfaGate;

  return { ctx: res.ctx, organisation: res.organisation, repos };
}
