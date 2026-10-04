import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getRepositories } from "@/lib/cf/bindings";
import type { Organisation } from "@/lib/db/schema";
import { enforcePinGate } from "@/lib/auth/pin-gate";
import { enforceDeviceGate } from "@/lib/auth/device-gate";
import { enforceLoginVerified } from "@/lib/auth/login-gate";
import { GhostReadOnlyError } from "@/lib/auth/ghost";
import { TrialReadOnlyError, type TrialState } from "@/lib/billing/trial";
import { PATH_HEADER } from "@/lib/auth/device";
import type { TenantContext } from "./context";
import { resolveTenant } from "./resolve";
import { can, isOfficeRole, landingFor, type Permission } from "@/lib/auth/rbac";

export interface RequiredTenant {
  ctx: TenantContext;
  organisation: Organisation;
  repos: Awaited<ReturnType<typeof getRepositories>>;
  trial: TrialState;
}

/**
 * For server components / route handlers on a centre subdomain. Resolves and
 * authorises the tenant or redirects appropriately. Never returns an
 * unauthorised context.
 */
/** Paths an admin may still use once the trial has locked: billing, so they can pay. */
const LOCKED_ALLOWED = ["/office/billing", "/api/billing"];

export async function requireTenant(opts?: { role?: "admin"; permission?: Permission; skipMfaGate?: boolean; allowReadOnly?: boolean }): Promise<RequiredTenant> {
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

  // Authorisation: "admin" means admin only; a permission consults the matrix (lib/auth/rbac).
  if (opts?.role === "admin" && res.ctx.role !== "admin") redirect(landingFor(res.ctx.role));
  if (opts?.permission && !can(res.ctx.role, opts.permission)) redirect(landingFor(res.ctx.role));
  const landing = landingFor(res.ctx.role);

  // Ghost Mode is read-only: server actions (every mutation goes through one)
  // are refused outright, before any control-plane side effect could run.
  if (res.ctx.ghost && h.has("next-action")) throw new GhostReadOnlyError();

  // Free trial over: read-only, and after the grace period locked to Billing
  // (admins) or a "trial ended" page (instructors). Billing itself stays usable.
  const path = h.get(PATH_HEADER) ?? "";
  const billing = LOCKED_ALLOWED.some((p) => path.startsWith(p)) || opts?.allowReadOnly === true;
  if (res.ctx.locked && !billing) redirect(res.ctx.role === "admin" ? "/office/billing?locked=1" : isOfficeRole(res.ctx.role) ? "/trial-ended" : "/trial-ended");
  if (res.ctx.readOnly && !billing && h.has("next-action")) throw new TrialReadOnlyError();

  // Centre admins: every office sign-in is email + password, then an emailed
  // code (or their 2FA step), then "stay signed in?". The proof lapses after
  // 12 hours away, or when the browser closes on a "just this once" sign-in,
  // and then the whole sign-in starts again. Ghost Mode is the platform
  // owner looking in from the Dev Center, which has its own gates.
  if (isOfficeRole(res.ctx.role) && !res.ctx.ghost) await enforceLoginVerified(res.sessionId);

  // Unfamiliar device, country or IP → password again first; then the PIN.
  await enforceDeviceGate(res.ctx.userId, landing, res.ctx.organisationId);
  // Office roles and instructors set and enter a 4-digit PIN each session.
  // Parents (read-only rota of their child) sign in with their password only.
  if (res.ctx.role !== "parent") await enforcePinGate(res.ctx.userId, res.sessionId, landing);

  const repos = await getRepositories();

  // Two-factor authentication is OPTIONAL: admins can enable it from /security
  // (authenticator app or email code) but are never forced to. `skipMfaGate` is
  // accepted for backwards compatibility and no longer changes behaviour.
  void opts?.skipMfaGate;

  return { ctx: res.ctx, organisation: res.organisation, repos, trial: res.trial };
}
