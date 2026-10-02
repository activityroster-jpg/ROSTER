import type Stripe from "stripe";
import type { CloudflareEnv } from "@/lib/cf/bindings";
import type { OrgTier } from "@/lib/db/schema";
import { createStripe } from "./stripe";
import type { BillingInterval } from "./plans";

/**
 * Which Stripe price to charge for what. Price IDs are resolved server-side,
 * never from the client, in this order:
 *   1. an explicit env var (STRIPE_PRICE_*), if set;
 *   2. the matching ACTIVE price on the Stripe account, found by product name
 *      + billing interval (so renaming nothing in Stripe just works);
 * and cached in KV for an hour. The platform admin page shows what resolved,
 * with the Stripe amount next to the amount we advertise, so a mismatch is
 * obvious rather than silent.
 */
export type PriceKind =
  | "small_club_monthly"
  | "small_club_annual"
  | "standard_monthly"
  | "standard_annual"
  | "setup" // "Custom Package" — one-off build & tailoring
  | "onsite_day"; // "UK Onsite Daily Consultancy" — travel / on-site day

export const PRICE_KINDS: PriceKind[] = ["small_club_monthly", "small_club_annual", "standard_monthly", "standard_annual", "setup", "onsite_day"];

export interface ResolvedPrice {
  id: string;
  /** Minor units (pence) as Stripe reports them; null when unknown (env id, Stripe unreachable). */
  unitAmount: number | null;
  currency: string | null;
  productName: string | null;
  source: "env" | "stripe";
}

export type ResolvedPrices = Record<PriceKind, ResolvedPrice | null>;

/** Env override per kind (legacy names kept as fallbacks for Standard + setup). */
const ENV_KEYS: Record<PriceKind, (keyof CloudflareEnv)[]> = {
  small_club_monthly: ["STRIPE_PRICE_SMALL_MONTHLY"],
  small_club_annual: ["STRIPE_PRICE_SMALL_ANNUAL"],
  standard_monthly: ["STRIPE_PRICE_STANDARD_MONTHLY", "STRIPE_PRICE_MONTHLY", "STRIPE_PRICE_ROSTERING"],
  standard_annual: ["STRIPE_PRICE_STANDARD_ANNUAL", "STRIPE_PRICE_ANNUAL"],
  setup: ["STRIPE_PRICE_SETUP"],
  onsite_day: ["STRIPE_PRICE_ONSITE"],
};

/** How a Stripe price is recognised: product name pattern + interval (null = one-off). */
const MATCH: Record<PriceKind, { name: RegExp; interval: "month" | "year" | null }> = {
  small_club_monthly: { name: /small\s*club/i, interval: "month" },
  small_club_annual: { name: /small\s*club/i, interval: "year" },
  standard_monthly: { name: /standard/i, interval: "month" },
  standard_annual: { name: /standard/i, interval: "year" },
  setup: { name: /custom\s*(package|platform|build)|done[- ]for[- ]you|setup/i, interval: null },
  onsite_day: { name: /on[- ]?site|consultan|travel/i, interval: null },
};

export interface PriceLike {
  id: string;
  active: boolean;
  unit_amount: number | null;
  currency: string;
  recurring: { interval: string } | null;
  productName: string;
  productActive: boolean;
}

/** Pure: which kind (if any) an active Stripe price is. */
export function classifyPrice(p: PriceLike): PriceKind | null {
  if (!p.active || !p.productActive) return null;
  const interval = p.recurring?.interval ?? null;
  for (const kind of PRICE_KINDS) {
    const m = MATCH[kind];
    if (m.name.test(p.productName) && interval === m.interval) return kind;
  }
  return null;
}

/** Pure: pick one price per kind from a list (first match wins — Stripe lists newest first). */
export function pickPrices(prices: PriceLike[]): Partial<Record<PriceKind, PriceLike>> {
  const out: Partial<Record<PriceKind, PriceLike>> = {};
  for (const p of prices) {
    const kind = classifyPrice(p);
    if (kind && !out[kind]) out[kind] = p;
  }
  return out;
}

