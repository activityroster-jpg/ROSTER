"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { instructor as instructorTable, SLOT_CODES, type SlotCode } from "@/lib/db/schema";
import { setAvailability, type AvailabilityStatus } from "@/lib/services/availability";

export interface SetAvailabilityInput {
  date: string;
  slot: SlotCode;
  status: AvailabilityStatus | null;
}

const STATUSES: AvailabilityStatus[] = ["available", "tentative", "unavailable"];

/** Set the signed-in instructor's own availability for a date + slot. */
export async function setAvailabilityAction(input: SetAvailabilityInput): Promise<{ ok: boolean; error?: string }> {
  const { ctx, repos } = await requireTenant();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !(SLOT_CODES as readonly string[]).includes(input.slot)) {
    return { ok: false, error: "Invalid slot" };
  }
  if (input.status !== null && !STATUSES.includes(input.status)) {
    return { ok: false, error: "Invalid status" };
  }

  // An instructor may only edit their OWN availability — resolve their record
  // from the session, never trust a client-supplied instructor id.
  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];
  if (!me) return { ok: false, error: "No linked instructor profile" };

  await setAvailability(repos, ctx, me.id, input.date, input.slot, input.status);
  revalidatePath("/portal/availability");
  return { ok: true };
}
