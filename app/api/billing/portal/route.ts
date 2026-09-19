import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cf/bindings";
import { requireTenant } from "@/lib/tenant/require";
import { createPortalSession } from "@/lib/billing/portal";

export const dynamic = "force-dynamic";

/** Redirect an admin to the Stripe Customer Portal for their centre. */
export async function GET() {
  const { organisation } = await requireTenant({ role: "admin" });
  if (!organisation.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account on file" }, { status: 400 });
  }
  const env = getEnv();
  const returnUrl = `https://${organisation.slug}.${env.APP_APEX_DOMAIN}/office/settings`;
  try {
    const { url } = await createPortalSession(env, organisation.stripeCustomerId, returnUrl);
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
