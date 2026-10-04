import { NextResponse } from "next/server";
import { getDb, getEnv } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { createSetupCheckout } from "@/lib/billing/setup";
import { DEFAULT_PRICING } from "@/lib/pricing";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Public entry point for the one-off "done-for-you" setup service, linked from
 * the pricing page. Optional ?email= and ?slug= are carried into Stripe so the
 * purchase can be attributed. If the offer is switched off (or Stripe isn't
 * configured) we send the visitor to the contact form instead of erroring.
 */
export async function GET(req: Request) {
  const env = getEnv();
  const url = new URL(req.url);
  const apex = `https://${env.APP_APEX_DOMAIN}`;
  // Public and unauthenticated: each request creates a Stripe Checkout session, so cap it (audit C7).
  const limit = await rateLimit(`billing-setup:${clientIp(req)}`, 10, 60 * 60);
  if (!limit.allowed) return NextResponse.redirect(`${apex}/#get-demo`);

  let enabled: boolean = DEFAULT_PRICING.setupEnabled;
  try {
    const pricing = await new PlatformRepository(await getDb()).getPricing();
    enabled = Boolean(pricing.setupEnabled);
  } catch {
    // fall back to the default (enabled) if pricing can't be read
  }
  if (!enabled) return NextResponse.redirect(`${apex}/#get-demo`);

  const email = url.searchParams.get("email");
  const slug = url.searchParams.get("slug");
  const onsite = url.searchParams.get("onsite") === "1";
  try {
    const { url: checkoutUrl } = await createSetupCheckout(env, { email, slug, onsite });
    return NextResponse.redirect(checkoutUrl, 303);
  } catch {
    // Stripe not configured yet — don't leak the reason; route to the contact form.
    return NextResponse.redirect(`${apex}/#get-demo`);
  }
}
