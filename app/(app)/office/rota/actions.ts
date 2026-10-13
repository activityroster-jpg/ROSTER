"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { confirmDays, undoDayConfirmation } from "@/lib/services/roster-days";
import { z } from "zod";
import { isoDateSchema } from "@/lib/validation/actions";
import { SLOT_CODES, type SlotCode } from "@/lib/db/schema";
import { parseWelfareSettings, setWelfareDuty } from "@/lib/services/welfare";

type Result = { ok: boolean; error?: string; message?: string };

/** Who is on welfare duty for one date and slot (a name from Settings → Welfare officers; empty = back to the default). */
export async function setWelfareDutyAction(date: string, slot: string, name: string | null): Promise<Result> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  if (!isoDateSchema.safeParse(date).success || !(SLOT_CODES as readonly string[]).includes(slot)) return { ok: false, error: "Invalid day" };
  const settings = (await repos.tenant.orgSettings.list(ctx))[0];
  const { officers } = parseWelfareSettings(settings?.welfareOfficers, settings?.welfareDuty);
  const clean = (name ?? "").trim();
  if (clean && !officers.includes(clean)) return { ok: false, error: "Pick a name from Settings → Welfare officers" };
  await setWelfareDuty(repos, ctx, date, slot as SlotCode, clean || null);
  revalidatePath("/office/rota"); revalidatePath("/office/rota/emergency");
  return { ok: true };
}

const daysSchema = z.array(isoDateSchema).min(1).max(14);

/** Confirm roster days: everyone on a day hears the first time; after an undo, only the people whose shifts changed. */
export async function confirmDaysAction(dates: string[]): Promise<Result> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  const parsed = daysSchema.safeParse(dates);
  if (!parsed.success) return { ok: false, error: "Pick the days to confirm" };
  const r = await confirmDays(repos, ctx, parsed.data);
  for (const p of ["/office/rota", "/office/courses", "/office", "/portal"]) revalidatePath(p);
  const unreachable = r.unreachable.length ? ` No app or email for ${r.unreachable.join(", ")}: give them the printed roster.` : "";
  if (r.days === 0) return { ok: true, message: "Already confirmed" };
  return { ok: true, message: `${r.days} day${r.days === 1 ? "" : "s"} confirmed · ${r.notified ? `${r.notified} ${r.notified === 1 ? "person" : "people"} told` : "nobody needed telling"}.${unreachable}` };
}

/** Put a confirmed day back to pending. Nobody is told. */
export async function undoDayAction(date: string): Promise<Result> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  if (!isoDateSchema.safeParse(date).success) return { ok: false, error: "Invalid day" };
  const r = await undoDayConfirmation(repos, ctx, date);
  for (const p of ["/office/rota", "/office", "/portal"]) revalidatePath(p);
  return r.ok ? { ok: true, message: "Back to pending" } : { ok: false, error: "That day isn't confirmed" };
}
