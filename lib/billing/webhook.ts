import type Stripe from "stripe";
import type { Repositories } from "@/lib/db/repositories";
import type { CloudflareEnv } from "@/lib/cf/bindings";
import type { SubscriptionStatus } from "@/lib/db/schema";
import { createStripe } from "./stripe";
import { provisionCentre } from "./provision";
import { captureException } from "@/lib/observability/sentry";

export type WebhookOutcome =
  | { ok: true; handled: boolean; duplicate?: boolean; type: string }
  | { ok: false; error: string };

/**
 * Verify and process a Stripe webhook.
 *
 * Security contract (brief §7):
 *  - signature verified against the RAW body (constructEventAsync on Workers);
 *  - two-layer idempotency: unique webhook_event.stripe_event_id AND idempotent
 *    provisioning;
 *  - access is revoked SERVER-SIDE on subscription deletion.
 */
export async function handleStripeWebhook(
  env: CloudflareEnv,
  repos: Repositories,
  rawBody: string,
  signature: string | null,
): Promise<WebhookOutcome> {
  if (!env.STRIPE_WEBHOOK_SECRET) return { ok: false, error: "Webhook secret not configured" };
  if (!signature) return { ok: false, error: "Missing signature" };

  const stripe = createStripe(env);
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return { ok: false, error: `Signature verification failed: ${(err as Error).message}` };
  }

  // Idempotency layer 1: have we already accepted this event?
  const first = await repos.control.recordWebhookEventOnce(event.id, event.type, undefined);
  if (!first) {
    return { ok: true, handled: false, duplicate: true, type: event.type };
  }

  try {
    await routeEvent(env, repos, event);
  } catch (err) {
    // Leave the ledger row so a manual replay can be diagnosed; surface error.
    await captureException(err, { tags: { area: "stripe-webhook", type: event.type } });
    return { ok: false, error: `Handler error: ${(err as Error).message}` };
  }

  await repos.control.markWebhookProcessed(event.id);
  return { ok: true, handled: true, type: event.type };
}

async function routeEvent(env: CloudflareEnv, repos: Repositories, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const m = session.metadata ?? {};
      if (m.pending_signup !== "1" || !m.slug) return; // not one of ours
      await provisionCentre(repos, env, {
        slug: m.slug,
        centreName: m.centre_name ?? m.slug,
        ownerEmail: m.owner_email ?? (session.customer_email ?? ""),
        jurisdiction: m.jurisdiction ?? "england",
        plan: m.plan ?? "rostering",
        stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
        stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : null,
      });
      return;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await updateSubscription(repos, sub, sub.status as SubscriptionStatus);
      return;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      // Revoke access server-side, but keep the org (export window / retention).
      const org = await orgForSubscription(repos, sub);
      if (org) {
        await repos.control.updateOrganisation(org.id, {
          subscriptionStatus: "canceled",
          status: "suspended",
        });
      }
      return;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      if (!customerId) return;
      const org = await repos.control.organisationByStripeCustomer(customerId);
      if (org) await repos.control.updateOrganisation(org.id, { subscriptionStatus: "past_due" });
      return;
    }

    default:
      return; // ignore everything else
  }
}

async function orgForSubscription(repos: Repositories, sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : null;
  if (!customerId) return null;
  return repos.control.organisationByStripeCustomer(customerId);
}

async function updateSubscription(
  repos: Repositories,
  sub: Stripe.Subscription,
  status: SubscriptionStatus,
): Promise<void> {
  const org = await orgForSubscription(repos, sub);
  if (!org) return;
  const active = status === "active" || status === "trialing";
  await repos.control.updateOrganisation(org.id, {
    subscriptionStatus: status,
    status: active ? "active" : org.status === "active" ? "active" : org.status,
  });
}
