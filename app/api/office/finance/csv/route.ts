import { requireTenant } from "@/lib/tenant/require";
import { getPayrollLines, payrollLinesToCsv, payrollSummaryToCsv, summariseByInstructor } from "@/lib/services/finance";
import { payrollQuerySchema, resolvePayrollFilter } from "@/lib/validation/payroll";

export const dynamic = "force-dynamic";

/**
 * Download payroll as a spreadsheet (CSV opens in Excel / Google Sheets).
 * ?format=detail (every shift: start, finish, lunch) or summary (per instructor),
 * filtered by period and/or instructor. Admin only, tenant scoped.
 */
export async function GET(req: Request) {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const q = payrollQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const filter = resolvePayrollFilter(q);
  const { lines } = await getPayrollLines(repos, ctx, filter);
  const csv = q.format === "summary" ? payrollSummaryToCsv(summariseByInstructor(lines)) : payrollLinesToCsv(lines);
  const who = filter.instructorId ? `-${(lines[0]?.instructorName ?? "instructor").toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : "";
  const span = filter.from || filter.to ? `-${filter.from ?? "start"}_to_${filter.to ?? "now"}` : `-${new Date().toISOString().slice(0, 10)}`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ctx.slug}-payroll-${q.format}${who}${span}.csv"`,
    },
  });
}
