/**
 * One-time codes for sensitive self-service actions (e.g. resetting a login
 * PIN without a password). The code is 6 digits, lives in KV for a short TTL
 * as a SHA-256 hash, allows a handful of attempts, and is single use. The store
 * is injected so the logic is testable without Workers KV.
 */

export interface CodeStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts: { expirationTtl: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export const CODE_TTL_S = 10 * 60;
export const CODE_MAX_ATTEMPTS = 5;
export const CODE_SENDS_PER_HOUR = 3;

const enc = new TextEncoder();

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** A random 6-digit code (leading zeros allowed). */
export function generateCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000;
  return String(n).padStart(6, "0");
}

interface Stored { hash: string; attempts: number }

/**
 * Issue a code for `scope` (e.g. "pin-reset:<userId>"). Returns the plain code
 * to email, or null when the per-hour send limit is hit.
 */
export async function issueCode(store: CodeStore, scope: string): Promise<string | null> {
  const sendsKey = `code-sends:${scope}`;
  const sends = Number((await store.get(sendsKey)) ?? "0");
  if (sends >= CODE_SENDS_PER_HOUR) return null;
  await store.put(sendsKey, String(sends + 1), { expirationTtl: 60 * 60 });

  const code = generateCode();
  const stored: Stored = { hash: await sha256(`${scope}:${code}`), attempts: 0 };
  await store.put(`code:${scope}`, JSON.stringify(stored), { expirationTtl: CODE_TTL_S });
  return code;
}

export type CodeCheck = "ok" | "wrong" | "expired" | "locked";

/** Check a submitted code. Consumes it on success or after too many attempts. */
export async function checkCode(store: CodeStore, scope: string, submitted: string): Promise<CodeCheck> {
  const key = `code:${scope}`;
  const raw = await store.get(key);
  if (!raw) return "expired";
  let stored: Stored;
  try { stored = JSON.parse(raw) as Stored; } catch { await store.delete(key); return "expired"; }

  if (stored.attempts >= CODE_MAX_ATTEMPTS) { await store.delete(key); return "locked"; }

  const ok = /^\d{6}$/.test(submitted) && timingSafeEqual(stored.hash, await sha256(`${scope}:${submitted}`));
  if (ok) { await store.delete(key); return "ok"; }

  stored.attempts += 1;
  if (stored.attempts >= CODE_MAX_ATTEMPTS) { await store.delete(key); return "locked"; }
  await store.put(key, JSON.stringify(stored), { expirationTtl: CODE_TTL_S });
  return "wrong";
}
