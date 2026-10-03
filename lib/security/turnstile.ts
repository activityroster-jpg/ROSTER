import { getEnv } from "@/lib/cf/bindings";

/**
 * Cloudflare Turnstile: a human check that is invisible for almost everyone
 * and only challenges suspicious traffic. The site key is public (it is in the
 * page); the secret lives in the Worker secret TURNSTILE_SECRET_KEY. When the
 * secret is not configured the check is skipped, so nothing breaks before set-up.
 */
export const TURNSTILE_SITE_KEY = "0x4AAAAAAFNAO-jitC2nA8t4";
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileEnabled(env = getEnv()): boolean {
  return Boolean(env.TURNSTILE_SECRET_KEY);
}

export type TurnstileResult = { ok: true; skipped: boolean } | { ok: false; reason: string };

export async function verifyTurnstile(token: string | null | undefined, ip: string | null, fetchImpl: typeof fetch = fetch, env = getEnv()): Promise<TurnstileResult> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, skipped: true };
  if (!token || token.length > 2048) return { ok: false, reason: "Please complete the security check and try again." };
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetchImpl(VERIFY_URL, { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; "error-codes"?: string[] };
    if (data.success) return { ok: true, skipped: false };
    const codes = data["error-codes"] ?? [];
    return { ok: false, reason: codes.includes("timeout-or-duplicate") ? "The security check expired. Please try again." : "The security check failed. Please try again." };
  } catch {
    // Cloudflare unreachable: do not lock real people out; the rate limiter still applies.
    return { ok: true, skipped: true };
  }
}
