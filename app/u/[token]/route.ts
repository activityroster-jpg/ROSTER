import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { escapeHtml } from "@/lib/mail";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const page = (title: string, body: string) => new Response(
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="robots" content="noindex"><style>body{font-family:system-ui,sans-serif;background:#f6f8fb;color:#0a2e52;margin:0;padding:48px 16px}main{max-width:480px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:28px}h1{font-size:20px;margin:0 0 8px}p{color:#475569;line-height:1.5}</style></head><body><main><h1>${escapeHtml(title)}</h1>${body}</main></body></html>`,
  { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
);

async function optOut(token: string, req: Request): Promise<Response> {
  const limit = await rateLimit(`unsub:${clientIp(req)}`, 30, 60);
  if (!limit.allowed) return tooManyRequests();
  if (!/^[a-f0-9]{24,80}$/i.test(token)) return page("Link not recognised", "<p>This opt-out link isn't valid. Reply to the email instead and we'll remove you by hand.</p>");
  const p = new PlatformRepository(await getDb());
  const lead = await p.getOutreachLeadByToken(token);
  if (!lead) return page("Link not recognised", "<p>This opt-out link isn't valid. Reply to the email instead and we'll remove you by hand.</p>");
  if (lead.email) await p.addSuppression(lead.email, "unsubscribe", `Opt-out link, ${lead.centreName}`);
  if (lead.status !== "opted_out") await p.updateOutreachLead(lead.id, { status: "opted_out", nextSendAt: null, lastEventAt: new Date() });
  return page("You're unsubscribed", `<p>We won't email ${escapeHtml(lead.email ?? "this address")} again. Sorry for the interruption, and thanks for letting us know.</p>`);
}

/** One-click opt-out: GET for the link in the footer, POST for List-Unsubscribe-Post. */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) { return optOut((await ctx.params).token, req); }
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) { return optOut((await ctx.params).token, req); }
