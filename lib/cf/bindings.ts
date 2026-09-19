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
  STRIPE_PRICE_ROSTERING?: string;
  STRIPE_PRICE_FULL?: string;
  SENTRY_DSN?: string;
  RESEND_API_KEY?: string;
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
