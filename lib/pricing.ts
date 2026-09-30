import type { Organisation, PlatformPricing } from "@/lib/db/schema";

/** Fallback used before any pricing row is saved. */
export const DEFAULT_PRICING = {
  id: "default",
  monthlyPrice: 75,
  annualPrice: 675,
  currency: "GBP",
  freeFirstMonth: true,
  trialDays: 30,
  setupPrice: 850,
  setupEnabled: true,
} as const;

export interface EffectivePricing {
  monthly: number;
  annual: number;
  currency: string;
  discountPercent: number;
  custom: boolean;
  freeMonths: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The price a specific centre actually pays: a custom price wins outright,
 * otherwise the centre's discount % is applied to the global default. Pure.
 */
export function effectivePricing(
  org: Pick<Organisation, "discountPercent" | "customMonthlyPrice" | "customAnnualPrice" | "freeMonths">,
  pricing: Pick<PlatformPricing, "monthlyPrice" | "annualPrice" | "currency">,
): EffectivePricing {
  const disc = Math.max(0, Math.min(100, org.discountPercent ?? 0));
  const monthly = org.customMonthlyPrice != null ? org.customMonthlyPrice : r2(pricing.monthlyPrice * (1 - disc / 100));
  const annual = org.customAnnualPrice != null ? org.customAnnualPrice : r2(pricing.annualPrice * (1 - disc / 100));
  return {
    monthly,
    annual,
    currency: pricing.currency,
    discountPercent: disc,
    custom: org.customMonthlyPrice != null || org.customAnnualPrice != null,
    freeMonths: org.freeMonths ?? 0,
  };
}

export function currencySymbol(currency: string): string {
  return currency === "EUR" ? "€" : currency === "USD" ? "$" : "£";
}

export function fmtMoney(n: number, currency = "GBP"): string {
  return `${currencySymbol(currency)}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
