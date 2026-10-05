import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { eraseOrganisationData } from "./export";

/**
 * Remove a centre the platform owner set up to test (decided 5 Oct). Unlike a
 * customer leaving, there is no 90-day export window: the centre, everything in
 * it and its uploaded files go straight away, and so do the logins that belonged
 * only to it, so the same emails can sign up again.
 *
 * Guard rails: the address must be typed, "this is a test centre" ticked, and a
 * centre with a live Stripe subscription is refused (cancel it first). A login
 * that is also in another centre is kept, and so is any platform admin's login.
 */
export type RemoveTestCentreResult =
  | { ok: true; name: string; slug: string; loginsRemoved: number; loginsKept: number; files?: number }
  | { ok: false; error: string };

const LIVE_SUBSCRIPTION = new Set(["trialing", "active", "past_due", "unpaid", "incomplete"]);

export async function removeTestCentre(
  repos: Repositories,
  input: {
    organisationId: string;
    confirmSlug: string;
    confirmedTest: boolean;
    actorUserId: string | null;
    isProtectedEmail: (email: string) => Promise<boolean>;
    deleteFiles?: (ctx: AnyTenantContext) => Promise<number>;
  },
): Promise<RemoveTestCentreResult> {
  const org = await repos.control.organisationById(input.organisationId);
  if (!org) return { ok: false, error: "Centre not found" };
  if (!input.confirmedTest) return { ok: false, error: "Tick the box to confirm this is a test centre, not a customer" };
  if (input.confirmSlug.trim().toLowerCase() !== org.slug) return { ok: false, error: "Type the centre's address exactly to confirm" };
  if (org.stripeSubscriptionId && org.subscriptionStatus && LIVE_SUBSCRIPTION.has(org.subscriptionStatus)) {
    return { ok: false, error: "This centre has a live Stripe subscription. Cancel it in Stripe first, then remove the centre." };
  }

  const members = await repos.control.memberUsers(org.id);
  const ctx: SystemTenantContext = { organisationId: org.id, slug: org.slug, system: true, reason: "test centre removed" };
  const res = await eraseOrganisationData(repos, ctx, input.deleteFiles ? { deleteFiles: input.deleteFiles } : {});
  if (!res.erased) return { ok: false, error: "Nothing to remove" };

  let loginsRemoved = 0, loginsKept = 0;
  for (const m of members) {
    if (await input.isProtectedEmail(m.email)) { loginsKept++; continue; }
    // Only removes a login with no membership left anywhere else.
    if (await repos.control.deleteOrphanUser(m.userId)) loginsRemoved++;
    else loginsKept++;
  }

  // The centre's own change log went with it; this record lives on the platform side.
  if (input.actorUserId) {
    await repos.control.logSecurityEvent({
      userId: input.actorUserId,
      organisationId: org.id,
      kind: "test_centre_removed",
      meta: JSON.stringify({ name: org.name, slug: org.slug, loginsRemoved, loginsKept, files: res.files ?? null, at: new Date().toISOString() }),
    }).catch(() => {});
  }
  console.info(`[test-centre] ${org.slug} removed: ${loginsRemoved} logins removed, ${loginsKept} kept`);
  return { ok: true, name: org.name, slug: org.slug, loginsRemoved, loginsKept, files: res.files };
}
