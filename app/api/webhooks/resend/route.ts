import { NextResponse } from "next/server";
import { getDb, getEnv } from "@/lib/cf/bindings";
import { applyResendEvent } from "@/lib/outreach/engine";
import { verifySvix } from "@/lib/outreach/svix";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Resend delivery webhook (Svix-signed). Verified against the raw body; events
 * for emails we didn't send are ignored, so a replayed or forged payload can
 * only ever touch our own outreach records.
 */
export async function POST(req: Request) {
  const limit = await rateLimit(`resend-webhook:${clientIp(req)}`, 300, 60);
  if (!limit.allowed) return tooManyRequests();
  const env = getEnv();
  if (!env.RESEND_WEBHOOK_SECRET) return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  const raw = await req.text();
  const ok = await verifySvix(env.RESEND_WEBHOOK_SECRET, { id: req.headers.get("svix-id"), timestamp: req.headers.get("svix-timestamp"), signature: req.headers.get("svix-signature") }, raw);
  if (!ok) return NextResponse.json({ error: "bad signature" }, { status: 400 });
  let body: { type?: string; data?: { email_id?: string; to?: string[] | string; bounce?: { message?: string } } };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  if (!body.type || !body.data) return NextResponse.json({ error: "bad payload" }, { status: 400 });
  const result = await applyResendEvent(await getDb(), body.type, body.data);
  return NextResponse.json({ received: true, result });
}
