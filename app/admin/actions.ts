"use server";

import { revalidatePath } from "next/cache";
import { idSchema, isoDateSchema, trialDaysSchema } from "@/lib/validation/actions";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { resolvePrices, PRICE_KINDS } from "@/lib/billing/prices";
import { getDb, getEnv, getRepositories } from "@/lib/cf/bindings";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { GHOST_COOKIE, GHOST_TTL_S, signGhostToken } from "@/lib/auth/ghost";
import { authSecret } from "@/lib/security/secrets";
import { recordSecurityEvent } from "@/lib/security/events";
import { leavingDeadline, onOrganisationStatusChanged } from "@/lib/services/leaving";
import { eraseOrganisationData } from "@/lib/services/export";
import { replayDeletions } from "@/lib/services/person-data";
import { writeIncident, writeMaintenance } from "@/lib/ops/incident";
import { escapeHtml, sendEmail } from "@/lib/mail";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { createStripe } from "@/lib/billing/stripe";
import { createPromotionCode, type CouponSpec } from "@/lib/billing/coupons";
import { TIERS } from "@/lib/tiers";
import { trialEndsAt } from "@/lib/billing/trial";
import { ORG_STATUSES, SUBSCRIPTION_STATUSES, PLANS, ORG_TIERS, ERROR_REPORT_STATUSES, type OrgStatus, type SubscriptionStatus, type Plan, type OrgTier, type ErrorReportStatus } from "@/lib/db/schema";

type Result = { ok: boolean; error?: string };

const num = (v: unknown): number | null => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Update the global default pricing (all centres inherit this unless overridden). */
export async function setGlobalPricingAction(input: {
  monthlyPrice?: number; annualPrice?: number; currency: string; trialDays: number; freeFirstMonth: boolean;
  setupPrice?: number; setupEnabled?: boolean;
}): Promise<Result> {
  await requirePlatformAdmin();
  const trial = num(input.trialDays);
  if (trial == null || trial < 0) return { ok: false, error: "Enter a valid trial length" };
  // Plan prices come from the tiers (lib/tiers); the stored defaults only back
  // tier-less callers, so they mirror Standard unless explicitly given.
  const monthly = num(input.monthlyPrice) ?? TIERS.standard.monthlyPrice;
  const annual = num(input.annualPrice) ?? TIERS.standard.annualPrice;
  if (monthly < 0 || annual < 0) return { ok: false, error: "Enter valid prices" };
  const setup = num(input.setupPrice);
  if (input.setupPrice !== undefined && (setup == null || setup < 0)) {
    return { ok: false, error: "Enter a valid setup price" };
  }
  const platform = new PlatformRepository(await getDb());
  await platform.upsertPricing({
    monthlyPrice: monthly,
    annualPrice: annual,
    currency: (input.currency || "GBP").toUpperCase().slice(0, 3),
    trialDays: Math.round(trial),
    freeFirstMonth: Boolean(input.freeFirstMonth),
    ...(setup != null ? { setupPrice: setup } : {}),
    ...(input.setupEnabled !== undefined ? { setupEnabled: Boolean(input.setupEnabled) } : {}),
  });
  revalidatePath("/admin");
  revalidatePath("/admin/pricing");
  revalidatePath("/pricing");
  return { ok: true };
}

