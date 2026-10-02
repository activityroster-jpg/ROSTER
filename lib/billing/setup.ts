import type { CloudflareEnv } from "@/lib/cf/bindings";
import { createStripe } from "./stripe";
import { priceIdFor } from "./prices";

/**
 * Create a hosted Stripe Checkout Session for the one-off "done-for-you" setup
 * & customisation service (a single payment, not a subscription).
 *
 * Same server-side guarantees as the subscription checkout:
 *  - the price is resolved from env server-side (the client never sends it);
 *  - EU/UK VAT: automatic tax + billing address + VAT-ID collection;
 *  - a VAT invoice/PDF is generated for the one-time payment;
 *  - fulfilment is recorded on the webhook (checkout.session.completed), not on
 *    this redirect.
 *
 * The service can be bought before a centre exists (from the public pricing
 * page) or by an existing centre (from its billing page) — `slug`/`orgId` are
 * carried in metadata so the webhook can attribute the purchase when known.
 */
export async function createSetupCheckout(
  env: CloudflareEnv,
  opts: {
    email?: string | null;
    slug?: string | null;
    orgId?: string | null;
    stripeCustomerId?: string | null;
    returnBase?: string | null;
    /** Add the on-site day (travel to work with the team) as a second line. */
    onsite?: boolean;
  } = {},
): Promise<{ url: string }> {
  const stripe = createStripe(env);
  const price = await priceIdFor(env, "setup");
  const lineItems: { price: string; quantity: number }[] = [{ price, quantity: 1 }];
  if (opts.onsite) lineItems.push({ price: await priceIdFor(env, "onsite_day"), quantity: 1 });
  const base = opts.returnBase || `https://${env.APP_APEX_DOMAIN}`;

  const metadata: Record<string, string> = { setup_service: "1", onsite: opts.onsite ? "1" : "0" };
  if (opts.slug) metadata.slug = opts.slug;
  if (opts.orgId) metadata.org_id = opts.orgId;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    ...(opts.stripeCustomerId
      ? { customer: opts.stripeCustomerId, customer_update: { address: "auto", name: "auto" } }
      : opts.email
        ? { customer_email: opts.email }
        : {}),
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    automatic_tax: { enabled: true },
    invoice_creation: { enabled: true },
    success_url: `${base}/setup/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/pricing?setup_cancelled=1`,
    metadata,
    payment_intent_data: { metadata },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url };
}
