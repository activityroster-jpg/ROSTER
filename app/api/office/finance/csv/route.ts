import { requireTenant } from "@/lib/tenant/require";
import { getHoursSummary, hoursToCsv } from "@/lib/services/finance";

export const dynamic = "force-dynamic";

/** Download hours + pay as CSV. Admin only, tenant scoped. */
export async function GET() {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const rows = await getHoursSummary(repos, ctx);
  return new Response(hoursToCsv(rows), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${ctx.slug}-hours-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
