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
  // the account). Better Auth sends a confirmation email; the owner must click
  // it to verify their address before they can sign in to their new centre.
  const centreUrl = `https://${slug}.${env.APP_APEX_DOMAIN}`;
  const auth = await getAuth();
  const existing = await control.userByEmail(ownerEmail);
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists — please sign in to add a centre." },
      { status: 409 },
    );
  }
  try {
    await auth.api.signUpEmail({
      body: { email: ownerEmail, password, name: centreName, callbackURL: `${centreUrl}/office` },
    });
  } catch (err) {
    const detail = (err as Error).message;
    console.error("[signup] account creation failed:", detail);
    return NextResponse.json({ error: "Could not create your account. Try a different email or sign in.", detail }, { status: 400 });
  }

  const owner = await control.userByEmail(ownerEmail);
  if (!owner) {
    return NextResponse.json({ error: "Could not create your account. Please try again." }, { status: 500 });
  }

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

  // Send the confirmation email explicitly, best-effort: a mail failure must not
  // fail an already-provisioned centre. We report whether it sent so the UI can
  // guide the owner (and so we can see any Resend error while getting set up).
  let emailSent = false;
  let emailError: string | undefined;
  try {
    await auth.api.sendVerificationEmail({ body: { email: ownerEmail, callbackURL: `${centreUrl}/office` } });
    emailSent = true;
  } catch (err) {
    emailError = (err as Error).message;
    console.error("[signup] verification email failed:", emailError);
  }

  // Best-effort lead capture for the marketing funnel.
  try {
    await control.captureLead({ email: ownerEmail, centreName, orgType: null, message: `trial:${setupMode}`, source: "signup" });
  } catch {
    /* ignore */
  }

  return NextResponse.json({ ok: true, slug, url: `https://${slug}.${env.APP_APEX_DOMAIN}`, setupMode, emailSent, emailError });
}
