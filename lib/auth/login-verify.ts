/**
 * "Login verified" for centre admins (the office). After email + password,
 * every office sign-in confirms a code sent by email (or the person's 2FA
 * step, when they have one on), then chooses whether to stay signed in.
 *
 * The proof is a signed cookie bound to the Better Auth session id:
 *   ar_lv  = "p:<hmac>"  stay signed in: lives 12 hours, slid on each office request
 *   ar_lv  = "s:<hmac>"  just this once: same, but also requires…
 *   ar_lvs = "<hmac>"    …a browser-session cookie, so closing the browser ends it
 * Twelve hours without an office request lets ar_lv lapse; the gate then ends
 * the session, and the person signs in again from the start.
 *
 * The emailed code itself is asked for the first time a device is used and
 * again only after that device has gone 12 hours without using the office:
 *   ar_lvd = "<hmac of user id>"  slid with ar_lv, 12-hour idle life
 * A sign-in on a device that still holds a valid ar_lvd skips the code and
 * goes straight to "stay signed in?". The PIN after 30 idle minutes is separate.
 */
import { hmacSign, timingSafeEqual } from "./pin";

export const LV_COOKIE = "ar_lv";
export const LV_SESSION_COOKIE = "ar_lvs";
export const LV_PENDING_COOKIE = "ar_lvp";
export const LV_DEVICE_COOKIE = "ar_lvd";
export const LV_IDLE_MAX_AGE_S = 12 * 60 * 60;
export const LV_PENDING_MAX_AGE_S = 10 * 60;
/** An emailed link/code sign-in: long enough to create the account and choose a password first. */
export const LV_PROVEN_MAX_AGE_S = 30 * 60;

export type LvMode = "p" | "s";

export async function lvCookieValue(secret: string, sessionId: string, mode: LvMode): Promise<string> {
  return `${mode}:${await hmacSign(secret, `lv:${mode}:${sessionId}`)}`;
}

/** Is this office session verified? Needs a valid ar_lv, plus ar_lvs when it was "just this once". */
export async function verifyLvCookies(secret: string, sessionId: string, lv: string | undefined, lvs: string | undefined): Promise<boolean> {
  if (!lv) return false;
  const mode = lv.slice(0, 2) === "p:" ? "p" : lv.slice(0, 2) === "s:" ? "s" : null;
  if (!mode) return false;
  const expected = await lvCookieValue(secret, sessionId, mode);
  if (!timingSafeEqual(expected, lv)) return false;
  if (mode === "p") return true;
  return !!lvs && timingSafeEqual(expected.slice(2), lvs);
}

/** Short-lived marker set once the emailed code checks out, consumed by the stay-signed-in choice. */
export function lvPendingValue(secret: string, sessionId: string): Promise<string> {
  return hmacSign(secret, `lvp:${sessionId}`);
}
export async function verifyLvPending(secret: string, sessionId: string, value: string | undefined): Promise<boolean> {
  if (!value) return false;
  return timingSafeEqual(await lvPendingValue(secret, sessionId), value);
}

/** Device marker: this browser passed the emailed code for this user within the last 12 active hours. */
export function lvDeviceValue(secret: string, userId: string): Promise<string> {
  return hmacSign(secret, `lvd:${userId}`);
}
export async function verifyLvDevice(secret: string, userId: string, value: string | undefined): Promise<boolean> {
  if (!value) return false;
  return timingSafeEqual(await lvDeviceValue(secret, userId), value);
}
