import { NextResponse } from "next/server";
import { getEnv, getRepositories } from "@/lib/cf/bindings";
import { trialSignupSchema } from "@/lib/validation/signup";
import { provisionCentre } from "@/lib/billing/provision";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Free-month signup from the marketing site. Provisions a trial centre
 * (org + owner + admin membership + RYA defaults) with the chosen setup mode,
 * and returns the centre's URL. No card required; billing is set up later.
 */
export async function POST(req: Request) {
  const limit = await rateLimit(`signup:${clientIp(req)}`, 8, 300);
  if (!limit.allowed) return tooManyRequests();

  const parsed = trialSignupSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Please check your details";
    return NextResponse.json({ error: first }, { status: 400 });
  }
  const { centreName, slug, ownerEmail, jurisdiction, setupMode } = parsed.data;

  const { control } = await getRepositories();
  if (await control.slugTaken(slug)) {
    return NextResponse.json({ error: "That address is already taken — try another." }, { status: 409 });
  }

  const env = getEnv();
  const repos = await getRepositories();
  try {
    await provisionCentre(repos, env, {
      slug,
      centreName,
      ownerEmail,
      jurisdiction,
      plan: "rostering",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: "trialing",
      setupMode,
    });
  } catch (err) {
    console.error("[signup] provisioning failed:", (err as Error).message);
    return NextResponse.json({ error: "Could not set up your centre. Please try again." }, { status: 500 });
  }

  // Best-effort lead capture for the marketing funnel.
  try {
    await control.captureLead({ email: ownerEmail, centreName, orgType: null, message: `trial:${setupMode}`, source: "signup" });
  } catch {
    /* ignore */
  }

  return NextResponse.json({ ok: true, slug, url: `https://${slug}.${env.APP_APEX_DOMAIN}`, setupMode });
}
