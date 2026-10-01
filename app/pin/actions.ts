"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getEnv, getRepositories } from "@/lib/cf/bindings";
import {
  hashPin,
  pinCookieValue,
  verifyPin,
  PIN_COOKIE,
  PIN_LOCK_MS,
  PIN_MAX_FAILS,
  PIN_REGEX,
} from "@/lib/auth/pin";

export type PinResult = { ok: boolean; error?: string };

/** Only allow same-site internal redirects (no open-redirect). */
function safeNext(next: string | undefined): string {
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

async function sessionInfo() {
  const h = new Headers(await headers());
  const auth = await getAuth();
  const s = await auth.api.getSession({ headers: h });
  if (!s?.user) return null;
  return { userId: s.user.id, sessionId: s.session?.id as string | undefined };
}

async function setVerifiedCookie(sessionId: string) {
  const env = getEnv();
  const value = await pinCookieValue(env.BETTER_AUTH_SECRET ?? "dev-insecure-secret-change-me", sessionId);
  const jar = await cookies();
  jar.set(PIN_COOKIE, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    domain: `.${env.APP_APEX_DOMAIN}`,
    maxAge: 60 * 60 * 24 * 7,
  });
}

/** Set (or change) the current user's 4-digit PIN, then continue. */
export async function setPinAction(pin: string, confirm: string, next: string): Promise<PinResult> {
  const info = await sessionInfo();
  if (!info) return { ok: false, error: "Please sign in again." };
  if (!PIN_REGEX.test(pin)) return { ok: false, error: "Your PIN must be exactly 4 digits." };
  if (pin !== confirm) return { ok: false, error: "The two PINs don't match." };

  const { control } = await getRepositories();
  await control.setUserPin(info.userId, await hashPin(pin));
  if (info.sessionId) await setVerifiedCookie(info.sessionId);
  redirect(safeNext(next));
}

/** Forgot PIN: clear the signed-in user's PIN so they set a fresh one. Only works
 *  for an authenticated session (reaching the PIN screen already proves sign-in). */
export async function resetMyPinAction(next: string): Promise<PinResult> {
  const info = await sessionInfo();
  if (!info) return { ok: false, error: "Please sign in again." };
  const { control } = await getRepositories();
  await control.clearUserPin(info.userId);
  redirect(`/set-pin?next=${encodeURIComponent(safeNext(next))}`);
}

/** Verify the PIN for this session (with lockout), then continue. */
export async function verifyPinAction(pin: string, next: string): Promise<PinResult> {
  const info = await sessionInfo();
  if (!info) return { ok: false, error: "Please sign in again." };
  if (!PIN_REGEX.test(pin)) return { ok: false, error: "Enter your 4-digit PIN." };

  const { control } = await getRepositories();
  const sec = await control.getUserSecurity(info.userId);
  if (!sec?.pinHash) redirect(`/set-pin?next=${encodeURIComponent(safeNext(next))}`);
  if (sec.pinLockedUntil && sec.pinLockedUntil.getTime() > Date.now()) {
    const mins = Math.ceil((sec.pinLockedUntil.getTime() - Date.now()) / 60000);
    return { ok: false, error: `Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` };
  }

  if (await verifyPin(pin, sec.pinHash)) {
    await control.resetPinFailures(info.userId);
    if (info.sessionId) await setVerifiedCookie(info.sessionId);
    redirect(safeNext(next));
  }

  const attempt = (sec.pinFailedCount ?? 0) + 1;
  const willLock = attempt >= PIN_MAX_FAILS;
  await control.recordPinFailure(info.userId, willLock ? new Date(Date.now() + PIN_LOCK_MS) : null);
  const left = PIN_MAX_FAILS - attempt;
  return {
    ok: false,
    error: willLock ? "Too many attempts — locked for 15 minutes." : `Incorrect PIN. ${left} attempt${left === 1 ? "" : "s"} left.`,
  };
}