/** Triage an error report (new → seen → resolved). */
export async function setErrorStatusAction(id: string, status: string): Promise<Result> {
  await requirePlatformAdmin();
  if (!(ERROR_REPORT_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Invalid status" };
  const { control } = await getRepositories();
  await control.setErrorReportStatus(id, status as ErrorReportStatus);
  revalidatePath("/admin/errors");
  return { ok: true };
}

/** Create a shareable marketing promo code (percentage off, or N months free). */
export async function createPromoCodeAction(input: {
  code: string; kind: string; value: number; maxRedemptions?: number;
}): Promise<Result & { code?: string }> {
  await requirePlatformAdmin();
  const code = (input.code ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9]{3,40}$/.test(code)) return { ok: false, error: "Code must be 3–40 letters/numbers." };
  const value = num(input.value);
  if (value == null || value <= 0) return { ok: false, error: "Enter a value." };
  const spec: CouponSpec = input.kind === "free_months"
    ? { kind: "free_months", months: Math.round(value) }
    : { kind: "percent", percent: value };
  try {
    const stripe = createStripe(getEnv());
    const res = await createPromotionCode(stripe, { spec, code, maxRedemptions: input.maxRedemptions && input.maxRedemptions > 0 ? Math.round(input.maxRedemptions) : undefined });
    revalidatePath("/admin");
    return { ok: true, code: res.code };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Set a single centre's pricing overrides (discount / custom price / free months). */
export async function setOrgPricingAction(id: string, input: {
  discountPercent: number; customMonthlyPrice: number | null; customAnnualPrice: number | null; freeMonths: number; billingNote: string;
}): Promise<Result> {
  await requirePlatformAdmin();
  const disc = num(input.discountPercent) ?? 0;
  if (disc < 0 || disc > 100) return { ok: false, error: "Discount must be 0–100%" };
  const { control } = await getRepositories();
  const updated = await control.updateOrganisation(id, {
    discountPercent: disc,
    customMonthlyPrice: num(input.customMonthlyPrice),
    customAnnualPrice: num(input.customAnnualPrice),
    freeMonths: Math.max(0, Math.round(num(input.freeMonths) ?? 0)),
    billingNote: input.billingNote?.trim() || null,
  });
  if (!updated) return { ok: false, error: "Not found" };
  revalidatePath("/admin");
  revalidatePath(`/admin/centres/${id}`);
  return { ok: true };
}

export async function setOrgStatusAction(id: string, status: string): Promise<Result> {
  await requirePlatformAdmin();
  if (!(ORG_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Invalid status" };
  const { control, db } = await getRepositories();
  const before = await control.organisationById(id);
  if (!before) return { ok: false, error: "Not found" };
  const updated = await control.updateOrganisation(id, { status: status as OrgStatus });
  if (!updated) return { ok: false, error: "Not found" };
  // Leaving: stamp the change and send the written confirmation with the 90-day export window.
  await onOrganisationStatusChanged(db, getEnv(), updated, before.status).catch((e: Error) => console.error("[leaving] notify failed:", e.message));
  revalidatePath("/admin");
  revalidatePath(`/admin/centres/${id}`);
  return { ok: true };
}

/**
 * Permanently erase a centre from the Dev Center. Only offered once the
 * 90-day export window has closed; the slug must be typed to confirm. Every
 * tenant row goes, the audit log with it (its append-only trigger allows the
 * cascade), and a confirmation is sent to the centre's former admins.
 */
export async function eraseCentreAction(id: string, confirmSlug: string): Promise<Result> {
  const { email } = await requirePlatformAdmin();
  const repos = await getRepositories();
  const org = await repos.control.organisationById(id);
  if (!org) return { ok: false, error: "Not found" };
  if (confirmSlug.trim() !== org.slug) return { ok: false, error: "Type the centre's address exactly to confirm" };
  const deadline = leavingDeadline(org);
  if (!deadline) return { ok: false, error: "Suspend or cancel the centre first; erasure is only offered after the 90-day export window" };
  if (deadline.getTime() > Date.now()) return { ok: false, error: `The export window runs until ${deadline.toLocaleDateString("en-GB")}` };
  const admins = await repos.control.adminEmailsForOrg(id);
  const res = await eraseOrganisationData(repos, { organisationId: org.id, slug: org.slug, system: true, reason: `erased by ${email}` });
  if (res.erased) {
    console.info(`[leaving] centre ${org.slug} erased by a platform admin`);
    await Promise.all(admins.map((to) => sendEmail({ to, subject: `${org.name}: your data has been deleted`, html: `<p>Hello,</p><p>This confirms that <strong>${escapeHtml(org.name)}</strong> and all of its records have now been permanently deleted from ActivityRoster, as notified. Encrypted backups age out within 35 days.</p><p>Thank you for having used ActivityRoster.</p>` }).catch(() => {})));
  }
  revalidatePath("/admin");
  return res.erased ? { ok: true } : { ok: false, error: "Nothing to erase" };
}

export async function setSubscriptionStatusAction(id: string, sub: string): Promise<Result> {
  await requirePlatformAdmin();
  if (!(SUBSCRIPTION_STATUSES as readonly string[]).includes(sub)) return { ok: false, error: "Invalid subscription status" };
  const { control } = await getRepositories();
  const updated = await control.updateOrganisation(id, { subscriptionStatus: sub as SubscriptionStatus });
  if (!updated) return { ok: false, error: "Not found" };
  revalidatePath("/admin");
  revalidatePath(`/admin/centres/${id}`);
  return { ok: true };
}

export async function setOrgTierAction(id: string, tier: string): Promise<Result> {
  await requirePlatformAdmin();
  if (!(ORG_TIERS as readonly string[]).includes(tier)) return { ok: false, error: "Invalid tier" };
  const { control } = await getRepositories();
  const updated = await control.updateOrganisation(id, { tier: tier as OrgTier });
  if (!updated) return { ok: false, error: "Not found" };
  revalidatePath("/admin");
  revalidatePath(`/admin/centres/${id}`);
  return { ok: true };
}

export async function setPlanAction(id: string, plan: string): Promise<Result> {
  await requirePlatformAdmin();
  if (!(PLANS as readonly string[]).includes(plan)) return { ok: false, error: "Invalid plan" };
  const { control } = await getRepositories();
  const updated = await control.updateOrganisation(id, { plan: plan as Plan });
  if (!updated) return { ok: false, error: "Not found" };
  revalidatePath("/admin");
  revalidatePath(`/admin/centres/${id}`);
  return { ok: true };
}

/** Drop the hour-long cache and look the prices up on Stripe again. */
export async function refreshStripePricesAction(): Promise<{ ok: boolean; message?: string; error?: string }> {
  await requirePlatformAdmin();
  try {
    const all = await resolvePrices(getEnv(), { fresh: true });
    const found = PRICE_KINDS.filter((k) => all[k]).length;
    revalidatePath("/admin");
    return { ok: true, message: `Found ${found} of ${PRICE_KINDS.length} prices on Stripe` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Ghost Mode: open a centre's office read-only and invisibly. Issues a signed,
 * 30-minute cookie bound to this admin + org, logs the start owner-side, and
 * sends the admin to the centre's subdomain.
 */
export async function startGhostAction(orgId: string): Promise<Result> {
  await requirePlatformAdmin();
  const env = getEnv();
  const { control } = await getRepositories();
  const org = typeof orgId === "string" && orgId ? await control.organisationById(orgId) : null;
  if (!org) return { ok: false, error: "Centre not found" };
  const session = await (await getAuth()).api.getSession({ headers: new Headers(await headers()) });
  if (!session?.user) return { ok: false, error: "Please sign in again" };

  const exp = Math.floor(Date.now() / 1000) + GHOST_TTL_S;
  const token = await signGhostToken(authSecret(env), { organisationId: org.id, adminUserId: session.user.id, exp });
  const jar = await cookies();
  jar.set(GHOST_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", domain: `.${env.APP_APEX_DOMAIN}`, maxAge: GHOST_TTL_S });
  await recordSecurityEvent("ghost_start", { userId: session.user.id, organisationId: org.id, meta: { slug: org.slug } });
  redirect(`https://${org.slug}.${env.APP_APEX_DOMAIN}/office`);
}


/** Set when a centre's free trial ends (null = back to the default length from sign-up). */
export async function setTrialEndsAtAction(id: string, isoDate: string | null): Promise<Result> {
  await requirePlatformAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Not found" };
  let when: Date | null = null;
  if (isoDate) {
    if (!isoDateSchema.safeParse(isoDate).success) return { ok: false, error: "Pick a date" };
    when = new Date(`${isoDate}T23:59:59.999Z`);
  }
  const { control } = await getRepositories();
  const updated = await control.updateOrganisation(id, { trialEndsAt: when });
  if (!updated) return { ok: false, error: "Not found" };
  revalidatePath("/admin");
  revalidatePath(`/admin/centres/${id}`);
  return { ok: true };
}

/** Extend a centre's trial by N days from today (or from its current end if that is later). */
export async function extendTrialAction(id: string, days: number): Promise<Result> {
  await requirePlatformAdmin();
  const parsedDays = trialDaysSchema.safeParse(days);
  if (!parsedDays.success || !idSchema.safeParse(id).success) return { ok: false, error: "Enter 1–365 days" };
  const n = parsedDays.data;
  const { control } = await getRepositories();
  const org = await control.organisationById(id);
  if (!org) return { ok: false, error: "Not found" };
  const pricing = await new PlatformRepository(await getDb()).getPricing().catch(() => null);
  const current = trialEndsAt(org, pricing?.trialDays ?? 30);
  const base = Math.max(current, Date.now());
  await control.updateOrganisation(id, { trialEndsAt: new Date(base + n * 24 * 60 * 60 * 1000), subscriptionStatus: org.subscriptionStatus ?? "trialing", status: "active" });
  revalidatePath("/admin");
  revalidatePath(`/admin/centres/${id}`);
  return { ok: true };
}

/** After a database restore: re-apply every anonymisation in a centre's deletion log. Safe to run any time. */
export async function replayDeletionsAction(organisationId: string): Promise<Result & { checked?: number; reapplied?: number }> {
  const { email } = await requirePlatformAdmin();
  const repos = await getRepositories();
  const org = await repos.control.organisationById(organisationId);
  if (!org) return { ok: false, error: "Not found" };
  const r = await replayDeletions(repos, { organisationId: org.id, slug: org.slug, system: true, reason: `replay deletions by ${email}` });
  revalidatePath(`/admin/centres/${organisationId}`);
  return { ok: true, ...r };
}

/** Show (or clear, with an empty message) the platform-wide incident banner. */
export async function setIncidentAction(message: string, level: "info" | "warn"): Promise<Result> {
  const { email } = await requirePlatformAdmin();
  const text = message.trim().slice(0, 240);
  await writeIncident(text ? { message: text, level: level === "warn" ? "warn" : "info", updatedAt: new Date().toISOString() } : null);
  console.info(`[ops] incident banner ${text ? "set" : "cleared"} by ${email}`);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Maintenance mode: office and app show a holding page to everyone but platform admins. */
export async function setMaintenanceAction(on: boolean, message: string): Promise<Result> {
  const { email } = await requirePlatformAdmin();
  await writeMaintenance({ on: Boolean(on), message: message.trim().slice(0, 240), updatedAt: new Date().toISOString() });
  console.info(`[ops] maintenance ${on ? "ON" : "off"} by ${email}`);
  revalidatePath("/", "layout");
  return { ok: true };
}
