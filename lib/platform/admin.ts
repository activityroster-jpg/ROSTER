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

/** Resolve the signed-in user and require they be a platform admin, else deny. */
export async function requirePlatformAdmin(): Promise<{ email: string }> {
  const h = new Headers(await headers());
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: h });
  const email = session?.user?.email ?? null;
  if (!(await isPlatformAdminEmail(email))) redirect("/sign-in");
  // Unfamiliar device/network → password again; then the 4-digit PIN.
  await enforceDeviceGate(session!.user.id, "/admin", null);
  // The money-facing admin also requires the 4-digit PIN each session…
  await enforcePinGate(session!.user.id, session!.session?.id, "/admin");
  // …and an authenticator-app code (TOTP), enrolled once and entered per session.
  const path = h.get(PATH_HEADER) || "/admin";
  await enforceTotpGate(session!.user.id, session!.session?.id, path.startsWith("/admin") ? path : "/admin");
  return { email: email! };
}
