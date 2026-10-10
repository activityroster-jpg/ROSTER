import { eq, isNull } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { payRate as payRateTable, type PayRate, type PayUnit } from "@/lib/db/schema";
import { resolvePayRate, type PayRateRule } from "@/lib/domain";
import { writeAudit } from "./audit";

/**
 * How people are paid, all in one table (Settings → Pay rates):
 *   - centre rates (no instructor): the standard rate for a role, optionally
 *     on one kind of course, plus a general rate for everyone else;
 *   - a person's own rate (any course), and their own rate for particular
 *     courses (older records may also hold a person's rate for a role).
 * The most specific one that fits wins (lib/domain/pay → resolvePayRate).
 */
export interface PayRateView { id: string; instructorId: string | null; roleTypeId: string | null; courseTypeId: string | null; unit: PayUnit; rate: number }

const view = (r: PayRate): PayRateView => ({ id: r.id, instructorId: r.instructorId ?? null, roleTypeId: r.roleTypeId ?? null, courseTypeId: r.courseTypeId ?? null, unit: r.unit, rate: r.rate });

/** One person's own rates. */
export async function listPayRates(repos: Repositories, ctx: AnyTenantContext, instructorId: string): Promise<PayRateView[]> {
  return (await repos.tenant.payRate.list(ctx, eq(payRateTable.instructorId, instructorId))).map(view);
}

/** The centre's standard rates (role, role on a course, general). */
export async function listCentreRates(repos: Repositories, ctx: AnyTenantContext): Promise<PayRateView[]> {
  return (await repos.tenant.payRate.list(ctx, isNull(payRateTable.instructorId))).map(view);
}

/** Every rate the centre holds, people's and its own. */
export async function listAllPayRates(repos: Repositories, ctx: AnyTenantContext): Promise<PayRateView[]> {
  return (await repos.tenant.payRate.list(ctx)).map(view);
}

/** Pence when recorded, else the float rounded to the penny: one number for every reader. */
export const penceOf = (rate: number | null | undefined, pence?: number | null): number | null => (pence != null ? pence : rate == null ? null : Math.round(rate * 100));

/** All rates as rules for {@link resolvePayRate}: one read for payroll, the clock and the roster sync. */
export async function loadPayRules(repos: Repositories, ctx: AnyTenantContext): Promise<PayRateRule[]> {
  return (await repos.tenant.payRate.list(ctx)).map((r) => ({ instructorId: r.instructorId ?? null, roleTypeId: r.roleTypeId ?? null, courseTypeId: r.courseTypeId ?? null, unit: r.unit, rate: r.rate, ratePence: r.ratePence }));
}

/** The rate for one person in a role on a kind of course (most specific wins), or null when nothing is set. */
export function rateFor(rules: readonly PayRateRule[], instructorId: string, roleTypeId: string | null, courseTypeId: string | null) {
  return resolvePayRate(rules, { instructorId, roleTypeId, courseTypeId });
}

export interface PayRateKey { instructorId: string | null; roleTypeId: string | null; courseTypeId?: string | null }
const sameKey = (r: PayRate, k: PayRateKey) => (r.instructorId ?? null) === (k.instructorId ?? null) && (r.roleTypeId ?? null) === (k.roleTypeId ?? null) && (r.courseTypeId ?? null) === (k.courseTypeId ?? null);

/** Set (or replace) one rate: a person's or the centre's, for any role and course or a particular one. Audited. */
export async function setPayRate(
  repos: Repositories,
  ctx: AnyTenantContext,
  input: PayRateKey & { unit: PayUnit; rate: number },
): Promise<PayRate> {
  const key: PayRateKey = { instructorId: input.instructorId ?? null, roleTypeId: input.roleTypeId ?? null, courseTypeId: input.courseTypeId ?? null };
  const pool = key.instructorId
    ? await repos.tenant.payRate.list(ctx, eq(payRateTable.instructorId, key.instructorId))
    : await repos.tenant.payRate.list(ctx, isNull(payRateTable.instructorId));
  const existing = pool.find((r) => sameKey(r, key));
  const ratePence = Math.round(input.rate * 100);
  const row = existing
    ? (await repos.tenant.payRate.update(ctx, existing.id, { unit: input.unit, rate: input.rate, ratePence }))!
    : await repos.tenant.payRate.insert(ctx, { instructorId: key.instructorId, roleTypeId: key.roleTypeId, courseTypeId: key.courseTypeId ?? null, unit: input.unit, rate: input.rate, ratePence });
  await writeAudit(repos, ctx, { action: existing ? "update_pay_rate" : "set_pay_rate", entity: "pay_rate", entityId: row.id, before: existing ? { unit: existing.unit, rate: existing.rate } : undefined, after: { ...key, unit: input.unit, rate: input.rate } });
  return row;
}

/** Remove the rate with this key, if there is one. Audited. */
export async function clearPayRate(repos: Repositories, ctx: AnyTenantContext, key: PayRateKey): Promise<boolean> {
  const pool = key.instructorId
    ? await repos.tenant.payRate.list(ctx, eq(payRateTable.instructorId, key.instructorId))
    : await repos.tenant.payRate.list(ctx, isNull(payRateTable.instructorId));
  const existing = pool.find((r) => sameKey(r, key));
  if (!existing) return false;
  return deletePayRate(repos, ctx, existing.id);
}

export async function deletePayRate(repos: Repositories, ctx: AnyTenantContext, id: string): Promise<boolean> {
  const removed = await repos.tenant.payRate.delete(ctx, id);
  if (removed) await writeAudit(repos, ctx, { action: "delete_pay_rate", entity: "pay_rate", entityId: id });
  return removed > 0;
}
