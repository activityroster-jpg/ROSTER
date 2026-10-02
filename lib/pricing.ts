import type { Organisation, PlatformPricing } from "@/lib/db/schema";
import { tierMeta } from "@/lib/tiers";

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

/** The on-site day (travel to work with the team) sold alongside the custom package, GBP. */
export const ON_SITE_DAY_PRICE = 350;

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
 * The price a specific centre actually pays. The base is the centre's pricing
 * tier (Small Club / Standard) when it has one; otherwise the global default
 * (legacy / tier-less callers). A custom price then wins outright, else the
 * centre's discount % is applied to that base. Pure.
 */
export function effectivePricing(
  org: Pick<Organisation, "discountPercent" | "customMonthlyPrice" | "customAnnualPrice" | "freeMonths"> &
    Partial<Pick<Organisation, "tier">>,
  pricing: Pick<PlatformPricing, "monthlyPrice" | "annualPrice" | "currency">,
): EffectivePricing {
  const disc = Math.max(0, Math.min(100, org.discountPercent ?? 0));
  // Tier price is the base for any centre with a tier set; tier-less callers
  // (e.g. unit tests, pre-tier rows) fall back to the global default pricing.
  const tier = org.tier ? tierMeta(org.tier) : null;
  const baseMonthly = tier ? tier.monthlyPrice : pricing.monthlyPrice;
  const baseAnnual = tier ? tier.annualPrice : pricing.annualPrice;
  const monthly = org.customMonthlyPrice != null ? org.customMonthlyPrice : r2(baseMonthly * (1 - disc / 100));
  const annual = org.customAnnualPrice != null ? org.customAnnualPrice : r2(baseAnnual * (1 - disc / 100));
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

// --- Competitor comparison (marketing) -------------------------------------
//
// Competitors price per user per month. We price flat per centre, so the more
// people a centre rosters, the bigger the gap. RYA centres roster everyone who
// runs sessions — senior and assistant instructors, powerboat cover, shore crew
// and volunteers — so the real headcount is well above the paid core, and a
// per-seat tool bills every one of them. These pure helpers drive the
// "you save" table on the pricing page.

/** Mid-range of competitor per-seat pricing (£/user/month). Range ≈ £2–£6. */
export const PER_USER_BENCHMARK = 4;

/** What a per-seat competitor charges a centre with this many rostered people. */
export function competitorMonthly(people: number, perUser: number = PER_USER_BENCHMARK): number {
  return Math.max(0, Math.round(people * perUser));
}

export interface TierSaving {
  people: number;
  theirs: number;
  ours: number;
  save: number;
  /** Percent cheaper than the competitor (0 if not cheaper). */
  pct: number;
}

/** Our flat price vs a per-seat competitor at a given headcount. */
export function tierSaving(people: number, ourMonthly: number, perUser: number = PER_USER_BENCHMARK): TierSaving {
  const theirs = competitorMonthly(people, perUser);
  const save = theirs - ourMonthly;
  const pct = theirs > 0 && save > 0 ? Math.round((save / theirs) * 100) : 0;
  return { people, theirs, ours: ourMonthly, save, pct };
}

export interface CompetitorPricing {
  name: string;
  /** Representative £/user/month for a feature-comparable paid tier (scheduling
   *  + time & attendance + leave — the tier that matches what we include, not
   *  each platform's cheapest entry plan). Illustrative; real prices vary. */
  perUser: number;
}

/** The per-user platforms we compare against on /compare, each a column in the
 *  pricing table. Rates are illustrative, for feature-comparable paid tiers. */
export const COMPETITOR_PRICING: CompetitorPricing[] = [
  { name: "Deputy", perUser: 4.5 },
  { name: "When I Work", perUser: 4 },
  { name: "RotaCloud", perUser: 3.8 },
  { name: "Planday", perUser: 4.2 },
];

export interface ComparisonRow {
  people: number;
  plan: string;
  /** Our flat monthly price on that plan. */
  ours: number;
  /** Each named competitor's monthly cost at this headcount. */
  competitors: { name: string; monthly: number }[];
  /** The cheapest competitor's monthly cost at this headcount. */
  cheapestRival: number;
  /** How much less we cost than even the cheapest competitor (≥0 shown). */
  save: number;
  /** Percent cheaper than the cheapest competitor (0 if not cheaper). */
  pct: number;
}

/**
 * One pricing-comparison row: our flat price vs every named per-user platform at
 * a given headcount. "save"/"pct" are measured against the CHEAPEST competitor,
 * so a positive saving means we beat them all. Pure.
 */
export function comparisonRow(
  people: number,
  ours: number,
  plan: string,
  competitors: CompetitorPricing[] = COMPETITOR_PRICING,
): ComparisonRow {
  const cols = competitors.map((c) => ({ name: c.name, monthly: Math.round(people * c.perUser) }));
  const cheapestRival = cols.reduce((min, c) => Math.min(min, c.monthly), Infinity);
  const save = cheapestRival - ours;
  const pct = cheapestRival > 0 && save > 0 ? Math.round((save / cheapestRival) * 100) : 0;
  return { people, plan, ours, competitors: cols, cheapestRival, save, pct };
}
