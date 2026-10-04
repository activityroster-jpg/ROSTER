import { eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { payRate as payRateTable, type PayRate, type PayUnit } from "@/lib/db/schema";
import { writeAudit } from "./audit";

/**
 * How an instructor is paid. One row per instructor is their default (per hour,
 * per session or per day, with the amount); optional extra rows per role
 * override it when they work in that role (e.g. a higher rate as Senior
 * Instructor, or a flat day rate for safety-boat cover).
 */
export interface PayRateView { id: string; roleTypeId: string | null; unit: PayUnit; rate: number }

export async function listPayRates(repos: Repositories, ctx: AnyTenantContext, instructorId: string): Promise<PayRateView[]> {
  const rows = await repos.tenant.payRate.list(ctx, eq(payRateTable.instructorId, instructorId));
  return rows.map((r) => ({ id: r.id, roleTypeId: r.roleTypeId ?? null, unit: r.unit, rate: r.rate }));
}

/** The rate that applies to an instructor in a role: the role-specific row, else their default, else null. */
/** Pence when recorded, else the float rounded to the penny: one number for every reader. */
export const penceOf = (rate: number | null | undefined, pence?: number | null): number | null => (pence != null ? pence : rate == null ? null : Math.round(rate * 100));

export function pickPayRate(rates: readonly Pick<PayRate, "roleTypeId" | "unit" | "rate" | "ratePence">[], roleTypeId: string | null): { unit: PayUnit; rate: number; ratePence: number } | null {
  const forRole = roleTypeId ? rates.find((r) => r.roleTypeId === roleTypeId) : undefined;
  const chosen = forRole ?? rates.find((r) => !r.roleTypeId);
  return chosen ? { unit: chosen.unit, rate: chosen.rate, ratePence: penceOf(chosen.rate, chosen.ratePence)! } : null;
}

/** All pay rates for the centre, keyed by instructor (one read for payroll/sync). */
export async function payRatesByInstructor(repos: Repositories, ctx: AnyTenantContext): Promise<Map<string, PayRate[]>> {
  const rows = await repos.tenant.payRate.list(ctx);
  const by = new Map<string, PayRate[]>();
  for (const r of rows) {
    if (!r.instructorId) continue;
    by.set(r.instructorId, [...(by.get(r.instructorId) ?? []), r]);
  }
  return by;
}

/** Set (or replace) the rate for an instructor, as their default (roleTypeId null) or for one role. Audited. */
export async function setPayRate(
  repos: Repositories,
  ctx: AnyTenantContext,
  input: { instructorId: string; roleTypeId: string | null; unit: PayUnit; rate: number },
): Promise<PayRate> {
  const existing = (await repos.tenant.payRate.list(ctx, eq(payRateTable.instructorId, input.instructorId)))
    .find((r) => (r.roleTypeId ?? null) === (input.roleTypeId ?? null));
  const ratePence = Math.round(input.rate * 100);
  const row = existing
    ? (await repos.tenant.payRate.update(ctx, existing.id, { unit: input.unit, rate: input.rate, ratePence }))!
    : await repos.tenant.payRate.insert(ctx, { instructorId: input.instructorId, roleTypeId: input.roleTypeId, unit: input.unit, rate: input.rate, ratePence });
  await writeAudit(repos, ctx, { action: existing ? "update_pay_rate" : "set_pay_rate", entity: "pay_rate", entityId: row.id, after: { instructorId: input.instructorId, roleTypeId: input.roleTypeId, unit: input.unit, rate: input.rate } });
  return row;
}

export async function deletePayRate(repos: Repositories, ctx: AnyTenantContext, id: string): Promise<boolean> {
  const removed = await repos.tenant.payRate.delete(ctx, id);
  if (removed) await writeAudit(repos, ctx, { action: "delete_pay_rate", entity: "pay_rate", entityId: id });
  return removed > 0;
}
