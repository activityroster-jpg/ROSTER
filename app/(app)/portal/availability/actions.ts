"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { instructor as instructorTable, type SlotCode } from "@/lib/db/schema";
import { setAvailability, type AvailabilityStatus } from "@/lib/services/availability";
import { availabilityBulkSchema, availabilityEntrySchema, firstIssue } from "@/lib/validation/actions";

export interface SetAvailabilityInput {
  date: string;
  slot: SlotCode;
  status: AvailabilityStatus | null;
}

/** Set many slots at once (copy last week, mark the week free). Max 50 entries. */
export async function setAvailabilityBulkAction(entries: SetAvailabilityInput[]): Promise<{ ok: boolean; error?: string }> {
  const { ctx, repos } = await requireTenant();
  const parsed = availabilityBulkSchema.safeParse(entries);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "Invalid slot") };
  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];
  if (!me) return { ok: false, error: "No linked instructor profile" };
  for (const e of parsed.data) await setAvailability(repos, ctx, me.id, e.date, e.slot, e.status);
  revalidatePath("/portal/availability");
  return { ok: true };
}

/** Set the signed-in instructor's own availability for a date + slot. */
export async function setAvailabilityAction(input: SetAvailabilityInput): Promise<{ ok: boolean; error?: string }> {
  const { ctx, repos } = await requireTenant();
  const parsed = availabilityEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "Invalid slot") };
  input = parsed.data;

  // An instructor may only edit their OWN availability — resolve their record
  // from the session, never trust a client-supplied instructor id.
  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];
  if (!me) return { ok: false, error: "No linked instructor profile" };

  await setAvailability(repos, ctx, me.id, input.date, input.slot, input.status);
  revalidatePath("/portal/availability");
  return { ok: true };
}
