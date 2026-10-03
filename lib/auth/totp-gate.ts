import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getRepositories } from "@/lib/cf/bindings";
import { authSecret } from "@/lib/security/secrets";
import { TOTP_COOKIE, verifyTotpCookie } from "./pin";

export const ADMIN_SECURITY_PATH = "/admin/security";

/**
 * Dev Center only: the platform owner must have an authenticator app enrolled
 * AND have entered a code this session. Un-enrolled → the enrolment page;
 * enrolled but not yet verified this session → the same page in verify mode.
 * The security page itself is exempt so it can never loop.
 */
export async function enforceTotpGate(userId: string, sessionId: string | undefined, path: string): Promise<void> {
  if (path.startsWith(ADMIN_SECURITY_PATH)) return;
  if (!sessionId) redirect("/sign-in");
  const { control } = await getRepositories();
  const me = await control.userById(userId);
  const nextParam = `&next=${encodeURIComponent(path || "/admin")}`;
  if (!me?.twoFactorEnabled) redirect(`${ADMIN_SECURITY_PATH}?enrol=1${nextParam}`);
  const jar = await cookies();
  const ok = await verifyTotpCookie(authSecret(), sessionId, jar.get(TOTP_COOKIE)?.value);
  if (!ok) redirect(`${ADMIN_SECURITY_PATH}?verify=1${nextParam}`);
}
