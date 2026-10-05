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

export const TWO_FACTOR_METHODS = ["app", "email"] as const;
export type TwoFactorMethod = (typeof TWO_FACTOR_METHODS)[number];

export const user = sqliteTable("user", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  emailVerified: boolCol("email_verified").default(false),
  image: text("image"),
  // A secondary email an admin sets for account recovery (separate from the
  // sign-in email). Never used as a login identity.
  recoveryEmail: text("recovery_email"),
  // Mobile-app sign-up collects a phone number (copied onto the instructor record on join).
  phone: text("phone"),
  // twoFactor plugin
  twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }),
  // Which second step the person chose: authenticator app or emailed code.
  // Null = not chosen yet (treated as "app" for accounts enrolled before the
  // choice existed).
  twoFactorMethod: text("two_factor_method", { enum: TWO_FACTOR_METHODS }),
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
  /** Company code instructors type into the app to join this centre (e.g. "7KD4PX"). */
  joinCode: text("join_code"),
  // When the free trial ends. Null = created_at + the platform trial length;
  // the Dev Center can extend it. After it: read-only, then locked (lib/billing/trial).
  trialEndsAt: integer("trial_ends_at", { mode: "timestamp_ms" }),
  /** Which version of the Terms + DPA the centre accepted at signup, and when (compliance spec: terms acceptance). */
  termsVersion: text("terms_version"),
  termsAcceptedAt: integer("terms_accepted_at", { mode: "timestamp_ms" }),
  /** When Stripe first reported a failed payment; cleared when paid. Drives the grace period → read-only rule. */
  pastDueSince: integer("past_due_since", { mode: "timestamp_ms" }),
  // --- Leaving (P0-A "90-day export, deletion, written confirmation") ---------
  /** When `status` last changed. A suspended or cancelled centre keeps its export for 90 days from here. */
  statusChangedAt: integer("status_changed_at", { mode: "timestamp_ms" }),
  /** The 14-days-to-go reminder was emailed to the centre's admins. */
  leavingReminderSentAt: integer("leaving_reminder_sent_at", { mode: "timestamp_ms" }),
  /** Conor was told the 90 days are up and the centre can be erased (erasure itself is a human click). */
  leavingDueNotifiedAt: integer("leaving_due_notified_at", { mode: "timestamp_ms" }),
  /** The trial-end survey invitation was emailed to the centre's admins (lib/services/trial-survey). */
  trialSurveySentAt: integer("trial_survey_sent_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("organisation_slug_uq").on(t.slug),
  uniqueIndex("organisation_join_code_uq").on(t.joinCode),
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
  // Fair use on unlimited plans (decided 5 Oct): the figure the Terms quote,
  // the headcount that flags a centre in the Dev Center, and the most
  // invitation emails one centre sends in a day (the rest go the next day).
  fairUsePeople: integer("fair_use_people").notNull().default(500),
  fairUseAlertAt: integer("fair_use_alert_at").notNull().default(300),
  inviteDailyCap: integer("invite_daily_cap").notNull().default(200),
  updatedAt: updatedAt(),
});

/**
 * owner       the superadmin: set the centre up and pays; everything. One per centre.
 * admin       an office admin; what they can reach is the `features` list the owner sets (lib/auth/rbac).
 * instructor  the instructor app (senior instructors and volunteers included).
 * parent      read-only view of their under-18 child's roster and the parental permission answer.
 * senior_instructor / welfare_officer: legacy, migrated to instructor in 0059; never granted now.
 */
