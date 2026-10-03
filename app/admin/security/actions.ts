"use server";

import { cookies, headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getEnv } from "@/lib/cf/bindings";
import { isPlatformAdminEmail } from "@/lib/platform/admin";
import { authSecret } from "@/lib/security/secrets";
import { TOTP_COOKIE, TOTP_MAX_AGE_S, totpCookieValue } from "@/lib/auth/pin";
import { recordSecurityEvent } from "@/lib/security/events";
import { isPwnedPassword, PWNED_MESSAGE } from "@/lib/security/pwned";
import { firstIssue, passwordSchema } from "@/lib/validation/actions";

type Result = { ok: boolean; error?: string };

async function adminSession() {
  const h = new Headers(await headers());
  const auth = await getAuth();
  const s = await auth.api.getSession({ headers: h });
  if (!s?.user || !(await isPlatformAdminEmail(s.user.email))) return null;
  return { auth, h, userId: s.user.id, sessionId: s.session?.id as string | undefined };
}

/**
 * Step-up for the Dev Center: check an authenticator code against the signed-in
 * owner's enrolled secret (Better Auth validates it server-side) and remember
 * it for this session with a signed cookie.
 */
export async function verifyAdminTotpAction(code: string): Promise<Result> {
  const s = await adminSession();
  if (!s?.sessionId) return { ok: false, error: "Please sign in again." };
  const clean = String(code ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return { ok: false, error: "Enter the 6-digit code from your authenticator app." };
  try {
    await s.auth.api.verifyTOTP({ body: { code: clean }, headers: s.h });
  } catch {
    await recordSecurityEvent("reauth_failed", { userId: s.userId });
    return { ok: false, error: "That code isn't right — codes change every 30 seconds, try the current one." };
  }
  const env = getEnv();
  (await cookies()).set(TOTP_COOKIE, await totpCookieValue(authSecret(env), s.sessionId), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", domain: `.${env.APP_APEX_DOMAIN}`, maxAge: TOTP_MAX_AGE_S,
  });
  await recordSecurityEvent("reauth_passed", { userId: s.userId });
  return { ok: true };
}

/**
 * Authenticator enrolment needs the account password. An owner who only ever
 * used sign-in links has none, so let them set one here first (signed-in,
 * allow-listed, and only when no password exists yet).
 */
export async function setAdminPasswordAction(password: string): Promise<Result> {
  const s = await adminSession();
  if (!s) return { ok: false, error: "Please sign in again." };
  const pw = passwordSchema.safeParse(password);
  if (!pw.success) return { ok: false, error: firstIssue(pw.error) };
  if (await isPwnedPassword(password)) return { ok: false, error: PWNED_MESSAGE };
  try {
    const accounts = await s.auth.api.listUserAccounts({ headers: s.h });
    if (accounts.some((a) => a.providerId === "credential")) return { ok: false, error: "You already have a password — use it below." };
    await s.auth.api.setPassword({ body: { newPassword: password }, headers: s.h });
  } catch (err) {
    return { ok: false, error: (err as Error).message || "Could not set a password" };
  }
  await recordSecurityEvent("password_changed", { userId: s.userId });
  return { ok: true };
}
