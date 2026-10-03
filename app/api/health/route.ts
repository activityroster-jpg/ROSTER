import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, getEnv } from "@/lib/cf/bindings";

export const dynamic = "force-dynamic";

/** Smoke-test and uptime endpoint: the Worker is up and can reach its database. No personal data. */
export async function GET() {
  const env = getEnv();
  let db = "ok";
  try { await (await getDb()).run(sql`select 1`); } catch { db = "error"; }
  const ok = db === "ok";
  return NextResponse.json({ ok, env: env.APP_ENV ?? "unknown", db, at: new Date().toISOString() }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
