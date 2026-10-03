import { getAuth } from "@/lib/auth";
import { getEnv, getRepositories } from "@/lib/cf/bindings";
import type { Organisation } from "@/lib/db/schema";
import { resolveHost } from "./host";
import type { TenantContext } from "./context";
import { GHOST_COOKIE, cookieFromHeader, verifyGhostToken } from "@/lib/auth/ghost";
import { authSecret } from "@/lib/security/secrets";
import { isPlatformAdminEmail } from "@/lib/platform/admin";
import { centreCookieFromHeader, verifyCentreCookie } from "@/lib/auth/centre-cookie";

export type TenantDenial =
  | "unknown-host"
  | "no-such-centre"
  | "suspended"
  | "unauthenticated"
  | "not-a-member";

export type TenantResolution =
  | { ok: true; ctx: TenantContext; organisation: Organisation; sessionId?: string }
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
  const { control } = await getRepositories();

  // The mobile app runs on the apex domain (one origin, so the native bridge
  // works on every page). There the centre comes from a signed "selected
  // centre" cookie instead of the subdomain — still only a hint: the membership
  // check below is what authorises, and the cookie must belong to this user.
  let centreClaims: { organisationId: string; userId: string } | null = null;
  if (host.kind === "apex") {
    centreClaims = await verifyCentreCookie(authSecret(env), centreCookieFromHeader(headers.get("cookie")));
    if (!centreClaims) return { ok: false, reason: "unknown-host" };
  } else if (host.kind !== "tenant") {
    return { ok: false, reason: "unknown-host" };
  }

  const organisation = host.kind === "tenant"
    ? await control.organisationBySlug(host.slug)
    : await control.organisationById(centreClaims!.organisationId);
  const slugHint = host.kind === "tenant" ? host.slug : organisation?.slug ?? "";
  if (!organisation) {
    return { ok: false, reason: "no-such-centre", slug: slugHint };
  }
  if (organisation.status !== "active") {
    return { ok: false, reason: "suspended", slug: slugHint, organisation };
  }

  const auth = await getAuth();
  const authSession = await auth.api.getSession({ headers });
  if (!authSession?.user) {
    return { ok: false, reason: "unauthenticated", slug: slugHint, organisation };
  }
  // A selected-centre cookie issued to a different user is ignored outright.
  if (centreClaims && centreClaims.userId !== authSession.user.id) {
    return { ok: false, reason: "unknown-host" };
  }

  // Ghost Mode: a platform admin holding a valid ghost cookie for THIS org gets
  // a read-only admin context without any membership. The cookie must have been
  // issued to this very user (claims.adminUserId) and must not have expired.
  const ghostClaims = await verifyGhostToken(authSecret(env), cookieFromHeader(headers.get("cookie"), GHOST_COOKIE));
  if (
    ghostClaims &&
    ghostClaims.organisationId === organisation.id &&
    ghostClaims.adminUserId === authSession.user.id &&
    (await isPlatformAdminEmail(authSession.user.email))
  ) {
    const ctx: TenantContext = { organisationId: organisation.id, slug: organisation.slug, userId: authSession.user.id, role: "admin", ghost: true };
    return { ok: true, ctx, organisation, sessionId: authSession.session?.id };
  }

  let membership = await control.membershipFor(authSession.user.id, organisation.id);
  if (membership?.status === "invited") {
    // The invited person is here and signed in (magic link or their own login),
    // which proves they own the invited address — accept the invite now.
    if (await control.acceptInvitedMembership(authSession.user.id, organisation.id)) {
      await control.logSecurityEvent({
        userId: authSession.user.id,
        organisationId: organisation.id,
        kind: "invite_accepted",
        ip: headers.get("cf-connecting-ip"),
        userAgent: headers.get("user-agent")?.slice(0, 300) ?? null,
        country: headers.get("cf-ipcountry"),
      }).catch(() => {});
      membership = { role: membership.role, status: "active" };
    }
  }
  if (!membership || membership.status !== "active") {
    return { ok: false, reason: "not-a-member", slug: slugHint, organisation };
  }

  const ctx: TenantContext = {
    organisationId: organisation.id,
    slug: organisation.slug,
    userId: authSession.user.id,
    role: membership.role,
  };
  return { ok: true, ctx, organisation, sessionId: authSession.session?.id };
}
