import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getEnv, getRepositories } from "@/lib/cf/bindings";
import { PIN_COOKIE, verifyPinCookie } from "./pin";

/**
 * Require that the current user has set, and verified for this session, their
 * 4-digit PIN. Called from requireTenant (for centre admins) and
 * requirePlatformAdmin. Redirects to /set-pin if they have no PIN yet, or /pin if
 * this session hasn't verified it. Instructors never reach here.
 */
export async function enforcePinGate(userId: string, sessionId: string | undefined, next: string): Promise<void> {
  if (!sessionId) return; // can't bind a cookie without a session id; fail open to avoid lockout loops
  const { control } = await getRepositories();
  const sec = await control.getUserSecurity(userId);
  const nextParam = `?next=${encodeURIComponent(next)}`;
  if (!sec?.pinHash) redirect(`/set-pin${nextParam}`);

  const jar = await cookies();
  const secret = getEnv().BETTER_AUTH_SECRET ?? "dev-insecure-secret-change-me";
  const ok = await verifyPinCookie(secret, sessionId, jar.get(PIN_COOKIE)?.value);
  if (!ok) redirect(`/pin${nextParam}`);
}
