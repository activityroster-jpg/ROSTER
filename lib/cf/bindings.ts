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
  BETTER_AUTH_URL?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  // Recurring price IDs for the single plan, one per billing interval.
  STRIPE_PRICE_MONTHLY?: string;
  STRIPE_PRICE_ANNUAL?: string;
  // Legacy names (kept as fallbacks for the monthly price).
  STRIPE_PRICE_ROSTERING?: string;
  STRIPE_PRICE_FULL?: string;
  // One-time price for the "done-for-you" setup & customisation service.
  STRIPE_PRICE_SETUP?: string;
  SENTRY_DSN?: string;
  RESEND_API_KEY?: string;
  // Shown in the legal footer of every email (optional — set for compliance).
  COMPANY_LEGAL_NAME?: string;
  COMPANY_ADDRESS?: string;
  SUPPORT_EMAIL?: string;
  // Comma-separated emails allowed into the platform-owner admin area (/admin).
  PLATFORM_ADMIN_EMAILS?: string;
  /** Free stock-photo API keys for self-hosted blog cover images. Either works;
   *  Pixabay keys are issued instantly, Pexels keys are sometimes paused. */
  PEXELS_API_KEY?: string;
  PIXABAY_API_KEY?: string;
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
