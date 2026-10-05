import { NextResponse } from "next/server";
import { z } from "zod";
import { PREVIEW_COOKIE, PREVIEW_MAX_AGE_S, pinMatches, previewToken, safeNext } from "@/lib/preview/gate";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({ pin: z.string().trim().max(12), next: z.string().max(300).optional() });

/** The Coming soon page's PIN form. Ten tries an hour per address; a right PIN sets a 30-day cookie. */
export async function POST(req: Request) {
  const limit = await rateLimit(`preview-pin:${clientIp(req)}`, 10, 60 * 60, { failClosed: true });
  if (!limit.allowed) return tooManyRequests();
  const form = await req.formData().catch(() => null);
  const parsed = schema.safeParse({ pin: form?.get("pin") ?? "", next: form?.get("next") ?? undefined });
  const next = safeNext(parsed.success ? parsed.data.next : "/");
  const base = new URL(req.url);
  if (!parsed.success || !(await pinMatches(parsed.data.pin))) {
    return NextResponse.redirect(new URL(`/coming-soon?wrong=1&next=${encodeURIComponent(next)}`, base), 303);
  }
  const res = NextResponse.redirect(new URL(next, base), 303);
  res.cookies.set(PREVIEW_COOKIE, await previewToken(), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: PREVIEW_MAX_AGE_S });
  return res;
}
