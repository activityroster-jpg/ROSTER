import { requireTenant } from "@/lib/tenant/require";
import { auditLogCsv } from "@/lib/services/person-data";

export const dynamic = "force-dynamic";
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** The centre's change log as CSV for a date range (default: last 90 days). Admin only; audited. */
export async function GET(req: Request) {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const sp = new URL(req.url).searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const to = ISO.test(sp.get("to") ?? "") ? sp.get("to")! : today;
  const d = new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 90);
  const from = ISO.test(sp.get("from") ?? "") ? sp.get("from")! : d.toISOString().slice(0, 10);
  const csv = await auditLogCsv(repos, ctx, from, to);
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${ctx.slug}-change-log-${from}-to-${to}.csv"`, "Cache-Control": "no-store" } });
}
