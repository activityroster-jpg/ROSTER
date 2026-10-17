import { isKnownTimeZone } from "@/lib/domain/time";
import { TERMS_VERSION } from "@/lib/legal";
import type { Repositories } from "@/lib/db/repositories";
import type { CloudflareEnv } from "@/lib/cf/bindings";
import { JURISDICTIONS, PLANS, SETUP_MODES, type Jurisdiction, type Plan, type SetupMode, type SubscriptionStatus } from "@/lib/db/schema";
import { seedOrganisationDefaults } from "@/lib/seed/seed";
import { isActivityType, packFor } from "@/lib/packs";
import type { AnyTenantContext, SystemTenantContext } from "@/lib/tenant/context";
import { escapeHtml, sendEmail } from "@/lib/mail";
import { eraseOrganisationData } from "@/lib/services/export";

export interface ProvisionParams {
  slug: string;
  centreName: string;
  ownerEmail: string;
  jurisdiction: string;
  /** Which activity pack sets the centre up (lib/packs); unknown → RYA centre. */
  activityType?: string;
  plan: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  /** Defaults to "active" (paid checkout). Free-month signups pass "trialing". */
  subscriptionStatus?: SubscriptionStatus;
  /** "basic" (ready to use) or "full" (they'll finish configuring). */
  setupMode?: SetupMode;
  /** If the owner's auth user already exists (e.g. created via Better Auth at
   *  signup), link the admin membership to this id instead of creating a shell. */
  ownerUserId?: string;
  /** IANA zone detected from the sign-up browser; kept internally (digest timing, device clock fallback), never shown. */
  timeZone?: string;
}

function coerceSetupMode(v: string | undefined): SetupMode {
  return v && (SETUP_MODES as readonly string[]).includes(v) ? (v as SetupMode) : "basic";
}

function coerceJurisdiction(v: string): Jurisdiction {
  return (JURISDICTIONS as readonly string[]).includes(v) ? (v as Jurisdiction) : "england";
}
function coercePlan(v: string): Plan {
  return (PLANS as readonly string[]).includes(v) ? (v as Plan) : "rostering";
}

/**
 * Idempotently provision a centre from a completed checkout. Safe to call more
 * than once for the same slug (the webhook layer also dedupes on event id): if
 * the org already exists we only backfill Stripe ids and return.
 *
 * Steps: create organisation → owner user + admin membership → seed the activity pack's defaults
 * → release the slug reservation → email the owner a sign-in link.
 */
export async function provisionCentre(
  repos: Repositories,
  env: CloudflareEnv,
  params: ProvisionParams,
): Promise<{ organisationId: string; created: boolean }> {
  const { control, tenant } = repos;
  const slug = params.slug.toLowerCase();

  const existing = await control.organisationBySlug(slug);
  if (existing) {
    await control.updateOrganisation(existing.id, {
      stripeCustomerId: params.stripeCustomerId ?? existing.stripeCustomerId,
      stripeSubscriptionId: params.stripeSubscriptionId ?? existing.stripeSubscriptionId,
      subscriptionStatus: "active",
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: new Date(),
      status: "active",
    });
    return { organisationId: existing.id, created: false };
  }

  const jurisdiction = coerceJurisdiction(params.jurisdiction);
  const plan = coercePlan(params.plan);
  const setupMode = coerceSetupMode(params.setupMode);

  const activityType = isActivityType(params.activityType) ? params.activityType : "rya_centre";
  const org = await control.createOrganisation({
    name: params.centreName,
    slug,
    jurisdiction,
    activityType,
    plan,
    status: "active",
    subscriptionStatus: params.subscriptionStatus ?? "active",
    stripeCustomerId: params.stripeCustomerId,
    stripeSubscriptionId: params.stripeSubscriptionId,
  });

  const owner = params.ownerUserId
    ? { id: params.ownerUserId }
    : (await control.userByEmail(params.ownerEmail)) ??
      (await control.createUser({ name: params.centreName, email: params.ownerEmail }));
  await control.createMembership({ userId: owner.id, organisationId: org.id, role: "owner" });

  const ctx: SystemTenantContext = {
    organisationId: org.id,
    slug: org.slug,
    system: true,
    reason: "stripe-provisioning",
  };
  await seedOrganisationDefaults(tenant, ctx, jurisdiction, packFor(activityType));

  // Record how the centre chose to start (basic ready-to-use vs full config).
  const settings = (await tenant.orgSettings.list(ctx))[0];
  if (settings) await tenant.orgSettings.update(ctx, settings.id, { setupMode, ...(isKnownTimeZone(params.timeZone) ? { timezone: params.timeZone } : {}) });

  await control.releaseSlug(slug);

  // Welcome email is best-effort and only for the paid/checkout path — the
  // free-month signup sends its own email-confirmation link, so we skip it here
  // to avoid two conflicting emails.
  if (params.subscriptionStatus !== "trialing") {
    try {
      const appUrl = `https://${slug}.${env.APP_APEX_DOMAIN}`;
      await sendEmail({
        to: params.ownerEmail,
        subject: `Your ActivityRoster centre is ready — ${params.centreName}`,
        html: `
          <p>Welcome to ActivityRoster!</p>
          <p>Your centre <strong>${escapeHtml(params.centreName)}</strong> is set up at
            <a href="${appUrl}">${slug}.${env.APP_APEX_DOMAIN}</a>.</p>
          <p>Sign in to get started.</p>
        `,
      });
    } catch (err) {
      console.error(`[provision] welcome email failed for ${slug}:`, (err as Error).message);
    }
  }

  return { organisationId: org.id, created: true };
}

/** A centre made longer ago than this is never touched by {@link undoHalfMadeCentre}. */
const HALF_MADE_WINDOW_MS = 15 * 60 * 1000;

/**
 * Undo a sign-up that failed part-way through {@link provisionCentre}: remove the
 * centre made moments ago (and whatever was seeded into it) and the brand-new
 * login, so the same email and web address can simply try again.
 *
 * Guarded so it can never reach an established centre: the centre must have been
 * created in the last few minutes, have no Stripe subscription, and have no member
 * other than this owner. The login goes only if it belongs to no centre at all
 * (`deleteOrphanUser`), which is also the proof that the undo is complete.
 */
export async function undoHalfMadeCentre(
  repos: Repositories,
  input: { slug: string; ownerUserId: string; deleteFiles?: (ctx: AnyTenantContext) => Promise<number> },
): Promise<{ centreRemoved: boolean; loginRemoved: boolean }> {
  const { control } = repos;
  const slug = input.slug.toLowerCase();
  let centreRemoved = false;

  const org = await control.organisationBySlug(slug);
  if (org) {
    const created = org.createdAt instanceof Date ? org.createdAt.getTime() : Number(org.createdAt ?? 0);
    const fresh = Date.now() - created <= HALF_MADE_WINDOW_MS;
    const members = await control.memberUsers(org.id);
    const onlyThisOwner = members.every((m) => m.userId === input.ownerUserId);
    if (fresh && onlyThisOwner && !org.stripeSubscriptionId) {
      const ctx: SystemTenantContext = { organisationId: org.id, slug: org.slug, system: true, reason: "sign-up undone" };
      const res = await eraseOrganisationData(repos, ctx, input.deleteFiles ? { deleteFiles: input.deleteFiles } : {});
      centreRemoved = res.erased;
    }
  }

  const loginRemoved = await control.deleteOrphanUser(input.ownerUserId);
  await control.releaseSlug(slug).catch(() => {});
  return { centreRemoved, loginRemoved };
}
