/**
 * 4-digit login PIN — a lightweight second factor for centre admins and the
 * platform owner. The PIN is stored only as a PBKDF2 hash; online guessing is
 * throttled by a lockout (see the control-plane counters). "Verified for this
 * session" is proved by a signed cookie bound to the Better Auth session id, so
 * a new login (new session id) always requires the PIN again.
 *
 * All crypto uses Web Crypto (available in Workers and Node ≥ 20).
 */

export const PIN_COOKIE = "ar_pin";
// The "PIN verified" cookie is an idle timeout: it lives 30 minutes and is slid
// forward on each app request (see middleware), so 30 minutes of inactivity
// re-prompts for the PIN.
export const PIN_IDLE_MAX_AGE_S = 30 * 60;
export const PIN_MAX_FAILS = 5;
export const PIN_LOCK_MS = 15 * 60 * 1000; // 15 minutes
export const PIN_ITERATIONS = 100_000;
export const PIN_REGEX = /^\d{4}$/;

const enc = new TextEncoder();

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function pbkdf2(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" }, key, 256);
  return b64(new Uint8Array(bits));
}

/** Hash a PIN as `pbkdf2$<iters>$<saltB64>$<hashB64>`. */
export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(pin, salt, PIN_ITERATIONS);
  return `pbkdf2$${PIN_ITERATIONS}$${b64(salt)}$${hash}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const hash = await pbkdf2(pin, unb64(parts[2]!), iterations);
  return timingSafeEqual(hash, parts[3]!);
}

// --- Signed "PIN verified this session" cookie ----------------------------

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return b64(new Uint8Array(sig));
}

export function pinCookieValue(secret: string, sessionId: string): Promise<string> {
  return hmac(secret, `pin:${sessionId}`);
}

export async function verifyPinCookie(secret: string, sessionId: string, value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const expected = await hmac(secret, `pin:${sessionId}`);
  return timingSafeEqual(expected, value);
}
