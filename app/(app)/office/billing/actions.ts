"use server";

import { requireTenant } from "@/lib/tenant/require";
import { getEnv } from "@/lib/cf/bindings";
import { createSubscriptionCheckout } from "@/lib/billing/checkout";
import { BILLING_INTERVALS, type BillingInterval } from "@/lib/billing/plans";

export type CheckoutResult = { ok: boolean; url?: string; error?: string };

/** Start a Stripe Checkout session to convert this centre's trial to a paid plan. */
export async function startCheckoutAction(interval: string): Promise<CheckoutResult> {
  const { ctx, organisation, repos } = await requireTenant({ role: "admin" });
  if (!(BILLING_INTERVALS as readonly string[]).includes(interval)) return { ok: false, error: "Invalid plan" };

  const user = await repos.control.userById(ctx.userId);
  try {
    const { url } = await createSubscriptionCheckout(getEnv(), {
      orgId: organisation.id,
      slug: organisation.slug,
      ownerEmail: user?.email ?? "",
      interval: interval as BillingInterval,
      stripeCustomerId: organisation.stripeCustomerId,
      discountPercent: organisation.discountPercent,
      freeMonths: organisation.freeMonths,
    });
    return { ok: true, url };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
