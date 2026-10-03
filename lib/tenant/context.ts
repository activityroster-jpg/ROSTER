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
  /**
   * Ghost Mode: the platform owner viewing this centre read-only and invisibly
   * (see lib/auth/ghost). The repository layer refuses every write for a ghost
   * context, and audit logging is skipped, so the centre never sees the visit.
   */
  readonly ghost?: true;
  /**
   * The centre's free trial has ended and no payment is set up: everything is
   * visible, nothing can be changed (the repository layer refuses writes), and
   * billing stays reachable. See lib/billing/trial.
   */
  readonly readOnly?: "trial" | "overdue";
  /** Trial grace period over: admins are sent to Billing, instructors to /trial-ended. */
  readonly locked?: true;
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

export function isGhostContext(ctx: AnyTenantContext): boolean {
  return !isSystemContext(ctx) && ctx.ghost === true;
}

/** Ghost Mode or a lapsed trial: reads only. */
export function isReadOnlyContext(ctx: AnyTenantContext): boolean {
  return !isSystemContext(ctx) && (ctx.ghost === true || ctx.readOnly != null);
}

export function actorUserId(ctx: AnyTenantContext): string | null {
  return isSystemContext(ctx) ? null : ctx.userId;
}
