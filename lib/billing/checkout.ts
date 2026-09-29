import type Stripe from "stripe";
import type { CloudflareEnv } from "@/lib/cf/bindings";
import type { SignupInput } from "@/lib/validation/signup";
import { createStripe } from "./stripe";
import { priceIdForPlan, priceIdForInterval, type BillingInterval } from "./plans";

/**
 * Create a hosted Stripe Checkout Session for a pending signup.
 *
 * Best practices applied:
 *  - price resolved from env server-side (never the client);
 *  - all provisioning data carried in metadata (on both the session and the
 *    subscription, so subscription.* events can find the org too);
 *  - an idempotency key keyed on the pending signup, so a retried request
 *    reuses the same session instead of creating duplicates;
 *  - EU/UK VAT: automatic tax + billing address + VAT-ID collection;
 *  - provisioning happens on the webhook, not this redirect.
 */
export async function createCheckoutSession(
  env: CloudflareEnv,
  input: SignupInput,
): Promise<{ url: string; id: string }> {
  const stripe = createStripe(env);
  const price = priceIdForPlan(env, input.plan);
  const apex = env.APP_APEX_DOMAIN;

  const metadata = {
    pending_signup: "1",
    slug: input.slug,
    plan: input.plan,
    centre_name: input.centreName,
    owner_email: input.ownerEmail,
    jurisdiction: input.jurisdiction,
  };

  const session: Stripe.Checkout.Session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      customer_email: input.ownerEmail,
      allow_promotion_codes: true,
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      automatic_tax: { enabled: true },
      success_url: `https://${apex}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://${apex}/pricing?cancelled=1`,
      subscription_data: { metadata },
      metadata,
    },
    // Idempotent: retrying the same pending signup reuses the session (24h window).
    { idempotencyKey: `checkout:${input.slug}:${input.plan}` },
  );

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url, id: session.id };
}

/**
 * Checkout for an EXISTING centre converting from its free trial to a paid plan
 * (monthly or annual). Unlike signup checkout this carries `org_id` in metadata,
 * so the webhook links the subscription to the existing org rather than
 * provisioning a new one. Stripe issues a VAT invoice + PDF for each payment.
 */
export async function createSubscriptionCheckout(
  env: CloudflareEnv,
  opts: { orgId: string; slug: string; ownerEmail: string; interval: BillingInterval; stripeCustomerId?: string | null },
): Promise<{ url: string }> {
  const stripe = createStripe(env);
  const price = priceIdForInterval(env, opts.interval);
  const base = `https://${opts.slug}.${env.APP_APEX_DOMAIN}`;
  const metadata = { org_id: opts.orgId, slug: opts.slug, interval: opts.interval };

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      ...(opts.stripeCustomerId
        ? { customer: opts.stripeCustomerId, customer_update: { address: "auto", name: "auto" } }
        : { customer_email: opts.ownerEmail }),
      allow_promotion_codes: true,
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      automatic_tax: { enabled: true },
      success_url: `${base}/office/billing?status=success`,
      cancel_url: `${base}/office/billing?status=cancelled`,
      subscription_data: { metadata },
      metadata,
    },
    { idempotencyKey: `upgrade:${opts.orgId}:${opts.interval}:${Math.floor(Date.now() / (60 * 60 * 1000))}` },
  );

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url };
}
