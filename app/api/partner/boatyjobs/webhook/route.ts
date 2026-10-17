import { NextResponse } from "next/server";
import { getDb, getEnv } from "@/lib/cf/bindings";
import { verifySignature } from "@/lib/boatyjobs/signature";
import { applyBoatyEvent, parseBoatyEvent } from "@/lib/services/jobs";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Boaty Jobs → ActivityRoster: listing published / expired / removed, and
 * application received. Verified against the RAW body with HMAC-SHA256
 * (X-BoatyJobs-Signature, keyed with BOATYJOBS_PARTNER_SECRET); anything else
 * is refused. An event only ever touches the one job it names, found by its
 * external_id, and is applied with a system context for that job's centre.
 */
export async function POST(req: Request) {
  const limit = await rateLimit(`boatyjobs-webhook:${clientIp(req)}`, 300, 60);
  if (!limit.allowed) return tooManyRequests();
  const env = getEnv();
  if (!env.BOATYJOBS_PARTNER_SECRET) return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  const raw = await req.text();
  if (raw.length > 64 * 1024) return NextResponse.json({ error: "too large" }, { status: 413 });
  if (!(await verifySignature(env.BOATYJOBS_PARTNER_SECRET, raw, req.headers.get("x-boatyjobs-signature")))) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const ev = parseBoatyEvent(body);
  if (!ev) return NextResponse.json({ received: true, result: "ignored" });
  // Redelivered events (same id) are applied once: remembered for a week.
  const seen = async (id: string) => {
    const key = `boatyjobs-event:${id}`;
    if (await env.TENANT_CACHE.get(key)) return true;
    await env.TENANT_CACHE.put(key, "1", { expirationTtl: 7 * 24 * 60 * 60 });
    return false;
  };
  const result = await applyBoatyEvent(await getDb(), ev, new Date(), seen);
  return NextResponse.json({ received: true, result });
}