export const priceKindFor = (tier: OrgTier | null | undefined, interval: BillingInterval): PriceKind =>
  `${tier === "small_club" ? "small_club" : "standard"}_${interval}` as PriceKind;

const CACHE_KEY = "stripe:prices:v2";
const CACHE_TTL_S = 60 * 60;

async function fetchStripePrices(stripe: Stripe): Promise<PriceLike[]> {
  const res = await stripe.prices.list({ active: true, limit: 100, expand: ["data.product"] });
  return res.data.map((p) => {
    const prod = p.product as Stripe.Product | Stripe.DeletedProduct | string;
    const product = typeof prod === "object" && !("deleted" in prod && prod.deleted) ? (prod as Stripe.Product) : null;
    return {
      id: p.id,
      active: p.active,
      unit_amount: p.unit_amount,
      currency: p.currency,
      recurring: p.recurring ? { interval: p.recurring.interval } : null,
      productName: product?.name ?? "",
      productActive: product?.active ?? false,
    };
  });
}

/**
 * Resolve every kind. Env overrides win; the rest come from Stripe (cached).
 * Never throws for a missing kind — callers decide (checkout throws, the admin
 * panel shows "not found").
 */
export async function resolvePrices(env: CloudflareEnv, opts: { fresh?: boolean } = {}): Promise<ResolvedPrices> {
  const out = Object.fromEntries(PRICE_KINDS.map((k) => [k, null])) as ResolvedPrices;
  const kv = env.TENANT_CACHE;

  let fromStripe: PriceLike[] | null = null;
  if (!opts.fresh && kv) {
    try { const raw = await kv.get(CACHE_KEY); if (raw) fromStripe = JSON.parse(raw) as PriceLike[]; } catch { fromStripe = null; }
  }
  if (!fromStripe && env.STRIPE_SECRET_KEY) {
    try {
      fromStripe = await fetchStripePrices(createStripe(env));
      if (kv) await kv.put(CACHE_KEY, JSON.stringify(fromStripe), { expirationTtl: CACHE_TTL_S }).catch(() => {});
    } catch (err) {
      console.warn("[prices] Stripe lookup failed:", (err as Error).message);
      fromStripe = null;
    }
  }
  const byId = new Map((fromStripe ?? []).map((p) => [p.id, p]));
  const picked = pickPrices(fromStripe ?? []);

  for (const kind of PRICE_KINDS) {
    const envId = ENV_KEYS[kind].map((k) => env[k]).find((v): v is string => typeof v === "string" && v.length > 0);
    if (envId) {
      const known = byId.get(envId);
      out[kind] = { id: envId, unitAmount: known?.unit_amount ?? null, currency: known?.currency ?? null, productName: known?.productName ?? null, source: "env" };
      continue;
    }
    const p = picked[kind];
    if (p) out[kind] = { id: p.id, unitAmount: p.unit_amount, currency: p.currency, productName: p.productName, source: "stripe" };
  }
  return out;
}

const LABEL: Record<PriceKind, string> = {
  small_club_monthly: "Small Club · monthly",
  small_club_annual: "Small Club · annual",
  standard_monthly: "Standard · monthly",
  standard_annual: "Standard · annual",
  setup: "Custom package (one-off setup)",
  onsite_day: "On-site day (travel)",
};
export const priceLabel = (kind: PriceKind) => LABEL[kind];

/** The price id to charge for `kind`, or throw with a message an admin can act on. */
export async function priceIdFor(env: CloudflareEnv, kind: PriceKind): Promise<string> {
  const all = await resolvePrices(env);
  const p = all[kind];
  if (!p) throw new Error(`No Stripe price found for "${LABEL[kind]}". Create it in Stripe (product name + interval are matched automatically) or set ${ENV_KEYS[kind][0]}.`);
  return p.id;
}
