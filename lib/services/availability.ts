import { and, eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { availability as availabilityTable, type SlotCode } from "@/lib/db/schema";
import { addDays } from "./schedule";
import { writeAudit } from "./audit";

export type AvailabilityStatus = "available" | "tentative" | "unavailable";

/** Map of "date|slot" → status for a week, for one instructor. */
export async function getWeekAvailability(
  repos: Repositories,
  ctx: AnyTenantContext,
  instructorId: string,
  mondayIso: string,
): Promise<Record<string, AvailabilityStatus>> {
  const rows = await repos.tenant.availability.list(
    ctx,
    eq(availabilityTable.instructorId, instructorId),
  );
  const sunday = addDays(mondayIso, 7);
  const out: Record<string, AvailabilityStatus> = {};
  for (const r of rows) {
    if (!r.date || r.date < mondayIso || r.date >= sunday) continue;
    out[`${r.date}|${r.slot}`] = r.status as AvailabilityStatus;
  }
  return out;
}

/**
 * Set (or clear) an instructor's availability for a specific date + slot.
 * Passing `null` clears it. Idempotent upsert, tenant scoped, audited.
 */
export async function setAvailability(
  repos: Repositories,
  ctx: AnyTenantContext,
  instructorId: string,
  date: string,
  slot: SlotCode,
  status: AvailabilityStatus | null,
): Promise<void> {
  const existing = (
    await repos.tenant.availability.list(
      ctx,
      and(eq(availabilityTable.instructorId, instructorId), eq(availabilityTable.date, date), eq(availabilityTable.slot, slot))!,
    )
  )[0];

  if (status === null) {
    if (existing) await repos.tenant.availability.delete(ctx, existing.id);
  } else if (existing) {
    await repos.tenant.availability.update(ctx, existing.id, { status });
  } else {
    await repos.tenant.availability.insert(ctx, { instructorId, date, weekday: null, slot, status });
  }

  await writeAudit(repos, ctx, {
    action: "set_availability",
    entity: "availability",
    entityId: existing?.id ?? null,
    after: { instructorId, date, slot, status },
  });
}
