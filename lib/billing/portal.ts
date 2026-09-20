import type { CloudflareEnv } from "@/lib/cf/bindings";
import { createStripe } from "./stripe";

/**
 * Create a Stripe Customer Portal session so a centre admin can manage their
 * plan, payment method and cancellation themselves — no card handling on our
 * side.
 */
export async function createPortalSession(
  env: CloudflareEnv,
  stripeCustomerId: string,
  returnUrl: string,
): Promise<{ url: string }> {
  const stripe = createStripe(env);
  // Idempotency key bucketed by the hour: a rapid double-click reuses one
  // portal session rather than creating duplicates.
  const bucket = Math.floor(Date.now() / (60 * 60 * 1000));
  const session = await stripe.billingPortal.sessions.create(
    { customer: stripeCustomerId, return_url: returnUrl },
    { idempotencyKey: `portal:${stripeCustomerId}:${bucket}` },
  );
  return { url: session.url };
}
