import type Stripe from "stripe";
import type { CloudflareEnv } from "@/lib/cf/bindings";
import type { SignupInput } from "@/lib/validation/signup";
import { createStripe } from "./stripe";
import { priceIdForPlan } from "./plans";

/**
 * Create a hosted Stripe Checkout Session for a pending signup. All the
 * information provisioning needs is carried in metadata; the price comes from
 * env (never the client). Provisioning happens on the webhook, not on the
 * success redirect.
 */
export async function createCheckoutSession(
  env: CloudflareEnv,
  input: SignupInput,
): Promise<{ url: string; id: string }> {
  const stripe = createStripe(env);
  const price = priceIdForPlan(env, input.plan);
  const apex = env.APP_APEX_DOMAIN;

  const session: Stripe.Checkout.Session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    customer_email: input.ownerEmail,
    allow_promotion_codes: true,
    success_url: `https://${apex}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `https://${apex}/pricing?cancelled=1`,
    subscription_data: {
      metadata: {
        pending_signup: "1",
        slug: input.slug,
        plan: input.plan,
        centre_name: input.centreName,
        owner_email: input.ownerEmail,
        jurisdiction: input.jurisdiction,
      },
    },
    metadata: {
      pending_signup: "1",
      slug: input.slug,
      plan: input.plan,
      centre_name: input.centreName,
      owner_email: input.ownerEmail,
      jurisdiction: input.jurisdiction,
    },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url, id: session.id };
}
