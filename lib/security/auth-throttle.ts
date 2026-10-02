/**
 * Brute-force limits for the Better Auth endpoints (/api/auth/*). Better Auth's
 * own limiter is in-memory, which on Cloudflare Workers is per-isolate and
 * short-lived — so these are enforced with the KV limiter in the route handler.
 * Pure rule table so it's unit-testable.
 */

export interface ThrottleRule {
  /** Limit per client IP within the window. */
  perIp: number;
  /** Limit per target email (when the body carries one) within the window. */
  perEmail?: number;
  windowSeconds: number;
  /** Short label used in the KV key. */
  key: string;
}

const FIFTEEN_MIN = 15 * 60;
const HOUR = 60 * 60;

/** Path (relative to /api/auth, no query) → rule. Only POSTs are throttled. */
const RULES: { test: RegExp; rule: ThrottleRule }[] = [
  { test: /^\/sign-in\/email$/, rule: { key: "signin", perIp: 20, perEmail: 10, windowSeconds: FIFTEEN_MIN } },
  { test: /^\/sign-in\/magic-link$/, rule: { key: "magic", perIp: 10, perEmail: 5, windowSeconds: FIFTEEN_MIN } },
  { test: /^\/sign-up\/email$/, rule: { key: "signup", perIp: 10, perEmail: 5, windowSeconds: HOUR } },
  { test: /^\/(forget-password|request-password-reset)$/, rule: { key: "forgot", perIp: 10, perEmail: 5, windowSeconds: HOUR } },
  { test: /^\/reset-password$/, rule: { key: "reset", perIp: 10, windowSeconds: FIFTEEN_MIN } },
  { test: /^\/verify-password$/, rule: { key: "verifypw", perIp: 15, windowSeconds: FIFTEEN_MIN } },
  { test: /^\/two-factor\/(verify-totp|verify-otp|verify-backup-code)$/, rule: { key: "2fa", perIp: 10, windowSeconds: FIFTEEN_MIN } },
  { test: /^\/two-factor\/send-otp$/, rule: { key: "2fa-send", perIp: 5, windowSeconds: FIFTEEN_MIN } },
  { test: /^\/send-verification-email$/, rule: { key: "verify-send", perIp: 5, perEmail: 3, windowSeconds: HOUR } },
];

/** The rule for a request, or null if the path isn't sensitive. */
export function authThrottleRule(method: string, pathname: string, basePath = "/api/auth"): ThrottleRule | null {
  if (method.toUpperCase() !== "POST") return null;
  const rel = pathname.startsWith(basePath) ? pathname.slice(basePath.length) || "/" : pathname;
  const clean = rel.replace(/\/+$/, "") || "/";
  return RULES.find((r) => r.test.test(clean))?.rule ?? null;
}

/** Pull a normalised email out of a JSON body, if present and plausible. */
export function emailFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const e = (body as { email?: unknown }).email;
  if (typeof e !== "string") return null;
  const v = e.trim().toLowerCase();
  return v.length >= 3 && v.length <= 254 && v.includes("@") ? v : null;
}
