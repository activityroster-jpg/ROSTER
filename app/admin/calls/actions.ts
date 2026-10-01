"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { hhmmToMinutes } from "@/lib/calls/slots";
import type { CallBookingStatus } from "@/lib/db/schema";

export type CallResult = { ok: boolean; error?: string };

async function repo() {
  await requirePlatformAdmin();
  return new PlatformRepository(await getDb());
}

export async function addAvailabilityAction(input: { dayOfWeek: number; start: string; end: string }): Promise<CallResult> {
  const r = await repo();
  const dow = Number(input.dayOfWeek);
  if (!(dow >= 0 && dow <= 6)) return { ok: false, error: "Pick a day of the week." };
  const s = hhmmToMinutes(input.start);
  const e = hhmmToMinutes(input.end);
  if (s == null || e == null) return { ok: false, error: "Enter valid times (HH:MM)." };
  if (e <= s) return { ok: false, error: "End time must be after the start time." };
  await r.addAvailability({ dayOfWeek: dow, startMinute: s, endMinute: e, active: true });
  revalidatePath("/admin/calls");
  return { ok: true };
}

export async function deleteAvailabilityAction(id: string): Promise<CallResult> {
  const r = await repo();
  await r.deleteAvailability(id);
  revalidatePath("/admin/calls");
  return { ok: true };
}

export async function setBookingStatusAction(id: string, status: CallBookingStatus): Promise<CallResult> {
  const r = await repo();
  const updated = await r.setBookingStatus(id, status);
  if (!updated) return { ok: false, error: "Not found" };
  revalidatePath("/admin/calls");
  return { ok: true };
}
