import { NextResponse } from "next/server";
import { getEnv, getRepositories } from "@/lib/cf/bindings";
import { syncAllIntegrations } from "@/lib/services/integrations";

export const dynamic = "force-dynamic";

/** Length-safe, constant-time-ish string compare to avoid leaking the secret via timing. */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Scheduled sync of every centre's auto-sync booking integrations.
 *
 * Trigger it daily with a Cloudflare Cron Trigger (or any scheduler / GitHub
 * Action) that calls this URL with the shared secret:
 *   Authorization: Bearer <CRON_SECRET>     (or ?key=<CRON_SECRET>)
 * Set CRON_SECRET as a Worker secret. If it's unset the endpoint is disabled.
 */
async function run(req: Request): Promise<Response> {
  const env = getEnv();
  const secret = env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 });

  const url = new URL(req.url);
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("key") ?? "";
  if (!timingSafeEqualStr(provided, secret)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const repos = await getRepositories();
  const summary = await syncAllIntegrations(repos);
  return NextResponse.json({ ok: true, summary });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
