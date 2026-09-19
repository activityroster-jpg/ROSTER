import { getAuth } from "@/lib/auth";
import { getEnv, getRepositories } from "@/lib/cf/bindings";
import type { Organisation } from "@/lib/db/schema";
import { resolveHost } from "./host";
import type { TenantContext } from "./context";

export type TenantDenial =
  | "unknown-host"
  | "no-such-centre"
  | "suspended"
  | "unauthenticated"
  | "not-a-member";

export type TenantResolution =
  | { ok: true; ctx: TenantContext; organisation: Organisation }
  | { ok: false; reason: TenantDenial; slug?: string; organisation?: Organisation };

/**
 * Resolve and AUTHORISE the tenant for a request from its headers.
 *
 * Order matters and every step is server-side:
 *   1. host → slug (a hint only)
 *   2. slug → organisation (must exist and be active)
 *   3. authenticated user (Better Auth session)
 *   4. active membership linking user ↔ org (this is the authorisation)
 *   5. role from membership
 *
 * Any failure returns a typed denial; it never falls back to "allow".
 */
export async function resolveTenant(headers: Headers): Promise<TenantResolution> {
  const env = getEnv();
  const host = resolveHost(headers.get("host"), env.APP_APEX_DOMAIN);

  if (host.kind !== "tenant") {
    return { ok: false, reason: "unknown-host" };
  }

  const { control } = await getRepositories();
  const organisation = await control.organisationBySlug(host.slug);
  if (!organisation) {
    return { ok: false, reason: "no-such-centre", slug: host.slug };
  }
  if (organisation.status !== "active") {
    return { ok: false, reason: "suspended", slug: host.slug, organisation };
  }

  const auth = await getAuth();
  const authSession = await auth.api.getSession({ headers });
  if (!authSession?.user) {
    return { ok: false, reason: "unauthenticated", slug: host.slug, organisation };
  }

  const membership = await control.activeMembership(authSession.user.id, organisation.id);
  if (!membership) {
    return { ok: false, reason: "not-a-member", slug: host.slug, organisation };
  }

  const ctx: TenantContext = {
    organisationId: organisation.id,
    slug: organisation.slug,
    userId: authSession.user.id,
    role: membership.role,
  };
  return { ok: true, ctx, organisation };
}
