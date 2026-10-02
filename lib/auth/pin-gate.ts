import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getRepositories } from "@/lib/cf/bindings";
import { authSecret } from "@/lib/security/secrets";
import { PIN_COOKIE, verifyPinCookie } from "./pin";

/**
 * Require that the current user has set, and verified for this session, their
 * 4-digit PIN. Called from requireTenant (for every centre member) and
 * requirePlatformAdmin. Redirects to /set-pin if they have no PIN yet, or /pin if
 * this session hasn't verified it.
 */
export async function enforcePinGate(userId: string, sessionId: string | undefined, next: string): Promise<void> {
  if (!sessionId) redirect("/sign-in"); // no session id to bind the PIN cookie to → treat as signed out
  const { control } = await getRepositories();
  const sec = await control.getUserSecurity(userId);
  const nextParam = `?next=${encodeURIComponent(next)}`;
  if (!sec?.pinHash) redirect(`/set-pin${nextParam}`);

  const jar = await cookies();
  const secret = authSecret();
  const ok = await verifyPinCookie(secret, sessionId, jar.get(PIN_COOKIE)?.value);
  if (!ok) redirect(`/pin${nextParam}`);
}
