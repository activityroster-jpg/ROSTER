import { and, eq, gte, lt } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { SLOT_CODES, welfareDuty as welfareDutyTable, type SlotCode } from "@/lib/db/schema";
import { writeAudit } from "./audit";

/**
 * Welfare officers are a note on the roster, not accounts (Conor, 4 Oct 2026):
 * Settings holds their names and, optionally, who is on duty by default on
 * each weekday and slot; the roster can override any one date+slot. The
 * welfare officer usually has another job on the day, so nothing here limits
 * or checks anything; it simply says who to go to.
 */
export interface WelfareDefault { weekday: number; slot: SlotCode; name: string }
export interface WelfareSettings { officers: string[]; defaults: WelfareDefault[] }

export function parseWelfareSettings(officersJson: string | null | undefined, dutyJson: string | null | undefined): WelfareSettings {
  let officers: string[] = [];
  let defaults: WelfareDefault[] = [];
  try { const v = JSON.parse(officersJson || "[]"); if (Array.isArray(v)) officers = v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean).slice(0, 50); } catch { /* empty */ }
  try {
    const v = JSON.parse(dutyJson || "[]");
    if (Array.isArray(v)) defaults = v.filter((d): d is WelfareDefault => d && Number.isInteger(d.weekday) && d.weekday >= 0 && d.weekday <= 6 && (SLOT_CODES as readonly string[]).includes(d.slot) && typeof d.name === "string" && d.name.trim() !== "").map((d) => ({ weekday: d.weekday, slot: d.slot, name: d.name.trim() }));
  } catch { /* empty */ }
  return { officers, defaults };
}

/** 0 = Sunday … 6 = Saturday, from a YYYY-MM-DD date. */
export const weekdayOf = (iso: string): number => new Date(`${iso}T12:00:00Z`).getUTCDay();

/** Pure: the default name for a date+slot, or null. */
export function defaultWelfareFor(settings: WelfareSettings, dateIso: string, slot: SlotCode): string | null {
  const wd = weekdayOf(dateIso);
  return settings.defaults.find((d) => d.weekday === wd && d.slot === slot)?.name ?? null;
}

export type WelfareBySlot = Partial<Record<SlotCode, string>>;

/** Who is on duty for each slot of each day in a range: overrides first, then the default pattern. Empty when the centre lists no officers. */
export async function welfareForRange(repos: Repositories, ctx: AnyTenantContext, fromIso: string, toIsoExclusive: string): Promise<{ settings: WelfareSettings; byDate: Map<string, WelfareBySlot> }> {
  const settingsRow = (await repos.tenant.orgSettings.list(ctx))[0];
  const settings = parseWelfareSettings(settingsRow?.welfareOfficers, settingsRow?.welfareDuty);
  const byDate = new Map<string, WelfareBySlot>();
  if (settings.officers.length === 0) return { settings, byDate };
  const overrides = await repos.tenant.welfareDuty.list(ctx, and(gte(welfareDutyTable.date, fromIso), lt(welfareDutyTable.date, toIsoExclusive)));
  const d = new Date(`${fromIso}T12:00:00Z`);
  for (let iso = fromIso; iso < toIsoExclusive; d.setUTCDate(d.getUTCDate() + 1), iso = d.toISOString().slice(0, 10)) {
    const slots: WelfareBySlot = {};
    for (const slot of SLOT_CODES) {
      const o = overrides.find((r) => r.date === iso && r.slot === slot);
      const name = o ? o.name : defaultWelfareFor(settings, iso, slot);
      if (name) slots[slot] = name;
    }
    if (Object.keys(slots).length) byDate.set(iso, slots);
  }
  return { settings, byDate };
}

/** Set (name) or clear (null → back to the default pattern) who is on duty for one date+slot. Audited. */
export async function setWelfareDuty(repos: Repositories, ctx: AnyTenantContext, dateIso: string, slot: SlotCode, name: string | null): Promise<void> {
  const existing = (await repos.tenant.welfareDuty.list(ctx, and(eq(welfareDutyTable.date, dateIso), eq(welfareDutyTable.slot, slot))))[0];
  const clean = name?.trim() || null;
  if (!clean) { if (existing) await repos.tenant.welfareDuty.delete(ctx, existing.id); }
  else if (existing) await repos.tenant.welfareDuty.update(ctx, existing.id, { name: clean });
  else await repos.tenant.welfareDuty.insert(ctx, { date: dateIso, slot, name: clean });
  await writeAudit(repos, ctx, { action: "set_welfare_duty", entity: "roster", entityId: null, after: { date: dateIso, slot, name: clean } });
}
