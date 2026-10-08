"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { publishWeek } from "@/lib/services/roster";
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

/** Publish (or re-publish) one week's roster and tell everyone on it. */
export async function publishWeekAction(weekStart: string): Promise<Result> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  if (!isoDateSchema.safeParse(weekStart).success) return { ok: false, error: "Invalid week" };
  const r = await publishWeek(repos, ctx, weekStart);
  revalidatePath("/office/rota");
  revalidatePath("/office/courses");
  revalidatePath("/office");
  revalidatePath("/portal");
  const n = r.instructorsNotified;
  const verb = r.republished ? "Re-published" : "Published";
  const asked = r.askedToConfirm ? ` (${r.askedToConfirm} asked to confirm)` : "";
  const unreachable = r.unreachable.length ? ` No app or email for ${r.unreachable.join(", ")}: give them the printed roster.` : "";
  return {
    ok: true,
    message: n
      ? `${verb} — ${n} ${n === 1 ? "person" : "people"} told${asked}.${unreachable}`
      : `${verb} — nobody is rostered this week yet`,
  };
}
