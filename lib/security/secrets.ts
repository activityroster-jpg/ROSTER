import { getEnv, type CloudflareEnv } from "@/lib/cf/bindings";

type SecretName = "BETTER_AUTH_SECRET" | "STRIPE_WEBHOOK_SECRET";

const DEV_FALLBACK = "dev-insecure-secret-change-me";

/**
 * Read a required secret. In production a missing secret is a hard failure —
 * never a silent fallback that would make sessions or signed cookies forgeable.
 * Outside production (local dev, tests, preview) a fixed dev value keeps flows
 * working and is logged once so nobody mistakes it for the real thing.
 */
export function requireSecret(name: SecretName, env: CloudflareEnv = getEnv()): string {
  const value = env[name];
  if (value && value.length >= 16) return value;
  if (env.APP_ENV === "production") {
    throw new Error(`${name} is not configured (or is too short). Set it with: wrangler secret put ${name}`);
  }
  if (!warned.has(name)) {
    warned.add(name);
    console.warn(`[secrets] ${name} not set — using the insecure dev fallback (APP_ENV=${env.APP_ENV ?? "unset"})`);
  }
  return DEV_FALLBACK;
}
const warned = new Set<string>();

/** The secret that signs Better Auth sessions and our "PIN verified" cookie. */
export const authSecret = (env?: CloudflareEnv) => requireSecret("BETTER_AUTH_SECRET", env);
