import { NextResponse } from "next/server";
import { getEnv, getRepositories } from "@/lib/cf/bindings";
import { getAuth } from "@/lib/auth";
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
  const { centreName, slug, ownerEmail, password, jurisdiction, setupMode } = parsed.data;

  const env = getEnv();
  const repos = await getRepositories();
  const { control } = repos;

  if (await control.slugTaken(slug)) {
    return NextResponse.json({ error: "That address is already taken — try another." }, { status: 409 });
  }

  // Create the owner's login through Better Auth (hashes the password + creates
  // the account), then mark the email verified so they can sign in immediately
  // — no email round-trip required to get into their new centre.
  const auth = await getAuth();
  const existing = await control.userByEmail(ownerEmail);
  if (!existing) {
    try {
      await auth.api.signUpEmail({ body: { email: ownerEmail, password, name: centreName } });
    } catch (err) {
      console.error("[signup] account creation failed:", (err as Error).message);
      return NextResponse.json({ error: "Could not create your account. Try a different email or sign in." }, { status: 400 });
    }
  } else {
    return NextResponse.json(
      { error: "An account with that email already exists — please sign in to add a centre." },
      { status: 409 },
    );
  }

  const owner = await control.userByEmail(ownerEmail);
  if (!owner) {
    return NextResponse.json({ error: "Could not create your account. Please try again." }, { status: 500 });
  }
  await control.markEmailVerified(owner.id);

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
      ownerUserId: owner.id,
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
