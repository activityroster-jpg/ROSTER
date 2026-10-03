import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { describeViolation, parseCspReports } from "@/lib/security/csp";
import { getEnv, getRepositories } from "@/lib/cf/bindings";
import { resolveHost } from "@/lib/tenant/host";

export const dynamic = "force-dynamic";

/**
 * Browser CSP violation sink for the report-only nonce policy. Persists a
 * sample per centre into the error log (Dev Center → Errors) so the policy can
 * be enforced with confidence. Heavily rate-limited; never fails loudly.
 */
export async function POST(req: Request) {
  const perIp = await rateLimit(`csp-report:${clientIp(req)}`, 20, 60);
  if (!perIp.allowed) return new Response(null, { status: 429 });
  const global = await rateLimit("csp-report:global", 200, 60 * 60);
  if (!global.allowed) return new Response(null, { status: 204 });

  const text = await req.text().catch(() => "");
  if (text.length > 20_000) return new Response(null, { status: 413 });
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { return new Response(null, { status: 400 }); }
  const reports = parseCspReports(body).slice(0, 5);
  if (reports.length === 0) return new Response(null, { status: 204 });

  try {
    const env = getEnv();
    const { control } = await getRepositories();
    const host = resolveHost(req.headers.get("host"), env.APP_APEX_DOMAIN);
    const slug = host.kind === "tenant" ? host.slug : null;
    const org = slug ? await control.organisationBySlug(slug) : null;
    const userAgent = req.headers.get("user-agent") ?? undefined;
    for (const v of reports) {
      let path: string | null = null;
      try { path = v.documentUri ? new URL(v.documentUri).pathname : null; } catch { path = null; }
      await control.createErrorReport({
        organisationId: org?.id ?? null,
        organisationSlug: slug,
        userId: null,
        userEmail: null,
        path,
        message: describeViolation(v),
        digest: "csp-report-only",
        userAgent,
      });
    }
  } catch (err) {
    console.error("[csp-report] persist failed:", (err as Error).message);
  }
  return new Response(null, { status: 204 });
}

export function GET() {
  return NextResponse.json({ ok: true, accepts: "POST application/csp-report" });
}
