import { NextResponse } from "next/server";
import { getEnv, getRepositories } from "@/lib/cf/bindings";
import { signupSchema } from "@/lib/validation/signup";
import { validateSlug } from "@/lib/tenant/reserved";
import { createCheckoutSession } from "@/lib/billing/checkout";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/rate-limit";
import { captureException } from "@/lib/observability/sentry";

export const dynamic = "force-dynamic";

const SLUG_RESERVE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Start a self-serve signup. Everything the client sends is validated; the
 * price is resolved server-side by plan (never trusted from the client); the
 * slug is soft-reserved so two centres can't race for it. Provisioning itself
 * happens later on the Stripe webhook — never here.
 */
export async function POST(req: Request) {
  const limit = await rateLimit(`checkout:${clientIp(req)}`, 10, 60);
  if (!limit.allowed) return tooManyRequests();

  const parsed = signupSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid signup details", issues: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  // Belt-and-braces: re-check the slug server-side (format + reserved).
  const validation = validateSlug(input.slug);
  if (!validation.ok) {
    return NextResponse.json({ error: "That subdomain isn't available" }, { status: 400 });
  }

  const env = getEnv();
  const { control } = await getRepositories();

  if (await control.slugTaken(validation.slug)) {
    return NextResponse.json({ error: "That subdomain is already taken" }, { status: 409 });
  }

  const reserved = await control.reserveSlug(validation.slug, SLUG_RESERVE_TTL_MS);
  if (!reserved) {
    return NextResponse.json({ error: "That subdomain is being claimed by someone else" }, { status: 409 });
  }

  try {
    const { url } = await createCheckoutSession(env, { ...input, slug: validation.slug });
    return NextResponse.json({ url });
  } catch (err) {
    await control.releaseSlug(validation.slug);
    await captureException(err, { tags: { area: "checkout" } });
    return NextResponse.json({ error: `Could not start checkout: ${(err as Error).message}` }, { status: 500 });
  }
}
