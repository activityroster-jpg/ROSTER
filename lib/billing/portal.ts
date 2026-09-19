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
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });
  return { url: session.url };
}
