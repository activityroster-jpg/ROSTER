import Stripe from "stripe";
import type { CloudflareEnv } from "@/lib/cf/bindings";

/**
 * Stripe client configured for the Workers runtime (fetch-based HTTP client, no
 * Node http). Uses the restricted secret key from env — never a client value.
 */
export function createStripe(env: CloudflareEnv): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
    // A slow Stripe must not hold a page or an action open for the library's
    // default 80 seconds (Dev Center overview, 6 Oct): give up after 10.
    timeout: 10_000,
    maxNetworkRetries: 1,
    apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
  });
}
