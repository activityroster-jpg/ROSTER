"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb, getEnv, getRepositories } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { createStripe } from "@/lib/billing/stripe";
import { createPromotionCode, type CouponSpec } from "@/lib/billing/coupons";
import { ORG_STATUSES, SUBSCRIPTION_STATUSES, PLANS, type OrgStatus, type SubscriptionStatus, type Plan } from "@/lib/db/schema";

type Result = { ok: boolean; error?: string };

const num = (v: unknown): number | null => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Update the global default pricing (all centres inherit this unless overridden). */
export async function setGlobalPricingAction(input: {
  monthlyPrice: number; annualPrice: number; currency: string; trialDays: number; freeFirstMonth: boolean;
}): Promise<Result> {
  await requirePlatformAdmin();
  const monthly = num(input.monthlyPrice), annual = num(input.annualPrice), trial = num(input.trialDays);
  if (monthly == null || monthly < 0 || annual == null || annual < 0 || trial == null || trial < 0) {
    return { ok: false, error: "Enter valid prices and trial length" };
  }
  const platform = new PlatformRepository(await getDb());
  await platform.upsertPricing({
    monthlyPrice: monthly,
    annualPrice: annual,
    currency: (input.currency || "GBP").toUpperCase().slice(0, 3),
    trialDays: Math.round(trial),
    freeFirstMonth: Boolean(input.freeFirstMonth),
  });
  revalidatePath("/admin");
  revalidatePath("/admin/pricing");
  revalidatePath("/pricing");
  return { ok: true };
}

/** Create a shareable marketing promo code (percentage off, or N months free). */
export async function createPromoCodeAction(input: {
  code: string; kind: string; value: number; maxRedemptions?: number;
}): Promise<Result & { code?: string }> {
  await requirePlatformAdmin();
  const code = (input.code ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9]{3,40}$/.test(code)) return { ok: false, error: "Code must be 3–40 letters/numbers." };
  const value = num(input.value);
  if (value == null || value <= 0) return { ok: false, error: "Enter a value." };
  const spec: CouponSpec = input.kind === "free_months"
    ? { kind: "free_months", months: Math.round(value) }
    : { kind: "percent", percent: value };
  try {
    const stripe = createStripe(getEnv());
    const res = await createPromotionCode(stripe, { spec, code, maxRedemptions: input.maxRedemptions && input.maxRedemptions > 0 ? Math.round(input.maxRedemptions) : undefined });
    revalidatePath("/admin");
    return { ok: true, code: res.code };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Set a single centre's pricing overrides (discount / custom price / free months). */
export async function setOrgPricingAction(id: string, input: {
  discountPercent: number; customMonthlyPrice: number | null; customAnnualPrice: number | null; freeMonths: number; billingNote: string;
}): Promise<Result> {
  await requirePlatformAdmin();
  const disc = num(input.discountPercent) ?? 0;
  if (disc < 0 || disc > 100) return { ok: false, error: "Discount must be 0–100%" };
  const { control } = await getRepositories();
  const updated = await control.updateOrganisation(id, {
    discountPercent: disc,
    customMonthlyPrice: num(input.customMonthlyPrice),
    customAnnualPrice: num(input.customAnnualPrice),
    freeMonths: Math.max(0, Math.round(num(input.freeMonths) ?? 0)),
    billingNote: input.billingNote?.trim() || null,
  });
  if (!updated) return { ok: false, error: "Not found" };
  revalidatePath("/admin");
  revalidatePath(`/admin/centres/${id}`);
  return { ok: true };
}

export async function setOrgStatusAction(id: string, status: string): Promise<Result> {
  await requirePlatformAdmin();
  if (!(ORG_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Invalid status" };
  const { control } = await getRepositories();
  const updated = await control.updateOrganisation(id, { status: status as OrgStatus });
  if (!updated) return { ok: false, error: "Not found" };
  revalidatePath("/admin");
  revalidatePath(`/admin/centres/${id}`);
  return { ok: true };
}

export async function setSubscriptionStatusAction(id: string, sub: string): Promise<Result> {
  await requirePlatformAdmin();
  if (!(SUBSCRIPTION_STATUSES as readonly string[]).includes(sub)) return { ok: false, error: "Invalid subscription status" };
  const { control } = await getRepositories();
  const updated = await control.updateOrganisation(id, { subscriptionStatus: sub as SubscriptionStatus });
  if (!updated) return { ok: false, error: "Not found" };
  revalidatePath("/admin");
  revalidatePath(`/admin/centres/${id}`);
  return { ok: true };
}

export async function setPlanAction(id: string, plan: string): Promise<Result> {
  await requirePlatformAdmin();
  if (!(PLANS as readonly string[]).includes(plan)) return { ok: false, error: "Invalid plan" };
  const { control } = await getRepositories();
  const updated = await control.updateOrganisation(id, { plan: plan as Plan });
  if (!updated) return { ok: false, error: "Not found" };
  revalidatePath("/admin");
  revalidatePath(`/admin/centres/${id}`);
  return { ok: true };
}
