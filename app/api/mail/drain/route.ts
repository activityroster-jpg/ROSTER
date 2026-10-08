import { NextResponse } from "next/server";
import { getDb, getEnv } from "@/lib/cf/bindings";
import { drainEmailQueue } from "@/lib/mail/queue";
import { drainPushQueue } from "@/lib/push/queue";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/rate-limit";
import { checkCronSecret } from "@/lib/security/cron-secret";

export const dynamic = "force-dynamic";

/**
 * The delivery job: every two minutes the roster-tick worker calls this with
 * the cron secret, and it sends queued emails and phone notifications (bulk
 * notices such as a published week). Each run is bounded, so a big centre's
 * notices go out over a few runs, never past Cloudflare's per-request limits.
 */
async function drain(req: Request) {
  const limit = await rateLimit(`mail-drain:${clientIp(req)}`, 60, 60);
  if (!limit.allowed) return tooManyRequests();
  if (!checkCronSecret(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const env = getEnv();
  const db = await getDb();
  const mail = await drainEmailQueue(db, env, new Date(), 150, undefined, { concurrency: 5, purge: false }).catch((e: Error) => ({ due: 0, sent: 0, failed: 0, purged: 0, error: e.message }));
  const push = await drainPushQueue(db, env, 200).catch((e: Error) => ({ due: 0, sent: 0, dead: 0, error: e.message }));
  return NextResponse.json({ ok: true, mail, push });
}

export async function POST(req: Request) { return drain(req); }
export async function GET(req: Request) { return drain(req); }
