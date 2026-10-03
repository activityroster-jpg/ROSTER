import { getEnv } from "@/lib/cf/bindings";

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/**
 * Shared secret for machine callers (the hourly outreach tick, the nightly
 * backup report). Sent as the x-cron-secret header (x-outreach-secret is the
 * older name and still accepted). Constant-time compare; no secret → refuse.
 */
export function checkCronSecret(req: Request): boolean {
  const secret = getEnv().OUTREACH_CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("x-cron-secret") ?? req.headers.get("x-outreach-secret") ?? new URL(req.url).searchParams.get("secret") ?? "";
  return same(given, secret);
}
