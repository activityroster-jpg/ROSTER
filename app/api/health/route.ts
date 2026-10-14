import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, getEnv } from "@/lib/cf/bindings";
import { lastTick } from "@/lib/ops/tick-watch";

export const dynamic = "force-dynamic";

/**
 * Smoke-test and uptime endpoint: the Worker is up and can reach its database,
 * and how long ago the hourly job last ran (watched from GitHub, so a stopped
 * Cloudflare scheduler is still noticed). No personal data.
 */
export async function GET() {
  const env = getEnv();
  let db = "ok";
  try { await (await getDb()).run(sql`select 1`); } catch { db = "error"; }
  const ok = db === "ok";
  const tick = await lastTick();
  const tickAgeMinutes = tick ? Math.round((Date.now() - tick.getTime()) / 60_000) : null;
  return NextResponse.json({ ok, env: env.APP_ENV ?? "unknown", db, tickAgeMinutes, at: new Date().toISOString() }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
