import { requireTenant } from "@/lib/tenant/require";
import { getHoursSummary } from "@/lib/services/finance";
import { Card, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const rows = await getHoursSummary(repos, ctx);
  const totalPay = rows.reduce((sum, r) => sum + (r.pay ?? 0), 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-navy">Finance</h1>
        <a
          href="/api/office/finance/csv"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy hover:bg-slate-50"
        >
          Export CSV
        </a>
      </div>

      <Card className="mb-4">
        <p className="text-sm text-slate-500">Total pay (from recorded hours)</p>
        <p className="mt-1 text-3xl font-semibold text-navy">£{totalPay.toFixed(2)}</p>
      </Card>

      <Card className="p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Instructor</th>
              <th className="px-4 py-3">Scheduled (h)</th>
              <th className="px-4 py-3">Actual (h)</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">Pay</th>
              <th className="px-4 py-3">Approved</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No hours recorded yet.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 font-medium text-navy">{r.instructorName}</td>
                  <td className="px-4 py-3 text-slate-600">{(r.scheduledMinutes / 60).toFixed(2)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.actualMinutes != null ? (r.actualMinutes / 60).toFixed(2) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.rate != null ? `£${r.rate.toFixed(2)}` : "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.pay != null ? `£${r.pay.toFixed(2)}` : "—"}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone={r.approved ? "covered" : "neutral"}>{r.approved ? "Yes" : "No"}</StatusPill>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
