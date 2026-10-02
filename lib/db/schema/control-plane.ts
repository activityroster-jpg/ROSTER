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
  // A secondary email an admin sets for account recovery (separate from the
  // sign-in email). Never used as a login identity.
  recoveryEmail: text("recovery_email"),
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
 * Pricing tier. `small_club` is a lower flat price capped at a small team
 * (enforced as a hard limit on instructor headcount — see lib/tiers.ts);
 * `standard` is the unlimited-team flat price. Existing centres default to
 * `standard` so the cap never retroactively bites anyone — a centre is only
 * capped once it is explicitly placed on `small_club`.
 */
export const ORG_TIERS = ["small_club", "standard"] as const;
export type OrgTier = (typeof ORG_TIERS)[number];

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
  // Pricing tier. Defaults to `standard` (unlimited) so no existing centre is
  // ever retroactively capped; a centre is only limited once put on `small_club`.
  tier: text("tier", { enum: ORG_TIERS }).notNull().default("standard"),
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
  // Set when a centre buys the one-off "done-for-you" setup & customisation
  // service, so the platform owner can see who has paid for concierge setup.
  setupPurchasedAt: integer("setup_purchased_at", { mode: "timestamp_ms" }),
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
  // One-off "done-for-you" setup & customisation service: we configure the
  // platform, import their data and add the features they want for a single fee,
  // after which they continue on the normal plan. Editable in platform admin;
  // `setupEnabled` toggles the offer without deleting the price.
  setupPrice: real("setup_price").notNull().default(850),
  setupEnabled: boolCol("setup_enabled").default(true),
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
  // Primary/most-advanced stage (kept for the index + summary counts).
  status: text("status", { enum: PROSPECT_STATUSES }).notNull().default("new"),
  // Multi-select outreach touchpoints as a JSON array of ProspectStatus. A single
  // prospect can be e.g. letter_sent AND emailed AND called. Null => derive [status].
  statuses: text("statuses"),
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

// --- Blog / CMS (platform-owned marketing content, for SEO) -----------------

export const BLOG_STATUSES = ["draft", "published"] as const;
export type BlogStatus = (typeof BLOG_STATUSES)[number];

/**
 * A blog article. Control-plane (global marketing content, not tenant-owned),
 * managed from the platform admin CMS and served on the public /blog.
 *
 * Publishing is time-based: a post is publicly visible when status = "published"
 * AND publishAt <= now. Scheduling future posts (e.g. two per day) is therefore
 * just a matter of setting publishAt — no cron job required; the public queries
 * filter on the clock at read time.
 */
