import { requireTenant } from "@/lib/tenant/require";
import { getDaySheet, londonToday, sheetToCsv } from "@/lib/services/emergency";

export const dynamic = "force-dynamic";
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** CSV of the emergency sheet for one day. Admin only; the service logs the view. */
export async function GET(req: Request) {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const q = new URL(req.url).searchParams.get("date");
  const date = q && ISO.test(q) ? q : londonToday();
  const csv = sheetToCsv(await getDaySheet(repos, ctx, date));
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${ctx.slug}-emergency-${date}.csv"`, "Cache-Control": "no-store" } });
}
