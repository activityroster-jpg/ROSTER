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
  clampIdleMinutes,
  PIN_LOCK_MS,
  PIN_MAX_FAILS,
  PIN_REGEX,
} from "@/lib/auth/pin";
import { checkCode, issueCode } from "@/lib/security/reset-code";
import { notifySecurityChange, recordSecurityEvent } from "@/lib/security/events";
import { rateLimit } from "@/lib/security/rate-limit";
import { sendEmail } from "@/lib/mail";
import { authSecret } from "@/lib/security/secrets";
import { resolveHost } from "@/lib/tenant/host";
import { createTenantRepositories } from "@/lib/db/repositories";
import { getDb } from "@/lib/cf/bindings";
import { STEPUP_COOKIE, STEPUP_TTL_S, stepUpCookieValue } from "@/lib/auth/step-up";
import { hasFreshStepUp } from "@/lib/auth/step-up-server";

export type PinResult = { ok: boolean; error?: string; message?: string };

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

/** The centre's idle timeout (Settings → Security), read from the host we are on; 30 minutes elsewhere. */
async function idleMinutesForHost(): Promise<number> {
  try {
    const env = getEnv();
    const host = resolveHost((await headers()).get("host"), env.APP_APEX_DOMAIN || "activityroster.com");
    if (host.kind !== "tenant") return 30;
    const { control } = await getRepositories();
    const org = await control.organisationBySlug(host.slug);
    if (!org) return 30;
    const t = createTenantRepositories(await getDb());
    const settings = (await t.orgSettings.list({ organisationId: org.id, slug: org.slug, system: true, reason: "pin idle timeout" }))[0];
    return clampIdleMinutes(settings?.idleTimeoutMinutes ?? 30);
  } catch {
    return 30;
  }
}

async function setVerifiedCookie(sessionId: string) {
  const env = getEnv();
  const idle = await idleMinutesForHost();
  const value = await pinCookieValue(authSecret(env), sessionId, idle);
  const jar = await cookies();
  jar.set(PIN_COOKIE, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    domain: `.${env.APP_APEX_DOMAIN}`,
    maxAge: idle * 60,
  });
}

const maskEmail = (e: string) => e.replace(/^(.)(.*)(@.*)$/, (_, a: string, b: string, c: string) => `${a}${"*".repeat(Math.min(b.length, 6))}${c}`);

/** Set (or change) the current user's 4-digit PIN, then continue. */
export async function setPinAction(pin: string, confirm: string, next: string): Promise<PinResult> {
  const info = await sessionInfo();
  if (!info) return { ok: false, error: "Please sign in again." };
  if (!PIN_REGEX.test(pin)) return { ok: false, error: "Your PIN must be exactly 4 digits." };
  if (pin !== confirm) return { ok: false, error: "The two PINs don't match." };

  const { control } = await getRepositories();
  await control.setUserPin(info.userId, await hashPin(pin));
  await recordSecurityEvent("pin_set", { userId: info.userId });
  if (info.sessionId) await setVerifiedCookie(info.sessionId);
  redirect(safeNext(next));
}

/**
 * Forgot PIN, step 1 (no password on the account): email a one-time code to
 * the account address and the recovery address. Send-limited per user.
 */
export async function requestPinResetCodeAction(): Promise<PinResult> {
  const info = await sessionInfo();
  if (!info) return { ok: false, error: "Please sign in again." };
  const { control } = await getRepositories();
  const user = await control.userById(info.userId);
  if (!user) return { ok: false, error: "Please sign in again." };

  const code = await issueCode(getEnv().TENANT_CACHE, `pin-reset:${info.userId}`);
  if (!code) return { ok: false, error: "We've already sent a few codes — check your inbox, or try again in an hour." };

  const recipients = [...new Set([user.email, user.recoveryEmail].filter((e): e is string => Boolean(e)))];
  await Promise.all(recipients.map((to) => sendEmail({
    to,
    subject: "Your ActivityRoster PIN reset code",
    html: `<p>Your code to reset your login PIN is:</p>
      <p style="font-size:22px;font-weight:700;letter-spacing:3px">${code}</p>
      <p style="color:#64748b;font-size:12px">It expires in 10 minutes and works once. If you didn't ask to reset your PIN, ignore this email and consider changing your password.</p>`,
  }).catch(() => {})));
  await recordSecurityEvent("pin_reset_code_sent", { userId: info.userId });
  return { ok: true, message: `We've emailed a 6-digit code to ${maskEmail(user.email)}${user.recoveryEmail ? " and your recovery email" : ""}.` };
}

export type PinResetProof = { password?: string; code?: string };

/**
 * Forgot PIN, step 2: prove it's really you — your account password, or the
 * emailed one-time code — then the PIN is cleared so you can set a fresh one.
 * A signed-in session alone is NOT enough: the PIN exists to protect against a
 * stolen or left-open session. Attempts are throttled (fail-closed) and every
 * outcome is recorded and notified.
 */
