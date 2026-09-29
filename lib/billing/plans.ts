import type { Plan } from "@/lib/db/schema";
import type { CloudflareEnv } from "@/lib/cf/bindings";

/**
 * Map a plan to its Stripe price id, read from env and validated server-side.
 * The client sends only the plan name (a fixed enum); it can never choose or
 * override the price.
 */
export function priceIdForPlan(env: CloudflareEnv, plan: Plan): string {
  const priceId = plan === "full" ? env.STRIPE_PRICE_FULL : env.STRIPE_PRICE_ROSTERING;
  if (!priceId) {
    throw new Error(`No Stripe price configured for plan "${plan}"`);
  }
  return priceId;
}

export const PLAN_LABELS: Record<Plan, string> = {
  rostering: "Rostering",
  full: "Full",
};

export const BILLING_INTERVALS = ["monthly", "annual"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

/**
 * The Stripe price id for a billing interval, from env (never the client). The
 * monthly price falls back to the legacy STRIPE_PRICE_ROSTERING name.
 */
export function priceIdForInterval(env: CloudflareEnv, interval: BillingInterval): string {
  const priceId = interval === "annual"
    ? env.STRIPE_PRICE_ANNUAL
    : (env.STRIPE_PRICE_MONTHLY ?? env.STRIPE_PRICE_ROSTERING);
  if (!priceId) throw new Error(`No Stripe price configured for the ${interval} interval`);
  return priceId;
}
