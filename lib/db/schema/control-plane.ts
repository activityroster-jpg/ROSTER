import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
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
}, (t) => [index("two_factor_user_idx").on(t.userId)]);

// --- Organisations (centres) & membership ---------------------------------

export const JURISDICTIONS = [
  "england",
  "wales",
  "scotland",
  "northern_ireland",
  "ireland",
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
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("organisation_slug_uq").on(t.slug),
  uniqueIndex("organisation_stripe_customer_uq").on(t.stripeCustomerId),
]);

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

export type Organisation = typeof organisation.$inferSelect;
export type NewOrganisation = typeof organisation.$inferInsert;
export type Membership = typeof membership.$inferSelect;
export type User = typeof user.$inferSelect;

// A tiny re-export so migrations pick up the raw-sql helper if needed.
export const _sql = sql;
