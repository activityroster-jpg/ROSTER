import type { Repositories } from "@/lib/db/repositories";
import { actorUserId, isGhostContext, type AnyTenantContext } from "@/lib/tenant/context";
import { noteAuditAction } from "@/lib/security/alerts";

export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

/**
 * Write an audit-log row for a roster/resource/settings/billing change. Every
 * mutation goes through here (CLAUDE.md convention). Tenant scoped like all
 * other writes; the actor is the signed-in user, or null for system actions.
 */
export async function writeAudit(
  repos: Repositories,
  ctx: AnyTenantContext,
  entry: AuditEntry,
): Promise<void> {
  // Ghost Mode is invisible to the centre: nothing is written to its audit log
  // (and the repository would refuse the insert anyway). Owner-side logging
  // happens in lib/security/events.
  if (isGhostContext(ctx)) return;
  await repos.tenant.auditLog.insert(ctx, {
    actorUserId: actorUserId(ctx),
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    before: entry.before === undefined ? null : JSON.stringify(entry.before),
    after: entry.after === undefined ? null : JSON.stringify(entry.after),
  });
  // Unusual volumes of exports are flagged to the platform owner (P1-B); never blocks the action.
  await noteAuditAction(entry.action, ctx.organisationId, ctx.slug).catch(() => {});
}

/**
 * The audit row as a statement, for {@link runAtomic}: the change and its log
 * entry land together or not at all. Null in Ghost Mode (nothing is logged).
 *  */
export function auditStatement(repos: Repositories, ctx: AnyTenantContext, entry: AuditEntry) {
  if (isGhostContext(ctx)) return null;
  return repos.tenant.auditLog.insertStatement(ctx, {
    actorUserId: actorUserId(ctx),
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    before: entry.before === undefined ? null : JSON.stringify(entry.before),
    after: entry.after === undefined ? null : JSON.stringify(entry.after),
  });
}
