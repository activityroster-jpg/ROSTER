import { NextResponse } from "next/server";
import { z } from "zod";
import { captureException, scrub } from "@/lib/observability/sentry";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({ message: z.string().max(2000), digest: z.string().max(200).optional() });

/** Client error sink → server-side Sentry (PII-scrubbed). DSN never touches the
 *  browser. Rate-limited so it can't be used as an abuse channel. */
export async function POST(req: Request) {
  const limit = await rateLimit(`report-error:${clientIp(req)}`, 30, 60);
  if (!limit.allowed) return NextResponse.json({ ok: false }, { status: 429 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  await captureException(new Error(scrub(parsed.data.message)), {
    tags: { area: "client" },
    extra: parsed.data.digest ? { digest: parsed.data.digest } : undefined,
  });
  return NextResponse.json({ ok: true });
}
