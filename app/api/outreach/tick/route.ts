import { NextResponse } from "next/server";
import { getDb, getEnv } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { researchBatch, runDueSends } from "@/lib/outreach/engine";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/**
 * The agent's heartbeat. OpenNext has no cron, so an external pinger calls this
 * hourly (see docs/outreach.md) with the shared secret. Each tick researches a
 * small batch of new leads per running campaign and sends whatever is due, both
 * bounded so a single request stays well inside Worker CPU limits.
 */
async function tick(req: Request) {
  const limit = await rateLimit(`outreach-tick:${clientIp(req)}`, 30, 60);
  if (!limit.allowed) return tooManyRequests();
  const env = getEnv();
  const secret = env.OUTREACH_CRON_SECRET;
  const given = req.headers.get("x-outreach-secret") ?? new URL(req.url).searchParams.get("secret") ?? "";
  if (!secret || !same(given, secret)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const db = await getDb();
  const p = new PlatformRepository(db);
  const running = (await p.listOutreachCampaigns()).filter((c) => c.status === "running");
  const research: Record<string, { researched: number; queued: number; noEmail: number }> = {};
  for (const c of running) research[c.id] = await researchBatch(db, env, c.id, 10);
  const sends = await runDueSends(db, env, { limit: 25 });
  return NextResponse.json({ ok: true, campaigns: running.length, research, sends });
}

export async function POST(req: Request) { return tick(req); }
export async function GET(req: Request) { return tick(req); }
