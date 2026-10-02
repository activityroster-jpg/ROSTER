import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getRepositories } from "@/lib/cf/bindings";
import type { Organisation } from "@/lib/db/schema";
import { enforcePinGate } from "@/lib/auth/pin-gate";
import { enforceDeviceGate } from "@/lib/auth/device-gate";
import { GhostReadOnlyError } from "@/lib/auth/ghost";
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

  // Ghost Mode is read-only: server actions (every mutation goes through one)
  // are refused outright, before any control-plane side effect could run.
  if (res.ctx.ghost && h.has("next-action")) throw new GhostReadOnlyError();

  // Unfamiliar device, country or IP → password again first; then the PIN.
  const landing = res.ctx.role === "admin" ? "/office" : "/portal";
  await enforceDeviceGate(res.ctx.userId, landing, res.ctx.organisationId);
  // Everyone must set and enter their 4-digit PIN each session — admins land
  // back in the office, instructors in their portal.
  await enforcePinGate(res.ctx.userId, res.sessionId, res.ctx.role === "admin" ? "/office" : "/portal");

  const repos = await getRepositories();

  // Two-factor authentication is OPTIONAL: admins can enable it from /security
  // (authenticator app or email code) but are never forced to. `skipMfaGate` is
  // accepted for backwards compatibility and no longer changes behaviour.
  void opts?.skipMfaGate;

  return { ctx: res.ctx, organisation: res.organisation, repos };
}
