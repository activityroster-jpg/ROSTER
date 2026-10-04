import { cookies, headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { authSecret } from "@/lib/security/secrets";
import { STEPUP_COOKIE, verifyStepUpCookie } from "./step-up";

/** True when this session entered its PIN again within the last ten minutes. */
export async function hasFreshStepUp(): Promise<boolean> {
  try {
    const s = await (await getAuth()).api.getSession({ headers: new Headers(await headers()) });
    const sessionId = s?.session?.id as string | undefined;
    if (!sessionId) return false;
    return await verifyStepUpCookie(authSecret(), sessionId, (await cookies()).get(STEPUP_COOKIE)?.value);
  } catch {
    return false;
  }
}

/** What a download route returns when the step-up is missing or stale. */
export function stepUpRequired(): Response {
  return new Response("Enter your PIN again to download this. Go back and press the download button to be asked for it.", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
