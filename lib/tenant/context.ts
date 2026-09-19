import type { MembershipRole } from "@/lib/db/schema";

/**
 * The resolved, authorised tenant context for a request.
 *
 * This is produced ONLY after the server has:
 *   1. resolved the org from the request host (a hint),
 *   2. authenticated the user,
 *   3. confirmed an active membership linking that user to that org,
 *   4. read the user's role in that org.
 *
 * Every tenant repository call takes a TenantContext and injects
 * `organisationId` into every query. There is no other way to reach tenant
 * data. A route that cannot build a TenantContext must deny the request.
 */
export interface TenantContext {
  readonly organisationId: string;
  readonly slug: string;
  readonly userId: string;
  readonly role: MembershipRole;
}

/**
 * A system context for control-plane operations that legitimately act without a
 * signed-in user (Stripe webhook provisioning, seeding). It still carries the
 * org id so tenant repositories can be used during provisioning/seeding, but it
 * must NEVER be constructed from request input — only from a verified webhook or
 * a trusted server job. `system: true` marks it so audit logging can attribute
 * the action correctly.
 */
export interface SystemTenantContext {
  readonly organisationId: string;
  readonly slug: string;
  readonly system: true;
  readonly reason: string;
}

export type AnyTenantContext = TenantContext | SystemTenantContext;

export function isSystemContext(ctx: AnyTenantContext): ctx is SystemTenantContext {
  return (ctx as SystemTenantContext).system === true;
}

export function actorUserId(ctx: AnyTenantContext): string | null {
  return isSystemContext(ctx) ? null : ctx.userId;
}
