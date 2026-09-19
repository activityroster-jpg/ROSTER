import type { Repositories } from "@/lib/db/repositories";
import { actorUserId, type AnyTenantContext } from "@/lib/tenant/context";

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
  await repos.tenant.auditLog.insert(ctx, {
    actorUserId: actorUserId(ctx),
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    before: entry.before === undefined ? null : JSON.stringify(entry.before),
    after: entry.after === undefined ? null : JSON.stringify(entry.after),
  });
}
