import { NextResponse } from "next/server";
import { getDb, getEnv } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { checkCronSecret } from "@/lib/security/cron-secret";
import { ingestInbound } from "@/lib/finance/receipt-inbox";

export const dynamic = "force-dynamic";

/** Cloudflare Email Routing accepts messages up to 25 MB. */
const MAX_MESSAGE_BYTES = 25 * 1024 * 1024;

/**
 * Receipts emailed in. Only workers/mail-in calls this, with the shared machine
 * secret, posting the raw message and its envelope. 404 tells the worker to
 * reject a message sent to any address but the books' private one.
 */
export async function POST(req: Request) {
  if (!checkCronSecret(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const from = req.headers.get("x-envelope-from") ?? "";
  const to = req.headers.get("x-envelope-to") ?? "";
  if (!from || !to) return NextResponse.json({ error: "Missing envelope" }, { status: 400 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_MESSAGE_BYTES) return NextResponse.json({ error: "Too large" }, { status: 413 });
  const raw = await req.arrayBuffer();
  if (raw.byteLength > MAX_MESSAGE_BYTES) return NextResponse.json({ error: "Too large" }, { status: 413 });
  const result = await ingestInbound(new PlatformRepository(await getDb()), raw, { from, to }, getEnv().ANTHROPIC_API_KEY);
  if (result === "unknown_address") return NextResponse.json({ error: "Unknown address" }, { status: 404 });
  return NextResponse.json({ ok: true, result });
}