export async function resetMyPinAction(next: string, proof: PinResetProof): Promise<PinResult> {
  const info = await sessionInfo();
  if (!info) return { ok: false, error: "Please sign in again." };

  const limit = await rateLimit(`pin-reset:${info.userId}`, 10, 15 * 60, { failClosed: true });
  if (!limit.allowed) return { ok: false, error: "Too many attempts. Try again in 15 minutes." };

  const { control } = await getRepositories();
  let method: "password" | "code";

  if (typeof proof?.password === "string" && proof.password.length > 0) {
    let ok = false;
    try {
      const auth = await getAuth();
      const res = await auth.api.verifyPassword({ body: { password: proof.password }, headers: new Headers(await headers()) });
      ok = Boolean((res as { status?: boolean } | null)?.status);
    } catch {
      ok = false;
    }
    if (!ok) {
      await recordSecurityEvent("pin_reset_failed", { userId: info.userId, meta: { method: "password" } });
      return { ok: false, error: "That password isn't right." };
    }
    method = "password";
  } else if (typeof proof?.code === "string" && proof.code.trim().length > 0) {
    const r = await checkCode(getEnv().TENANT_CACHE, `pin-reset:${info.userId}`, proof.code.trim());
    if (r !== "ok") {
      await recordSecurityEvent("pin_reset_failed", { userId: info.userId, meta: { method: "code", result: r } });
      return {
        ok: false,
        error: r === "wrong" ? "That code isn't right." : r === "locked" ? "Too many wrong codes — request a new one." : "That code has expired — request a new one.",
      };
    }
    method = "code";
  } else {
    return { ok: false, error: "Enter your password, or request an emailed code." };
  }

  await control.clearUserPin(info.userId);
  await recordSecurityEvent("pin_reset", { userId: info.userId, meta: { method } });
  await notifySecurityChange(
    info.userId,
    "Your ActivityRoster PIN was reset",
    `<p>Your login PIN was just reset using ${method === "password" ? "your password" : "an emailed code"}, and a new one is being set.</p>`,
  );
  redirect(`/set-pin?next=${encodeURIComponent(safeNext(next))}`);
}

/**
 * Step-up before something you can't take back (a full export, an anonymisation):
 * the PIN again, with the same lockout as the PIN screen. Sets a ten-minute
 * cookie bound to this session. Returns ok without asking if one is still fresh.
 */
export async function stepUpWithPinAction(pin: string | null): Promise<PinResult & { needsPin?: boolean }> {
  const info = await sessionInfo();
  if (!info?.sessionId) return { ok: false, error: "Please sign in again." };
  if (pin === null) return (await hasFreshStepUp()) ? { ok: true } : { ok: false, needsPin: true };
  if (!PIN_REGEX.test(pin)) return { ok: false, needsPin: true, error: "Enter your 4-digit PIN." };
  const { control } = await getRepositories();
  const sec = await control.getUserSecurity(info.userId);
  if (!sec?.pinHash) return { ok: false, error: "Set a login PIN first (Settings → Data & account)." };
  if (sec.pinLockedUntil && sec.pinLockedUntil.getTime() > Date.now()) {
    const mins = Math.ceil((sec.pinLockedUntil.getTime() - Date.now()) / 60000);
    return { ok: false, error: `Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` };
  }
  if (await verifyPin(pin, sec.pinHash)) {
    await control.resetPinFailures(info.userId);
    const env = getEnv();
    (await cookies()).set(STEPUP_COOKIE, await stepUpCookieValue(authSecret(env), info.sessionId), { httpOnly: true, secure: true, sameSite: "strict", path: "/", domain: `.${env.APP_APEX_DOMAIN}`, maxAge: STEPUP_TTL_S });
    await recordSecurityEvent("step_up", { userId: info.userId });
    return { ok: true };
  }
  const attempt = (sec.pinFailedCount ?? 0) + 1;
  const willLock = attempt >= PIN_MAX_FAILS;
  await control.recordPinFailure(info.userId, willLock ? new Date(Date.now() + PIN_LOCK_MS) : null);
  await recordSecurityEvent(willLock ? "pin_locked" : "pin_failed", { userId: info.userId, meta: { attempt, stepUp: true } });
  const left = PIN_MAX_FAILS - attempt;
  return { ok: false, needsPin: true, error: willLock ? "Too many attempts — locked for 15 minutes." : `Incorrect PIN. ${left} attempt${left === 1 ? "" : "s"} left.` };
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
  await recordSecurityEvent(willLock ? "pin_locked" : "pin_failed", { userId: info.userId, meta: { attempt } });
  if (willLock) {
    await notifySecurityChange(info.userId, "Your ActivityRoster PIN was locked after repeated wrong attempts", "<p>Someone entered the wrong login PIN on your account 5 times, so it's locked for 15 minutes.</p>");
  }
  const left = PIN_MAX_FAILS - attempt;
  return {
    ok: false,
    error: willLock ? "Too many attempts — locked for 15 minutes." : `Incorrect PIN. ${left} attempt${left === 1 ? "" : "s"} left.`,
  };
}
