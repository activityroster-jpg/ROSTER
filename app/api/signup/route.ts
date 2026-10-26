import { NextResponse } from "next/server";
import { getEnv, getRepositories } from "@/lib/cf/bindings";
import { getAuth } from "@/lib/auth";
import { trialSignupSchema } from "@/lib/validation/signup";
import { provisionCentre, undoHalfMadeCentre } from "@/lib/billing/provision";
import { captureException } from "@/lib/observability/sentry";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/rate-limit";
import { isPwnedPassword, PWNED_MESSAGE } from "@/lib/security/pwned";
import { verifyTurnstile } from "@/lib/security/turnstile";

export const dynamic = "force-dynamic";

/** How long a web address is held while the account + centre are being created. */
const SLUG_HOLD_MS = 10 * 60 * 1000;

/**
 * Free-month signup from the marketing site. Provisions a trial centre
 * (org + owner + admin membership + RYA defaults) with the chosen setup mode,
 * and returns the centre's URL. No card required; billing is set up later.
 *
 * Order matters: the web address is reserved first (two people can't race for
 * it), the login is created, then the centre. If the centre can't be finished
 * the half-made centre and the brand-new login are both removed again, so the
 * same email and address can simply try again (and the reason is in Dev Center → Errors).
 */
export async function POST(req: Request) {
  const limit = await rateLimit(`signup:${clientIp(req)}`, 8, 300);
  if (!limit.allowed) return tooManyRequests();

  // Human check (skipped until TURNSTILE_SECRET_KEY is set).
  const raw = await req.clone().json().catch(() => null) as { turnstileToken?: string } | null;
  const human = await verifyTurnstile(raw?.turnstileToken, clientIp(req));
  if (!human.ok) return NextResponse.json({ error: human.reason }, { status: 400 });
  const parsed = trialSignupSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Please check your details";
    return NextResponse.json({ error: first }, { status: 400 });
  }
  const { centreName, slug, ownerEmail, password, jurisdiction, activityType, setupMode, timeZone, tier, source } = parsed.data;

  const env = getEnv();
  const repos = await getRepositories();
  const { control } = repos;

  if (await control.slugTaken(slug)) {
    return NextResponse.json({ error: "That address is already taken — try another." }, { status: 409 });
  }
  // Someone who already has a login (an instructor, or a person who created an
  // account in the app before coming here) may own a centre with it, but only
  // while signed in as that person: the session is the proof, not the typed email.
  const auth = await getAuth();
  const existing = await control.userByEmail(ownerEmail);
  if (existing) {
    const s = await auth.api.getSession({ headers: new Headers(req.headers) }).catch(() => null);
    if (!s?.user || s.user.email.toLowerCase() !== ownerEmail) {
      return NextResponse.json(
        { error: "This email already has an ActivityRoster account. Sign in with it, then come back here to create your centre.", code: "exists" },
        { status: 409 },
      );
    }
    if (!s.user.emailVerified) {
      return NextResponse.json({ error: "Confirm your email address first (the link we sent when you created your account), then create your centre." }, { status: 403 });
    }
  } else {
    if (!password) return NextResponse.json({ error: "Choose a password." }, { status: 400 });
    if (await isPwnedPassword(password)) {
      return NextResponse.json({ error: PWNED_MESSAGE }, { status: 400 });
    }
  }

  // Hold the address while we work; another signup for the same slug now waits.
  if (!(await control.reserveSlug(slug, SLUG_HOLD_MS))) {
    return NextResponse.json({ error: "That address is being set up by someone else right now — try another." }, { status: 409 });
  }

  // Create the owner's login through Better Auth (hashes the password + creates
  // the account). The owner must click the confirmation email before signing in.
  // An existing, signed-in login skips this: it already is the owner.
  const centreUrl = `https://${slug}.${env.APP_APEX_DOMAIN}`;
  if (!existing) {
    try {
      await auth.api.signUpEmail({
        body: { email: ownerEmail, password: password!, name: centreName, callbackURL: `${centreUrl}/office` },
      });
    } catch (err) {
      console.error("[signup] account creation failed:", (err as Error).message);
      await control.releaseSlug(slug).catch(() => {});
      return NextResponse.json({ error: "Could not create your account. Try a different email or sign in." }, { status: 400 });
    }
  }

  const owner = existing ?? await control.userByEmail(ownerEmail);
  if (!owner) {
    await control.releaseSlug(slug).catch(() => {});
    return NextResponse.json({ error: "Could not create your account. Please try again." }, { status: 500 });
  }

  try {
    await provisionCentre(repos, env, {
      slug,
      centreName,
      ownerEmail,
      jurisdiction,
      activityType,
      plan: "rostering",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: "trialing",
      setupMode,
      timeZone,
      ownerUserId: owner.id,
      tier,
    });
  } catch (err) {
    const reason = (err as Error).message;
    console.error("[signup] provisioning failed:", reason);
    // Undo whatever was made (centre, seeded defaults, login) so the same email and
    // address can simply try again; record why it failed in Dev Center → Errors.
    let undone: Awaited<ReturnType<typeof undoHalfMadeCentre>> | null = null;
    try {
      undone = await undoHalfMadeCentre(repos, { slug, ownerUserId: owner.id });
    } catch (e) {
      console.error("[signup] undo failed:", (e as Error).message);
    }
    const complete = Boolean(undone?.loginRemoved);
    try {
      await control.createErrorReport({
        path: "/api/signup",
        organisationSlug: slug,
        userEmail: ownerEmail,
        message: `Sign-up: the centre could not be set up (${reason}). ${complete ? "The half-made centre and login were removed; the person can try again." : "The half-made centre or login could NOT be removed: remove the centre in Dev Center → Centres so the email can sign up again."}`,
      });
    } catch (e) {
      console.error("[signup] error report failed:", (e as Error).message);
    }
    await captureException(err, { tags: { where: "signup" } });
    await control.releaseSlug(slug).catch(() => {});
    return NextResponse.json(
      {
        error: complete
          ? "Could not set up your centre. Please try again."
          : "Could not set up your centre. Please try again in a few minutes, or email hello@activityroster.com if it happens again.",
      },
      { status: 500 },
    );
  } finally {
    // The organisation row now owns the slug; the hold is no longer needed.
    await control.releaseSlug(slug).catch(() => {});
  }

  // Send the confirmation email explicitly, best-effort: a mail failure must not
  // fail an already-provisioned centre. We report only whether it sent so the UI
  // can guide the owner; the underlying error is logged server-side, not returned.
  // An existing login proved its email long ago and is signed in: straight in.
  let emailSent = false;
  if (!existing) {
    try {
      await auth.api.sendVerificationEmail({ body: { email: ownerEmail, callbackURL: `${centreUrl}/office` } });
      emailSent = true;
    } catch (err) {
      console.error("[signup] verification email failed:", (err as Error).message);
    }
  }

  // Best-effort lead capture for the marketing funnel.
  try {
    await control.captureLead({ email: ownerEmail, centreName, orgType: null, message: `trial:${setupMode}:${activityType}`, source: `signup:${source ?? "start"}` });
  } catch {
    /* ignore */
  }

  return NextResponse.json({ ok: true, slug, url: `https://${slug}.${env.APP_APEX_DOMAIN}`, setupMode, emailSent, existingAccount: Boolean(existing) });
}
