import { NextResponse } from "next/server";
import { getEnv, getRepositories } from "@/lib/cf/bindings";
import { handleStripeWebhook } from "@/lib/billing/webhook";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook. The signature is verified against the RAW request body (read
 * via req.text() before any parsing), idempotency is enforced by the ledger, and
 * provisioning/revocation happen here — never in the browser redirect.
 */
export async function POST(req: Request) {
  // Generous limit: legitimate Stripe bursts are fine, abusive floods are not.
  const limit = await rateLimit(`stripe-webhook:${clientIp(req)}`, 120, 60);
  if (!limit.allowed) return tooManyRequests();

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  const env = getEnv();
  const repos = await getRepositories();
  const result = await handleStripeWebhook(env, repos, rawBody, signature);

  if (!result.ok) {
    // 400 tells Stripe to retry (signature/handler issues are transient enough).
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ received: true, handled: result.handled, duplicate: result.duplicate ?? false });
}
