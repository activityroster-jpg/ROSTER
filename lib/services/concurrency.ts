import { and, eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { auditLog as auditLogTable } from "@/lib/db/schema";

/**
 * "Someone else changed this" (audit follow-up, 5 Oct). An edit form carries
 * the record's last-changed time from when it was opened; if the record has
 * changed since, the save is refused rather than silently overwriting the
 * other person's change. The message names who and when, from the change log.
 */
export function isStale(currentUpdatedAt: Date | number | null | undefined, expectedMs: number | null | undefined): boolean {
  if (expectedMs == null || currentUpdatedAt == null) return false;
  const cur = currentUpdatedAt instanceof Date ? currentUpdatedAt.getTime() : Number(currentUpdatedAt);
  return cur > expectedMs;
}

export async function staleEditMessage(
  repos: Repositories,
  ctx: AnyTenantContext,
  ref: { entity: string; id: string; updatedAt: Date | number | null | undefined; expected: number | null | undefined },
): Promise<string | null> {
  if (!isStale(ref.updatedAt, ref.expected)) return null;
  const rows = await repos.tenant.auditLog.list(ctx, and(eq(auditLogTable.entity, ref.entity), eq(auditLogTable.entityId, ref.id)));
  const last = rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  const at = new Date(last?.createdAt ?? ref.updatedAt ?? Date.now()).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
  const me = "userId" in ctx ? ctx.userId : null;
  if (last?.actorUserId && last.actorUserId === me) return `This was changed in another window at ${at}. Reload to see that change, then make yours.`;
  const name = last?.actorUserId ? (await repos.control.userById(last.actorUserId))?.name ?? null : null;
  return `${name ?? "Someone else"} changed this at ${at}, after you opened it. Reload to see their change, then make yours.`;
}
