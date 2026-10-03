"use server";

import { requireTenant } from "@/lib/tenant/require";
import { getEnv } from "@/lib/cf/bindings";
import { createSubscriptionCheckout } from "@/lib/billing/checkout";
import { createSetupCheckout } from "@/lib/billing/setup";
import { BILLING_INTERVALS, type BillingInterval } from "@/lib/billing/plans";

export type CheckoutResult = { ok: boolean; url?: string; error?: string };

/** Start a Stripe Checkout session to convert this centre's trial to a paid plan. */
export async function startCheckoutAction(interval: string): Promise<CheckoutResult> {
  const { ctx, organisation, repos } = await requireTenant({ role: "admin", allowReadOnly: true });
  if (!(BILLING_INTERVALS as readonly string[]).includes(interval)) return { ok: false, error: "Invalid plan" };

  const user = await repos.control.userById(ctx.userId);
  try {
    const { url } = await createSubscriptionCheckout(getEnv(), {
      orgId: organisation.id,
      slug: organisation.slug,
      ownerEmail: user?.email ?? "",
      interval: interval as BillingInterval,
      tier: organisation.tier,
      stripeCustomerId: organisation.stripeCustomerId,
      discountPercent: organisation.discountPercent,
      freeMonths: organisation.freeMonths,
    });
    return { ok: true, url };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Start a Stripe Checkout session for the one-off setup & customisation service. */
export async function startSetupCheckoutAction(onsite = false): Promise<CheckoutResult> {
  const { ctx, organisation, repos } = await requireTenant({ role: "admin", allowReadOnly: true });
  const user = await repos.control.userById(ctx.userId);
  try {
    const { url } = await createSetupCheckout(getEnv(), {
      orgId: organisation.id,
      slug: organisation.slug,
      email: user?.email ?? null,
      stripeCustomerId: organisation.stripeCustomerId,
      returnBase: `https://${organisation.slug}.${getEnv().APP_APEX_DOMAIN}`,
      onsite: onsite === true,
    });
    return { ok: true, url };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
