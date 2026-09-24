import type { Repositories } from "@/lib/db/repositories";
import type { CloudflareEnv } from "@/lib/cf/bindings";
import { JURISDICTIONS, PLANS, SETUP_MODES, type Jurisdiction, type Plan, type SetupMode, type SubscriptionStatus } from "@/lib/db/schema";
import { seedOrganisationDefaults } from "@/lib/seed/seed";
import type { SystemTenantContext } from "@/lib/tenant/context";
import { sendEmail } from "@/lib/mail";

export interface ProvisionParams {
  slug: string;
  centreName: string;
  ownerEmail: string;
  jurisdiction: string;
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
 * Steps: create organisation → owner user + admin membership → seed RYA defaults
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
      status: "active",
    });
    return { organisationId: existing.id, created: false };
  }

  const jurisdiction = coerceJurisdiction(params.jurisdiction);
  const plan = coercePlan(params.plan);
  const setupMode = coerceSetupMode(params.setupMode);

  const org = await control.createOrganisation({
    name: params.centreName,
    slug,
    jurisdiction,
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
  await control.createMembership({ userId: owner.id, organisationId: org.id, role: "admin" });

  const ctx: SystemTenantContext = {
    organisationId: org.id,
    slug: org.slug,
    system: true,
    reason: "stripe-provisioning",
  };
  await seedOrganisationDefaults(tenant, ctx, jurisdiction);

  // Record how the centre chose to start (basic ready-to-use vs full config).
  const settings = (await tenant.orgSettings.list(ctx))[0];
  if (settings) await tenant.orgSettings.update(ctx, settings.id, { setupMode });

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
          <p>Your centre <strong>${params.centreName}</strong> is set up at
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
