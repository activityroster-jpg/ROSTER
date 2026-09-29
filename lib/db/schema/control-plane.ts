import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { boolCol, createdAt, id, updatedAt } from "./_shared";

/**
 * CONTROL-PLANE (global) tables.
 *
 * These are not tenant-owned; they describe accounts, auth, organisations
 * (centres), memberships and the Stripe webhook ledger. They are the only
 * tables the repository layer is allowed to touch without a tenant filter,
 * and even then only through dedicated, audited paths.
 *
 * The `user`, `session`, `account` and `verification` tables follow Better
 * Auth's expected shape — do not hand-roll auth logic against them.
 */

// --- Better Auth core ------------------------------------------------------

export const user = sqliteTable("user", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  emailVerified: boolCol("email_verified").default(false),
  image: text("image"),
  // twoFactor plugin
  twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }),
  // 4-digit login PIN (a second factor for centre admins + the platform owner).
  // Stored as a PBKDF2 hash; instructors never set one. Lockout after repeated
  // wrong attempts via the two counters below.
  pinHash: text("pin_hash"),
  pinFailedCount: integer("pin_failed_count").notNull().default(0),
  pinLockedUntil: integer("pin_locked_until", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex("user_email_uq").on(t.email)]);

export const session = sqliteTable("session", {
  id: id(),
  token: text("token").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // organization plugin: the org the session is currently acting within.
  activeOrganizationId: text("active_organization_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("session_token_uq").on(t.token),
  index("session_user_idx").on(t.userId),
]);

export const account = sqliteTable("account", {
  id: id(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("account_user_idx").on(t.userId)]);

export const verification = sqliteTable("verification", {
  id: id(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("verification_identifier_idx").on(t.identifier)]);

// --- Two-factor (twoFactor plugin) ----------------------------------------

export const twoFactor = sqliteTable("two_factor", {
  id: id(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // Fields required by the Better Auth twoFactor plugin (verification + lockout).
  verified: integer("verified", { mode: "boolean" }),
  failedVerificationCount: integer("failed_verification_count").default(0),
  lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
}, (t) => [index("two_factor_user_idx").on(t.userId)]);

// --- Organisations (centres) & membership ---------------------------------

export const JURISDICTIONS = [
  "england",
  "wales",
  "scotland",
  "northern_ireland",
  "ireland",
  "other",
] as const;
export type Jurisdiction = (typeof JURISDICTIONS)[number];

export const ORG_STATUSES = ["active", "suspended", "pending", "cancelled"] as const;
export type OrgStatus = (typeof ORG_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PLANS = ["rostering", "full"] as const;
export type Plan = (typeof PLANS)[number];

/**
 * A centre. `slug` is the subdomain ({slug}.activityroster.com) and is unique.
 * `jurisdiction` drives which vetting checks are mandatory (DBS/PVG/AccessNI/
 * Garda). Stripe identifiers are stored but never card data.
 */
export const organisation = sqliteTable("organisation", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  jurisdiction: text("jurisdiction", { enum: JURISDICTIONS }).notNull(),
  plan: text("plan", { enum: PLANS }).notNull().default("rostering"),
  status: text("status", { enum: ORG_STATUSES }).notNull().default("pending"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status", { enum: SUBSCRIPTION_STATUSES }),
  // Per-centre pricing overrides, all set from the platform admin. A custom price
  // wins over the global default; otherwise the discount % is applied. freeMonths
  // is a one-off run of free billing periods (e.g. a launch offer).
  discountPercent: real("discount_percent").notNull().default(0),
  customMonthlyPrice: real("custom_monthly_price"),
  customAnnualPrice: real("custom_annual_price"),
  freeMonths: integer("free_months").notNull().default(0),
  billingNote: text("billing_note"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("organisation_slug_uq").on(t.slug),
  uniqueIndex("organisation_stripe_customer_uq").on(t.stripeCustomerId),
]);

/**
 * Global default pricing, editable in the platform admin so all price changes,
 * reductions and offers flow from one place (and, when Stripe is wired, into
 * checkout). One row; `id` is always "default".
 */
export const platformPricing = sqliteTable("platform_pricing", {
  id: text("id").primaryKey().default("default"),
  monthlyPrice: real("monthly_price").notNull().default(75),
  annualPrice: real("annual_price").notNull().default(750),
  currency: text("currency").notNull().default("GBP"),
  freeFirstMonth: boolCol("free_first_month").default(true),
  trialDays: integer("trial_days").notNull().default(30),
  updatedAt: updatedAt(),
});

export const MEMBERSHIP_ROLES = ["admin", "instructor"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const MEMBERSHIP_STATUSES = ["active", "invited", "suspended"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

/**
 * Links a user to a centre with a role. Authorisation is checked against this
 * on every request — the subdomain is only a hint.
 */
export const membership = sqliteTable("membership", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  organisationId: text("organisation_id")
    .notNull()
    .references(() => organisation.id, { onDelete: "cascade" }),
  role: text("role", { enum: MEMBERSHIP_ROLES }).notNull(),
  status: text("status", { enum: MEMBERSHIP_STATUSES }).notNull().default("active"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("membership_user_org_uq").on(t.userId, t.organisationId),
  index("membership_org_idx").on(t.organisationId),
  index("membership_user_idx").on(t.userId),
]);

// --- Stripe webhook idempotency ledger ------------------------------------

/**
 * One row per Stripe event we have accepted. The UNIQUE constraint on
 * `stripeEventId` is the first idempotency layer; provisioning itself is the
 * second. Never process an event whose id already exists here.
 */
export const webhookEvent = sqliteTable("webhook_event", {
  id: id(),
  stripeEventId: text("stripe_event_id").notNull(),
  type: text("type").notNull(),
  payload: text("payload"),
  processedAt: integer("processed_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("webhook_event_stripe_id_uq").on(t.stripeEventId)]);

// --- Slug reservations (soft-reserve during checkout) ---------------------

/**
 * A slug soft-reserved while a checkout is pending, so two centres cannot race
 * for the same subdomain. Cleared/confirmed by the provisioning webhook.
 */
export const slugReservation = sqliteTable("slug_reservation", {
  id: id(),
  slug: text("slug").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("slug_reservation_slug_uq").on(t.slug)]);

// --- Marketing leads (email capture from the public site) ------------------

export const LEAD_ORG_TYPES = ["yacht_club", "sailing_school", "activity_centre", "other"] as const;
export type LeadOrgType = (typeof LEAD_ORG_TYPES)[number];

/**
 * A prospect who asked for the demo / left their email on the marketing site.
 * Control-plane (global, not tenant-owned); never linked to org data. Deduped on
 * email so repeated sign-ups don't pile up.
 */
export const lead = sqliteTable("lead", {
  id: id(),
  email: text("email").notNull(),
  centreName: text("centre_name"),
  orgType: text("org_type", { enum: LEAD_ORG_TYPES }),
  message: text("message"),
  source: text("source").notNull().default("marketing"),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("lead_email_uq").on(t.email)]);

// --- Marketing prospects (platform-owner outreach CRM) ---------------------

/** Outreach pipeline stage for a prospect centre/club. */
export const PROSPECT_STATUSES = [
  "new",
  "letter_sent",
  "email_sent",
  "linkedin_contacted",
  "called",
  "purchased",
  "rejected",
] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

/**
 * A prospective centre/club for the platform owner's marketing outreach — a
 * lightweight CRM. Control-plane (global, not tenant-owned); only ever reached
 * behind requirePlatformAdmin(). Postal fields feed the C5-window letter.
 */
export const marketingProspect = sqliteTable("marketing_prospect", {
  id: id(),
  name: text("name").notNull(),
  region: text("region"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  postcode: text("postcode"),
  country: text("country").notNull().default("United Kingdom"),
  email: text("email"),
  website: text("website"),
  linkedinUrl: text("linkedin_url"),
  contactName: text("contact_name"),
  contactRole: text("contact_role"),
  status: text("status", { enum: PROSPECT_STATUSES }).notNull().default("new"),
  notes: text("notes"),
  source: text("source").notNull().default("manual"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("marketing_prospect_status_idx").on(t.status),
  index("marketing_prospect_region_idx").on(t.region),
]);

// --- Error reports (user-reported issues, bucketed by centre) ---------------

export const ERROR_REPORT_STATUSES = ["new", "seen", "resolved"] as const;
export type ErrorReportStatus = (typeof ERROR_REPORT_STATUSES)[number];

/**
 * A captured application error a user chose to report (or one auto-logged).
 * Control-plane so the platform owner can triage across all centres. Holds who
 * hit it and where, so an issue can be reproduced and attributed to a centre.
 */
export const errorReport = sqliteTable("error_report", {
  id: id(),
  organisationId: text("organisation_id"),
  organisationSlug: text("organisation_slug"),
  userId: text("user_id"),
  userEmail: text("user_email"),
  path: text("path"),
  message: text("message").notNull(),
  digest: text("digest"),
  userAgent: text("user_agent"),
  status: text("status", { enum: ERROR_REPORT_STATUSES }).notNull().default("new"),
  createdAt: createdAt(),
}, (t) => [
  index("error_report_org_idx").on(t.organisationId),
  index("error_report_status_idx").on(t.status),
]);

export type Organisation = typeof organisation.$inferSelect;
export type NewOrganisation = typeof organisation.$inferInsert;
export type Membership = typeof membership.$inferSelect;
export type User = typeof user.$inferSelect;
export type Lead = typeof lead.$inferSelect;
export type MarketingProspect = typeof marketingProspect.$inferSelect;
export type NewMarketingProspect = typeof marketingProspect.$inferInsert;
export type PlatformPricing = typeof platformPricing.$inferSelect;
export type ErrorReport = typeof errorReport.$inferSelect;

// A tiny re-export so migrations pick up the raw-sql helper if needed.
export const _sql = sql;
