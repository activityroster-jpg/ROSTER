import { getCloudflareContext } from "@opennextjs/cloudflare";
import { d1Database, type Database } from "@/lib/db/client";
import { createRepositories, type Repositories } from "@/lib/db/repositories";

/**
 * The Cloudflare bindings + vars available to the Worker at runtime. Secrets are
 * injected by `wrangler secret put` and are only ever read on the server.
 */
export interface CloudflareEnv {
  DB: D1Database;
  DOCS: R2Bucket;
  TENANT_CACHE: KVNamespace;

  APP_APEX_DOMAIN: string;
  APP_ENV: string;

  // Secrets (server-only).
  BETTER_AUTH_SECRET?: string;
  /** Optional dedicated key for encrypting integration API tokens at rest (falls back to the auth secret). */
  TOKEN_ENCRYPTION_KEY?: string;
  BETTER_AUTH_URL?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  // Optional price-id overrides. When unset, prices are found on the Stripe
  // account by product name + interval (see lib/billing/prices).
  STRIPE_PRICE_SMALL_MONTHLY?: string;
  STRIPE_PRICE_SMALL_ANNUAL?: string;
  STRIPE_PRICE_STANDARD_MONTHLY?: string;
  STRIPE_PRICE_STANDARD_ANNUAL?: string;
  STRIPE_PRICE_SETUP?: string; // "Custom Package" one-off
  STRIPE_PRICE_ONSITE?: string; // "UK Onsite Daily Consultancy" one-off
  // Legacy names (still honoured as Standard monthly/annual fallbacks).
  STRIPE_PRICE_MONTHLY?: string;
  STRIPE_PRICE_ANNUAL?: string;
  STRIPE_PRICE_ROSTERING?: string;
  STRIPE_PRICE_FULL?: string;
  SENTRY_DSN?: string;
  RESEND_API_KEY?: string;
  /** Signing secret of the Resend webhook endpoint (whsec_…), for delivery/open/bounce events. */
  RESEND_WEBHOOK_SECRET?: string;
  /** Claude API key for the outreach agent's research and email writing (optional; templates only without it). */
  ANTHROPIC_API_KEY?: string;
  /** Shared secret an external scheduler sends to /api/outreach/tick so follow-ups go out on time. */
  OUTREACH_CRON_SECRET?: string;
  // Shown in the legal footer of every email (optional — set for compliance).
  COMPANY_LEGAL_NAME?: string;
  COMPANY_ADDRESS?: string;
  SUPPORT_EMAIL?: string;
  // Comma-separated emails allowed into the platform-owner admin area (/admin).
  PLATFORM_ADMIN_EMAILS?: string;
  // Universal / app links for the native apps (served at /.well-known/*). All optional.
  APPLE_TEAM_ID?: string;
  IOS_BUNDLE_ID?: string;
  ANDROID_PACKAGE?: string;
  /** Comma-separated SHA-256 signing-certificate fingerprints (AA:BB:…). */
  ANDROID_SHA256_FINGERPRINTS?: string;
  /** Free stock-photo API keys for self-hosted blog cover images. Either works;
   *  Pixabay keys are issued instantly, Pexels keys are sometimes paused. */
  PEXELS_API_KEY?: string;
  PIXABAY_API_KEY?: string;
  /** Firebase service-account JSON (whole file, as one secret) for push notifications via FCM. */
  FCM_SERVICE_ACCOUNT_JSON?: string;
}

export function getEnv(): CloudflareEnv {
  return getCloudflareContext().env as unknown as CloudflareEnv;
}

let cachedDb: Database | null = null;

/** The Drizzle client bound to this Worker's D1 database. */
export async function getDb(): Promise<Database> {
  if (cachedDb) return cachedDb;
  cachedDb = await d1Database(getEnv().DB);
  return cachedDb;
}

/** Repositories bound to this request's database. */
export async function getRepositories(): Promise<Repositories> {
  return createRepositories(await getDb());
}
