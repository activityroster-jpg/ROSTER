import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getEnv } from "@/lib/cf/bindings";
import { enforcePinGate } from "@/lib/auth/pin-gate";
import { enforceDeviceGate } from "@/lib/auth/device-gate";
import { enforceTotpGate } from "@/lib/auth/totp-gate";
import { PATH_HEADER } from "@/lib/auth/device";

/**
 * Dev Center (platform-owner) access control. This is the ONE surface that
 * legitimately spans all organisations — for the platform owner to manage
 * centres, billing and usage. It is gated by an explicit email allowlist held
 * in the PLATFORM_ADMIN_EMAILS worker var; if that is unset, nobody is admin.
 */
export function platformAdminEmails(): Set<string> {
  const raw = getEnv().PLATFORM_ADMIN_EMAILS ?? "";
  return new Set(raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
}

export async function isPlatformAdminEmail(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  return platformAdminEmails().has(email.toLowerCase());
}

/**
 * Resolve the signed-in user and require they be a platform admin, else deny.
 * Memoised per request: the Dev Center layout and the page both call it, and
 * the session lookup and three gates used to run twice on every page load.
 */
export const requirePlatformAdmin = cache(async function requirePlatformAdmin(): Promise<{ email: string }> {
  const h = new Headers(await headers());
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: h });
  const email = session?.user?.email ?? null;
  // The Dev Center's own door: signs an admin in and sends them back here.
  if (!(await isPlatformAdminEmail(email))) redirect("/dev");
  // Unfamiliar device/network → password again; then the 4-digit PIN.
  await enforceDeviceGate(session!.user.id, "/admin", null, true, true);
  // The money-facing admin also requires the 4-digit PIN each session…
  await enforcePinGate(session!.user.id, session!.session?.id, "/admin");
  // …and an authenticator-app code (TOTP), enrolled once and entered per session.
  // The security page itself is exempt so enrolment can't loop, but only when it
  // is being rendered: a server action posted to that path gets no exemption.
  const path = h.get(PATH_HEADER) || "/admin";
  const isAction = h.has("next-action");
  await enforceTotpGate(session!.user.id, session!.session?.id, isAction ? "/admin" : path.startsWith("/admin") ? path : "/admin");
  return { email: email! };
});
