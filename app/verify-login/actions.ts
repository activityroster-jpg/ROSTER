"use server";

import { codeEmailHtml } from "@/lib/mail/code-email";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getEnv, getRepositories } from "@/lib/cf/bindings";
import { currentDeviceId } from "@/lib/auth/device-gate";
import { LV_COOKIE, LV_DEVICE_COOKIE, LV_IDLE_MAX_AGE_S, LV_PENDING_COOKIE, LV_PENDING_MAX_AGE_S, LV_SESSION_COOKIE, lvCookieValue, lvDeviceValue, lvPendingValue, verifyLvDevice, verifyLvPending } from "@/lib/auth/login-verify";
import { checkCode, issueCode } from "@/lib/security/reset-code";
import { describeAgent, recordSecurityEvent, requestFingerprint } from "@/lib/security/events";
import { rateLimit } from "@/lib/security/rate-limit";
import { authSecret } from "@/lib/security/secrets";
import { escapeHtml, sendEmail } from "@/lib/mail";
import { maskEmail } from "@/lib/security/mask";
import { otpCodeSchema } from "@/lib/validation/actions";

export type LoginVerifyResult = { ok: boolean; error?: string; message?: string };

function safeNext(next: string | undefined): string {
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/office";
}

async function me() {
  const s = await (await getAuth()).api.getSession({ headers: new Headers(await headers()) });
  if (!s?.user || !s.session?.id) return null;
  return { userId: s.user.id, email: s.user.email, sessionId: s.session.id as string, twoFactor: Boolean((s.user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled) };
}

// Apex-wide, like the session cookie: the code can be entered on the main site
// (sign in by email, then "/go" picks the centre) and the proof must travel to
// the centre's own subdomain.
const cookieOpts = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", domain: `.${getEnv().APP_APEX_DOMAIN || "activityroster.com"}` };

/** Email a six-digit code to the signed-in person. Send-limited per session. */
export async function sendLoginCodeAction(): Promise<LoginVerifyResult> {
  const who = await me();
  if (!who) return { ok: false, error: "Please sign in again." };
  const code = await issueCode(getEnv().TENANT_CACHE, `login:${who.sessionId}`);
  if (!code) return { ok: false, error: "We've already sent a few codes. Check your inbox and spam, or try again in an hour." };
  const fp = await requestFingerprint();
  await sendEmail({
    expiresInMinutes: 15,
    to: who.email,
    subject: `${code} is your ActivityRoster sign-in code`,
    code: true,
    html: codeEmailHtml({
      label: "sign-in code",
      code,
      details: [`It finishes signing in to your centre's office${fp.userAgent ? ` (${escapeHtml(describeAgent(fp.userAgent))}${fp.country ? `, ${escapeHtml(fp.country)}` : ""})` : ""}.`],
      footnote: "It expires in 10 minutes and works once. If this wasn't you, don't enter it, and change your password.",
    }),
  });
  return { ok: true, message: `Code sent to ${maskEmail(who.email)}.` };
}

/** Check the code; on success leave a short-lived marker for the stay-signed-in choice. */
export async function checkLoginCodeAction(code: string): Promise<LoginVerifyResult> {
  const who = await me();
  if (!who) return { ok: false, error: "Please sign in again." };
  const parsed = otpCodeSchema.safeParse(code);
  if (!parsed.success) return { ok: false, error: "Enter the 6-digit code from the email." };
  const limit = await rateLimit(`login-code:${who.sessionId}`, 10, 10 * 60, { failClosed: true });
  if (!limit.allowed) return { ok: false, error: "Too many attempts. Sign in again to get a new code." };
  const r = await checkCode(getEnv().TENANT_CACHE, `login:${who.sessionId}`, parsed.data);
  if (r !== "ok") {
    await recordSecurityEvent("reauth_failed", { userId: who.userId, meta: { step: "login-email-code", result: r } }).catch(() => {});
    return { ok: false, error: r === "wrong" ? "That code isn't right." : r === "locked" ? "Too many wrong codes. Send a new one." : "That code has expired. Send a new one." };
  }
  const jar = await cookies();
  jar.set(LV_PENDING_COOKIE, await lvPendingValue(authSecret(), who.sessionId), { ...cookieOpts, maxAge: LV_PENDING_MAX_AGE_S });
  return { ok: true };
}

/**
 * Finish: issue the "login verified" proof for this session and go on. Allowed
 * once the emailed code checked out (pending marker), or when the person has
 * two-factor on, because Better Auth already made them pass it to get here.
 */
export async function finishLoginAction(stay: boolean, next: string): Promise<LoginVerifyResult> {
  const who = await me();
  if (!who) return { ok: false, error: "Please sign in again." };
  const jar = await cookies();
  const secret = authSecret();
  const pendingOk = await verifyLvPending(secret, who.sessionId, jar.get(LV_PENDING_COOKIE)?.value);
  const deviceOk = await verifyLvDevice(secret, who.userId, jar.get(LV_DEVICE_COOKIE)?.value);
  if (!pendingOk && !who.twoFactor && !deviceOk) return { ok: false, error: "Enter the code from your email first." };

  const value = await lvCookieValue(secret, who.sessionId, stay ? "p" : "s");
  jar.set(LV_COOKIE, value, { ...cookieOpts, maxAge: LV_IDLE_MAX_AGE_S });
  // This device has now proved the email (or 2FA) within the last 12 hours;
  // the next sign-in from it inside that window skips the code.
  jar.set(LV_DEVICE_COOKIE, await lvDeviceValue(secret, who.userId), { ...cookieOpts, maxAge: LV_IDLE_MAX_AGE_S });
  if (stay) jar.delete(LV_SESSION_COOKIE); else jar.set(LV_SESSION_COOKIE, value.slice(2), cookieOpts);
  jar.delete(LV_PENDING_COOKIE);

  // The emailed code is as good as the new-device check's own emailed code,
  // so remember this device now rather than asking again a moment later.
  try {
    const deviceId = await currentDeviceId();
    if (deviceId) {
      const { control } = await getRepositories();
      const fp = await requestFingerprint();
      if (!(await control.isTrustedDevice(who.userId, deviceId, fp.ip ?? "unknown", fp.country))) {
        await control.trustDevice({ userId: who.userId, deviceId, ip: fp.ip ?? "unknown", country: fp.country, userAgent: fp.userAgent });
      }
    }
  } catch { /* the device gate will simply ask */ }
  await recordSecurityEvent("reauth_passed", { userId: who.userId, meta: { step: "login-verified", by: pendingOk ? "email-code" : who.twoFactor ? "2fa" : "recent-device", stay } }).catch(() => {});
  redirect(safeNext(next));
}