export const MEMBERSHIP_ROLES = ["owner", "admin", "instructor", "parent", "senior_instructor", "welfare_officer"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

// invited = admin invited, not yet accepted · requested = joined via the app's
// company code without a matching instructor record, awaiting admin approval.
export const MEMBERSHIP_STATUSES = ["active", "invited", "requested", "suspended"] as const;
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
  /** Office admins only: JSON array of OFFICE_FEATURES the owner ticked. Empty = can open the office and nothing else. */
  features: text("features").notNull().default("[]"),
  /** When the latest invitation email went out (null for people who joined another way). */
  inviteSentAt: integer("invite_sent_at", { mode: "timestamp_ms" }),
  /** Set when the centre's daily invite cap held this invitation back; the hourly tick sends it the next day. */
  inviteQueuedAt: integer("invite_queued_at", { mode: "timestamp_ms" }),
  /** When the one reminder went out (a day after the invite, if they hadn't signed in). Cleared by a re-send. */
  inviteRemindedAt: integer("invite_reminded_at", { mode: "timestamp_ms" }),
  /** Who sent the invitation, by name, for the reminder email. */
  invitedByName: text("invited_by_name"),
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

/**
 * Durable fixed-window rate-limit counters (audit C7, Part E decision 10).
 * One row per limit key; D1 serialises writes, so the increment-and-read is
 * atomic where the old KV read-then-write was not. Holds keys such as
 * "auth:signin:email:<address>" and a count, never tenant data.
 */
export const rateLimitBucket = sqliteTable("rate_limit_bucket", {
  key: text("key").primaryKey(),
  window: integer("window").notNull(),
  count: integer("count").notNull().default(0),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
}, (t) => [index("rate_limit_bucket_expires_idx").on(t.expiresAt)]);

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
export const LAWFUL_BASES = ["legitimate_interests", "consent", "existing_customer"] as const;
export type LawfulBasis = (typeof LAWFUL_BASES)[number];

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
  /** Why we may contact them (UK GDPR / PECR): legitimate interests for a business, consent otherwise. */
  lawfulBasis: text("lawful_basis", { enum: LAWFUL_BASES }).notNull().default("legitimate_interests"),
  basisNote: text("basis_note"),
  /** Sole traders and partnerships count as individuals under PECR: no marketing email without consent. */
  soleTrader: boolCol("sole_trader").default(false),
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

// --- Finance (platform owner's own books) -----------------------------------

export const FINANCE_CURRENCIES = ["GBP", "EUR"] as const;
export type FinanceCurrency = (typeof FINANCE_CURRENCIES)[number];
export const FINANCE_SOURCES = ["manual", "stripe"] as const;

/**
 * One line in the owner's transaction log: an expense typed in by hand, or
 * revenue / a processing fee picked up automatically from Stripe. Amounts are
 * minor units (pence / cents), positive for money in on revenue categories and
 * money out on cost categories; a negative amount is a refund or credit.
 */
export const financeTransaction = sqliteTable("finance_transaction", {
  id: id(),
  date: text("date").notNull(), // YYYY-MM-DD
  category: text("category").notNull(), // key from lib/finance/categories
  description: text("description").notNull(),
  counterparty: text("counterparty"), // supplier or customer
  amountMinor: integer("amount_minor").notNull(),
  vatMinor: integer("vat_minor"),
  currency: text("currency", { enum: FINANCE_CURRENCIES }).notNull().default("GBP"),
  source: text("source", { enum: FINANCE_SOURCES }).notNull().default("manual"),
  /** Stripe invoice / charge id so webhooks and backfills never double-count. */
  externalId: text("external_id"),
  receiptRef: text("receipt_ref"), // invoice number, link or file name
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("finance_tx_date_idx").on(t.date),
  index("finance_tx_category_idx").on(t.category),
  uniqueIndex("finance_tx_external_uq").on(t.externalId),
]);
export type FinanceTransaction = typeof financeTransaction.$inferSelect;
export type NewFinanceTransaction = typeof financeTransaction.$inferInsert;

/** Singleton: how the books are presented. */
export const financeSettings = sqliteTable("finance_settings", {
  id: text("id").primaryKey().default("default"),
  /** Month the financial year starts, 1–12 (1 = January, 4 = April…). */
  fyStartMonth: integer("fy_start_month").notNull().default(1),
  reportingCurrency: text("reporting_currency", { enum: FINANCE_CURRENCIES }).notNull().default("GBP"),
  /** 1 EUR = this many GBP, used to report EUR lines in GBP (and the inverse). */
  eurToGbp: real("eur_to_gbp").notNull().default(0.86),
  /** Bank balance at the start of the records, minor units in the reporting currency. */
  openingCashMinor: integer("opening_cash_minor").notNull().default(0),
  openingCashDate: text("opening_cash_date"),
  updatedAt: updatedAt(),
});
export type FinanceSettings = typeof financeSettings.$inferSelect;

// --- Outreach agent (platform owner's own prospecting) ----------------------

export const OUTREACH_CAMPAIGN_STATUSES = ["draft", "running", "paused", "finished"] as const;
export type OutreachCampaignStatus = (typeof OUTREACH_CAMPAIGN_STATUSES)[number];
export const OUTREACH_LEAD_STATUSES = [
  "new", "no_email", "queued", "sending", "in_sequence", "completed", "replied", "booked", "bounced", "opted_out", "skipped", "failed",
] as const;
export type OutreachLeadStatus = (typeof OUTREACH_LEAD_STATUSES)[number];
export const OUTREACH_MESSAGE_STATUSES = ["sent", "delivered", "opened", "clicked", "bounced", "complained", "failed"] as const;
export type OutreachMessageStatus = (typeof OUTREACH_MESSAGE_STATUSES)[number];
export const SUPPRESSION_REASONS = ["unsubscribe", "bounce", "complaint", "replied", "manual"] as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

/** A campaign: who to contact, what to say, how fast. Steps are a JSON array (see lib/outreach/types). */
export const outreachCampaign = sqliteTable("outreach_campaign", {
  id: id(),
  name: text("name").notNull(),
  status: text("status", { enum: OUTREACH_CAMPAIGN_STATUSES }).notNull().default("draft"),
  audience: text("audience").notNull(), // JSON AudienceFilter
  pitch: text("pitch").notNull(),
  targetRoles: text("target_roles").notNull(), // comma-separated
  tone: text("tone"),
  steps: text("steps").notNull(), // JSON SequenceStep[]
  fromName: text("from_name").notNull(),
  fromEmail: text("from_email").notNull(),
  replyTo: text("reply_to"),
  dailyCap: integer("daily_cap").notNull().default(40),
  sendWindowStart: integer("send_window_start").notNull().default(8),
  sendWindowEnd: integer("send_window_end").notNull().default(18),
  weekdaysOnly: boolCol("weekdays_only").default(true),
  aiPersonalise: boolCol("ai_personalise").default(true),
  launchedAt: integer("launched_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export type OutreachCampaign = typeof outreachCampaign.$inferSelect;
export type NewOutreachCampaign = typeof outreachCampaign.$inferInsert;

/** One prospect inside a campaign, with what we found out about them and where they are in the sequence. */
export const outreachLead = sqliteTable("outreach_lead", {
  id: id(),
  campaignId: text("campaign_id").notNull().references(() => outreachCampaign.id, { onDelete: "cascade" }),
  prospectId: text("prospect_id"),
  centreName: text("centre_name").notNull(),
  website: text("website"),
  region: text("region"),
  email: text("email"),
  emailVerified: boolCol("email_verified").default(false),
  contactName: text("contact_name"),
  contactRole: text("contact_role"),
  research: text("research"), // JSON ResearchResult
  status: text("status", { enum: OUTREACH_LEAD_STATUSES }).notNull().default("new"),
  stepIndex: integer("step_index").notNull().default(0),
  nextSendAt: integer("next_send_at", { mode: "timestamp_ms" }),
  lastEventAt: integer("last_event_at", { mode: "timestamp_ms" }),
  unsubscribeToken: text("unsubscribe_token").notNull(),
  error: text("error"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("outreach_lead_campaign_idx").on(t.campaignId),
  index("outreach_lead_status_idx").on(t.status),
  index("outreach_lead_next_idx").on(t.nextSendAt),
  uniqueIndex("outreach_lead_token_uq").on(t.unsubscribeToken),
]);
export type OutreachLead = typeof outreachLead.$inferSelect;
export type NewOutreachLead = typeof outreachLead.$inferInsert;

/** Every email actually sent, with what Resend told us about it afterwards. */
export const outreachMessage = sqliteTable("outreach_message", {
  id: id(),
  leadId: text("lead_id").notNull().references(() => outreachLead.id, { onDelete: "cascade" }),
  campaignId: text("campaign_id").notNull(),
  step: integer("step").notNull(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  bodyText: text("body_text").notNull(),
  resendId: text("resend_id"),
  status: text("status", { enum: OUTREACH_MESSAGE_STATUSES }).notNull().default("sent"),
  sentAt: integer("sent_at", { mode: "timestamp_ms" }).notNull(),
  openedAt: integer("opened_at", { mode: "timestamp_ms" }),
  clickedAt: integer("clicked_at", { mode: "timestamp_ms" }),
  error: text("error"),
  createdAt: createdAt(),
}, (t) => [
  index("outreach_message_lead_idx").on(t.leadId),
  index("outreach_message_campaign_idx").on(t.campaignId),
  uniqueIndex("outreach_message_resend_uq").on(t.resendId),
]);
export type OutreachMessage = typeof outreachMessage.$inferSelect;

/** Addresses we must never email again, whatever campaign. */
export const outreachSuppression = sqliteTable("outreach_suppression", {
  id: id(),
  email: text("email").notNull(),
  reason: text("reason", { enum: SUPPRESSION_REASONS }).notNull(),
  note: text("note"),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("outreach_suppression_email_uq").on(t.email)]);
export type OutreachSuppression = typeof outreachSuppression.$inferSelect;

export const AI_USAGE_KINDS = ["research", "draft"] as const;
export type AiUsageKind = (typeof AI_USAGE_KINDS)[number];

/** One row per Claude API call made by the outreach agent, so spend can be tracked by day / week / month. */
export const aiUsage = sqliteTable("ai_usage", {
  id: id(),
  kind: text("kind", { enum: AI_USAGE_KINDS }).notNull(),
  model: text("model").notNull(),
  campaignId: text("campaign_id"),
  leadId: text("lead_id"),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
  cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
  /** Estimated cost in millionths of a US dollar (list price at the time of the call). */
  costMicros: integer("cost_micros").notNull().default(0),
  createdAt: createdAt(),
}, (t) => [index("ai_usage_created_idx").on(t.createdAt), index("ai_usage_campaign_idx").on(t.campaignId)]);
export type AiUsage = typeof aiUsage.$inferSelect;
export type NewAiUsage = typeof aiUsage.$inferInsert;

export const PRIVACY_REQUEST_KINDS = ["access", "correction", "erasure", "restriction", "portability", "objection", "complaint", "other"] as const;
export type PrivacyRequestKind = (typeof PRIVACY_REQUEST_KINDS)[number];
export const PRIVACY_REQUEST_STATUSES = ["new", "acknowledged", "in_progress", "closed"] as const;
export type PrivacyRequestStatus = (typeof PRIVACY_REQUEST_STATUSES)[number];

/** Data-protection requests and complaints from the public form; acknowledged within 30 days (UK DUAA duty). */
export const privacyRequest = sqliteTable("privacy_request", {
  id: id(),
  kind: text("kind", { enum: PRIVACY_REQUEST_KINDS }).notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  centre: text("centre"),
  message: text("message").notNull(),
  status: text("status", { enum: PRIVACY_REQUEST_STATUSES }).notNull().default("new"),
  dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(),
  acknowledgedAt: integer("acknowledged_at", { mode: "timestamp_ms" }),
  closedAt: integer("closed_at", { mode: "timestamp_ms" }),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("privacy_request_status_idx").on(t.status), index("privacy_request_due_idx").on(t.dueAt)]);
export type PrivacyRequest = typeof privacyRequest.$inferSelect;
export type NewPrivacyRequest = typeof privacyRequest.$inferInsert;

// --- Security events --------------------------------------------------------

export const SECURITY_EVENT_KINDS = [
  "pin_set", "pin_reset", "pin_reset_failed", "pin_failed", "pin_locked", "pin_reset_code_sent",
  "recovery_email_set", "password_changed", "new_device", "reauth_passed", "reauth_failed", "invite_accepted",
  "ghost_start", "ghost_end", "join_requested", "join_code_failed",
  "two_factor_enabled", "two_factor_disabled", "sessions_revoked",
  "subprocessor_notice", "owner_transferred", "office_access_changed",
  "step_up", "calendar_feed_reset",
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
  /** Cloudflare's city for the request; office users are challenged again from a new city (instructors only from a new country). */
  city: text("city"),
  userAgent: text("user_agent"),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("trusted_device_uq").on(t.userId, t.deviceId, t.ip),
  index("trusted_device_user_idx").on(t.userId),
]);
export type TrustedDevice = typeof trustedDevice.$inferSelect;

export const PUSH_PLATFORMS = ["ios", "android", "web"] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

/** Device push tokens (FCM) registered by the mobile app, per user × device. */
export const pushToken = sqliteTable("push_token", {
  id: id(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  platform: text("platform", { enum: PUSH_PLATFORMS }).notNull(),
  deviceId: text("device_id"),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("push_token_token_uq").on(t.token), index("push_token_user_idx").on(t.userId)]);
export type PushToken = typeof pushToken.$inferSelect;

// A tiny re-export so migrations pick up the raw-sql helper if needed.
// --- Rule packs (working-time law as data) -----------------------------------
// One row per pack key ("gb", "ni", "ie") when Conor has edited the built-in
// figures in the Dev Center. No row = the built-in pack in
// lib/rules/working-time/packs.ts applies. Legal figures are never hard-coded
// in the checks themselves; they are read from the pack at run time.
export const rulePack = sqliteTable("rule_pack", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  verified: boolCol("verified").default(false),
  /** The full WorkingTimePack as JSON (validated with workingTimePackSchema before it is stored). */
  json: text("json").notNull(),
  updatedBy: text("updated_by"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export type RulePack = typeof rulePack.$inferSelect;

// --- Email outbox (queue with retries; compliance P1-C) ----------------------
export const EMAIL_OUTBOX_STATUSES = ["queued", "sent", "failed"] as const;
export type EmailOutboxStatus = (typeof EMAIL_OUTBOX_STATUSES)[number];
/**
 * Every email the platform sends passes through here: an immediate attempt,
 * then retries from the hourly tick with backoff, then a failed-send list in
 * the Dev Center. Bodies are cleared once sent or finally failed, so a
 * sign-in code never sits in the database longer than its retries.
 */
export const emailOutbox = sqliteTable("email_outbox", {
  id: id(),
  stream: text("stream").notNull().default("system"),
  toEmail: text("to_email").notNull(),
  fromAddr: text("from_addr").notNull(),
  subject: text("subject").notNull(),
  html: text("html"),
  text: text("text"),
  replyTo: text("reply_to"),
  headers: text("headers"), // JSON
  tags: text("tags"), // JSON
  status: text("status", { enum: EMAIL_OUTBOX_STATUSES }).notNull().default("queued"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  nextAttemptAt: integer("next_attempt_at", { mode: "timestamp_ms" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  provider: text("provider"),
  providerId: text("provider_id"),
  sentAt: integer("sent_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("email_outbox_status_idx").on(t.status, t.nextAttemptAt),
  index("email_outbox_provider_idx").on(t.providerId),
]);
export type EmailOutbox = typeof emailOutbox.$inferSelect;
export type NewEmailOutbox = typeof emailOutbox.$inferInsert;

// --- Trial-end survey ----------------------------------------------------------

/**
 * A centre's answers to the trial-end survey (lib/services/trial-survey): eight
 * questions about the platform, one set per centre, rewarded with another free
 * month. Feedback to ActivityRoster rather than centre data, so it is read in
 * the Dev Center across centres; it goes when the centre is erased (cascade).
 * The contact email is kept only when the person said yes to being contacted.
 */
export const trialFeedback = sqliteTable("trial_feedback", {
  id: id(),
  organisationId: text("organisation_id").notNull().references(() => organisation.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  mostUseful: text("most_useful").notNull(),
  leastUseful: text("least_useful").notNull(),
  wouldChange: text("would_change").notNull(),
  missing: text("missing").notNull(),
  featureRequest: text("feature_request").notNull(),
  userCount: integer("user_count").notNull(),
  otherFeedback: text("other_feedback").notNull(),
  contactOk: boolCol("contact_ok"),
  contactEmail: text("contact_email"),
  contactAnsweredAt: integer("contact_answered_at", { mode: "timestamp_ms" }).notNull(),
  rewardDays: integer("reward_days").notNull(),
  /** The extra month answering the survey activated: when, by which user, and when it expires. */
  extraTrialGrantedAt: integer("extra_trial_granted_at", { mode: "timestamp_ms" }),
  extraTrialGrantedBy: text("extra_trial_granted_by"),
  extraTrialEndsAt: integer("extra_trial_ends_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("trial_feedback_org_uq").on(t.organisationId),
  index("trial_feedback_contact_idx").on(t.contactOk),
]);
export type TrialFeedback = typeof trialFeedback.$inferSelect;
export type NewTrialFeedback = typeof trialFeedback.$inferInsert;

export const _sql = sql;
