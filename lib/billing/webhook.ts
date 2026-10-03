import type Stripe from "stripe";
import { getDb } from "@/lib/cf/bindings";
import { recordChargeRefunded, recordInvoicePaid } from "./finance-sync";
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

  // Environment guard: in production only ever act on live events (and never
  // let a live event be processed by a non-prod deployment).
  const expectLive = env.APP_ENV === "production";
  if (event.livemode !== expectLive) {
    return { ok: true, handled: false, type: event.type };
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
    // Synchronous payment methods (cards) confirm here; delayed methods (some
    // bank debits) arrive later via async_payment_succeeded.
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
      if (!paid) return; // wait for the async success event
      await provisionFromSession(env, repos, session);
      return;
    }

    // A delayed payment failed: free the soft-reserved slug so it can be reclaimed.
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const slug = session.metadata?.slug;
      if (slug) await repos.control.releaseSlug(slug);
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

    // Successful renewal / dunning recovery: (re)activate the centre.
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      if (customerId) {
        const org = await repos.control.organisationByStripeCustomer(customerId);
        if (org) await repos.control.updateOrganisation(org.id, { subscriptionStatus: "active", status: "active", pastDueSince: null });
      }
      // Books: revenue + Stripe fee (idempotent; never fails the webhook).
      try { await recordInvoicePaid(await getDb(), repos, env, invoice); } catch (err) { console.error("[finance] invoice.paid not booked:", (err as Error).message); }
      return;
    }

    case "charge.refunded": {
      try { await recordChargeRefunded(await getDb(), repos, event.data.object as Stripe.Charge); } catch (err) { console.error("[finance] refund not booked:", (err as Error).message); }
      return;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      if (!customerId) return;
      const org = await repos.control.organisationByStripeCustomer(customerId);
      if (org) await repos.control.updateOrganisation(org.id, { subscriptionStatus: "past_due", ...(org.pastDueSince ? {} : { pastDueSince: new Date() }) });
      return;
    }

    // Nudge the centre before a trial lapses (best-effort in-app notification).
    case "customer.subscription.trial_will_end": {
      const sub = event.data.object as Stripe.Subscription;
      const org = await orgForSubscription(repos, sub);
      if (org) {
        await repos.tenant.notification.insert(
          { organisationId: org.id, slug: org.slug, system: true, reason: "stripe-trial-warning" },
          { channel: "in_app", title: "Your trial is ending soon", body: "Add a payment method to keep your centre active." },
        );
      }
      return;
    }

    default:
      return; // ignore everything else
  }
}

async function provisionFromSession(
  env: CloudflareEnv,
  repos: Repositories,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const m = session.metadata ?? {};

  // One-off "done-for-you" setup service (mode: payment). Flag the centre as
  // having paid for concierge setup when we know which org it is. This must be
  // checked BEFORE the org_id subscription branch: a setup checkout for an
  // existing centre also carries org_id but must NOT flip its subscription on.
  if (m.setup_service === "1") {
    if (m.org_id) {
      await repos.control.updateOrganisation(m.org_id, { setupPurchasedAt: new Date() });
    }
    return;
  }

  // A free-trial centre converting to paid: link the subscription to the org.
  if (m.org_id) {
    await repos.control.updateOrganisation(m.org_id, {
      subscriptionStatus: "active",
      status: "active",
      stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
      stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : null,
    });
    return;
  }

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
