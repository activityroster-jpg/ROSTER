"use server";

import { codeEmailHtml } from "@/lib/mail/code-email";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getEnv, getRepositories } from "@/lib/cf/bindings";
import { currentDeviceId } from "@/lib/auth/device-gate";
import { checkCode, issueCode } from "@/lib/security/reset-code";
import { describeAgent, notifySecurityChange, recordSecurityEvent, requestFingerprint } from "@/lib/security/events";
import { rateLimit } from "@/lib/security/rate-limit";
import { escapeHtml, sendEmail } from "@/lib/mail";

export type VerifyResult = { ok: boolean; error?: string; message?: string; next?: string };

function safeNext(next: string | undefined): string {
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

async function sessionUser() {
  const auth = await getAuth();
  const s = await auth.api.getSession({ headers: new Headers(await headers()) });
  return s?.user ? { id: s.user.id } : null;
}

const maskEmail = (e: string) => e.replace(/^(.)(.*)(@.*)$/, (_, a: string, b: string, c: string) => `${a}${"*".repeat(Math.min(b.length, 6))}${c}`);

/** Magic-link-only accounts: email a one-time code instead of a password. */
export async function requestDeviceCodeAction(): Promise<VerifyResult> {
  const me = await sessionUser();
  if (!me) return { ok: false, error: "Please sign in again." };
  const { control } = await getRepositories();
  const user = await control.userById(me.id);
  if (!user) return { ok: false, error: "Please sign in again." };

  const code = await issueCode(getEnv().TENANT_CACHE, `device:${me.id}`);
  if (!code) return { ok: false, error: "We've already sent a few codes — check your inbox, or try again in an hour." };
  const fp = await requestFingerprint();
  const recipients = [...new Set([user.email, user.recoveryEmail].filter((e): e is string => Boolean(e)))];
  await Promise.all(recipients.map((to) => sendEmail({
    to,
    subject: `${code} is your ActivityRoster sign-in code`,
    code: true,
    html: codeEmailHtml({
      label: "sign-in code",
      code,
      details: [`Someone is signing in to your ActivityRoster account from a device we haven't seen before (${escapeHtml(describeAgent(fp.userAgent))}${fp.country ? `, ${escapeHtml(fp.country)}` : ""}). If that's you, enter the code.`],
      footnote: "It expires in 10 minutes and works once. If it wasn't you, don't enter it: change your password instead.",
    }),
  }).catch(() => {})));
  return { ok: true, message: `Code sent to ${maskEmail(user.email)}${user.recoveryEmail ? " and your recovery email" : ""}.` };
}

export type DeviceProof = { password?: string; code?: string };

/**
 * Confirm this device × IP × country with the account password (or the
 * emailed code), remember it, and continue. Throttled fail-closed; every
 * outcome is logged, and a confirmed new device is emailed to the user.
 */
export async function verifyDeviceAction(next: string, proof: DeviceProof): Promise<VerifyResult> {
  const me = await sessionUser();
  if (!me) return { ok: false, error: "Please sign in again." };
  const deviceId = await currentDeviceId();
  if (!deviceId) return { ok: false, error: "Your browser isn't accepting cookies — enable them and reload." };

  const limit = await rateLimit(`verify-device:${me.id}`, 10, 15 * 60, { failClosed: true });
  if (!limit.allowed) return { ok: false, error: "Too many attempts. Try again in 15 minutes." };

  const fp = await requestFingerprint();
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
      await recordSecurityEvent("reauth_failed", { userId: me.id, meta: { method: "password" } });
      return { ok: false, error: "That password isn't right." };
    }
    method = "password";
  } else if (typeof proof?.code === "string" && proof.code.trim()) {
    const r = await checkCode(getEnv().TENANT_CACHE, `device:${me.id}`, proof.code.trim());
    if (r !== "ok") {
      await recordSecurityEvent("reauth_failed", { userId: me.id, meta: { method: "code", result: r } });
      return { ok: false, error: r === "wrong" ? "That code isn't right." : r === "locked" ? "Too many wrong codes — request a new one." : "That code has expired — request a new one." };
    }
    method = "code";
  } else {
    return { ok: false, error: "Enter your password, or request an emailed code." };
  }

  const { control } = await getRepositories();
  await control.trustDevice({ userId: me.id, deviceId, ip: fp.ip ?? "unknown", country: fp.country, userAgent: fp.userAgent });
  await recordSecurityEvent("reauth_passed", { userId: me.id, meta: { method } });
  await recordSecurityEvent("new_device", { userId: me.id });
  await notifySecurityChange(me.id, "New sign-in on your ActivityRoster account", "<p>Your account was just used from a device or location we hadn't seen before, and the password check passed.</p>");
  return { ok: true, next: safeNext(next) };
}

/** Forget every confirmed device — the next request from anywhere asks for the password again. */
export async function forgetDevicesAction(): Promise<VerifyResult> {
  const me = await sessionUser();
  if (!me) return { ok: false, error: "Please sign in again." };
  const { control } = await getRepositories();
  const n = await control.forgetTrustedDevices(me.id);
  await recordSecurityEvent("new_device", { userId: me.id, meta: { forgotAll: n } });
  return { ok: true, message: `Forgot ${n} device${n === 1 ? "" : "s"}. You'll be asked for your password on your next page.` };
}
