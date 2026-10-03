import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getRepositories } from "@/lib/cf/bindings";
import { authSecret } from "@/lib/security/secrets";
import { LV_COOKIE, LV_SESSION_COOKIE, verifyLvCookies } from "./login-verify";

/**
 * Office gate: the session must carry a valid "login verified" cookie (see
 * login-verify.ts). Without one the session is ended server-side and the
 * person starts again at sign-in: that is what happens after 12 hours away,
 * after closing the browser on a "just this once" sign-in, or if someone
 * reaches the office without finishing the email-code step.
 */
export async function enforceLoginVerified(sessionId: string | undefined): Promise<void> {
  if (!sessionId) redirect("/sign-in");
  const jar = await cookies();
  const ok = await verifyLvCookies(authSecret(), sessionId, jar.get(LV_COOKIE)?.value, jar.get(LV_SESSION_COOKIE)?.value);
  if (ok) return;
  const { control } = await getRepositories();
  // A session only minutes old that has not been verified yet is a sign-in
  // that skipped the step (an email-confirmation auto sign-in, an older
  // magic link): send it to the step rather than throwing it away.
  const row = await control.sessionById(sessionId).catch(() => null);
  if (row && Date.now() - row.createdAt.getTime() < FRESH_WINDOW_MS) redirect("/verify-login?next=%2Foffice");
  await control.deleteSessionById(sessionId).catch(() => {});
  redirect("/sign-in?expired=1");
}

const FRESH_WINDOW_MS = 15 * 60 * 1000;