export const blogPost = sqliteTable("blog_post", {
  id: id(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull().default(""),
  body: text("body").notNull().default(""),
  category: text("category").notNull().default("Guides"),
  tags: text("tags").notNull().default(""),
  author: text("author").notNull().default("The ActivityRoster Team"),
  coverEmoji: text("cover_emoji").notNull().default("⛵"),
  // Self-hosted cover image sourced via the Pexels API and stored in R2 under
  // blog/<slug>.jpg (served from our own domain for SEO). Credit fields satisfy
  // the Pexels attribution guideline.
  coverImageKey: text("cover_image_key"),
  coverImageCredit: text("cover_image_credit"),
  coverImageCreditUrl: text("cover_image_credit_url"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  status: text("status", { enum: BLOG_STATUSES }).notNull().default("draft"),
  publishAt: integer("publish_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("blog_post_slug_uq").on(t.slug),
  index("blog_post_publish_idx").on(t.publishAt),
  index("blog_post_status_idx").on(t.status),
]);

// --- Platform owner's task planner (control-plane, admin-only) --------------

export const TASK_STATUSES = ["upcoming", "working", "complete"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** The platform owner's personal task board (not tenant data). */
export const platformTask = sqliteTable("platform_task", {
  id: id(),
  title: text("title").notNull(),
  category: text("category"),
  priority: text("priority", { enum: TASK_PRIORITIES }).notNull().default("medium"),
  dueDate: text("due_date"), // "YYYY-MM-DD"
  status: text("status", { enum: TASK_STATUSES }).notNull().default("upcoming"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("platform_task_status_idx").on(t.status)]);

// --- Discovery-call scheduling (control-plane, admin-only) ------------------

/**
 * A recurring weekly availability window for discovery calls, in UTC/GMT.
 * The admin sets these; the public booking page turns them into 30-minute slots
 * and removes any that are already booked or in the past.
 */
export const callAvailability = sqliteTable("call_availability", {
  id: id(),
  dayOfWeek: integer("day_of_week").notNull(), // 0 = Sunday … 6 = Saturday (UTC)
  startMinute: integer("start_minute").notNull(), // minutes from 00:00 UTC
  endMinute: integer("end_minute").notNull(),
  active: boolCol("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("call_availability_day_idx").on(t.dayOfWeek)]);

export const CALL_BOOKING_STATUSES = ["booked", "cancelled", "completed"] as const;
export type CallBookingStatus = (typeof CALL_BOOKING_STATUSES)[number];

/** A booked 30-minute discovery call. `startAt` is the slot start in UTC. */
export const callBooking = sqliteTable("call_booking", {
  id: id(),
  startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
  durationMin: integer("duration_min").notNull().default(30),
  name: text("name").notNull(),
  email: text("email").notNull(),
  centre: text("centre"),
  notes: text("notes"),
  status: text("status", { enum: CALL_BOOKING_STATUSES }).notNull().default("booked"),
  createdAt: createdAt(),
}, (t) => [index("call_booking_start_idx").on(t.startAt)]);

export type CallAvailability = typeof callAvailability.$inferSelect;
export type NewCallAvailability = typeof callAvailability.$inferInsert;
export type CallBooking = typeof callBooking.$inferSelect;
export type NewCallBooking = typeof callBooking.$inferInsert;

export type Organisation = typeof organisation.$inferSelect;
export type NewOrganisation = typeof organisation.$inferInsert;
export type Membership = typeof membership.$inferSelect;
export type User = typeof user.$inferSelect;
export type Lead = typeof lead.$inferSelect;
export type MarketingProspect = typeof marketingProspect.$inferSelect;
export type NewMarketingProspect = typeof marketingProspect.$inferInsert;
export type PlatformPricing = typeof platformPricing.$inferSelect;
export type ErrorReport = typeof errorReport.$inferSelect;
export type BlogPost = typeof blogPost.$inferSelect;
export type NewBlogPost = typeof blogPost.$inferInsert;
export type PlatformTask = typeof platformTask.$inferSelect;
export type NewPlatformTask = typeof platformTask.$inferInsert;

// --- Security events --------------------------------------------------------

export const SECURITY_EVENT_KINDS = [
  "pin_set", "pin_reset", "pin_reset_failed", "pin_failed", "pin_locked", "pin_reset_code_sent",
  "recovery_email_set", "password_changed", "new_device", "reauth_passed", "reauth_failed", "invite_accepted",
] as const;
export type SecurityEventKind = (typeof SECURITY_EVENT_KINDS)[number];

/**
 * Account-security audit trail (control plane, per user): PIN set/reset/failures,
 * recovery-email changes, password changes, new-device sign-ins. Written by
 * lib/security/events; shown to the user on /security and to platform admins.
 */
export const securityEvent = sqliteTable("security_event", {
  id: id(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  organisationId: text("organisation_id"),
  kind: text("kind", { enum: SECURITY_EVENT_KINDS }).notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  country: text("country"),
  meta: text("meta"), // JSON
  createdAt: createdAt(),
}, (t) => [index("security_event_user_idx").on(t.userId), index("security_event_created_idx").on(t.createdAt)]);
export type SecurityEvent = typeof securityEvent.$inferSelect;

/**
 * Devices (browser cookie id) + network (IP, country) a user has confirmed
 * with their password. A sign-in from a combination not in this table must
 * re-enter the password before the PIN. One row per user × device × IP.
 */
export const trustedDevice = sqliteTable("trusted_device", {
  id: id(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  deviceId: text("device_id").notNull(),
  ip: text("ip").notNull(),
  country: text("country"),
  userAgent: text("user_agent"),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("trusted_device_uq").on(t.userId, t.deviceId, t.ip),
  index("trusted_device_user_idx").on(t.userId),
]);
export type TrustedDevice = typeof trustedDevice.$inferSelect;

// A tiny re-export so migrations pick up the raw-sql helper if needed.
export const _sql = sql;
