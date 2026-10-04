import { hmacSign, timingSafeEqual } from "./pin";

/**
 * Step-up: the PIN again, just before something you can't take back (a full
 * export of the centre or a person, an anonymisation). Audit C7 / A10-2.
 * Proved by a short-lived signed cookie bound to the Better Auth session, so
 * it can't be carried to another session and lapses on its own.
 */
export const STEPUP_COOKIE = "ar_stepup";
export const STEPUP_TTL_S = 10 * 60;

/** Cookie value `<expiresMs>.<hmac>`. */
export async function stepUpCookieValue(secret: string, sessionId: string, now: number = Date.now()): Promise<string> {
  const exp = now + STEPUP_TTL_S * 1000;
  return `${exp}.${await hmacSign(secret, `stepup:${sessionId}:${exp}`)}`;
}

export async function verifyStepUpCookie(secret: string, sessionId: string, value: string | undefined, now: number = Date.now()): Promise<boolean> {
  if (!value) return false;
  const dot = value.indexOf(".");
  if (dot <= 0) return false;
  const exp = Number(value.slice(0, dot));
  if (!Number.isFinite(exp) || exp < now || exp > now + STEPUP_TTL_S * 1000) return false;
  const expected = await hmacSign(secret, `stepup:${sessionId}:${exp}`);
  return timingSafeEqual(expected, value.slice(dot + 1));
}
