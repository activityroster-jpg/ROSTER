import { requireTenant } from "@/lib/tenant/require";
import { getPayrollLines, summariseByInstructor } from "@/lib/services/finance";
import { Card, StatusPill } from "@/components/ui";
import { FeatureNotice } from "@/components/office/FeatureNotice";
import { PrintButton } from "@/components/office/PrintButton";
import { hasFeature } from "@/lib/features";
import { payrollQuerySchema, resolvePayrollFilter } from "@/lib/validation/payroll";

export const dynamic = "force-dynamic";

const SYMBOL: Record<string, string> = { GBP: "£", EUR: "€", USD: "$" };
const hrs = (m: number) => (m / 60).toFixed(2);
const fmtDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : "—");

export default async function FinancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { ctx, repos, organisation } = await requireTenant({ role: "admin" });
  const raw = await searchParams;
  const q = payrollQuerySchema.parse(Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === "string")));
  const period = q.period ?? (q.from || q.to ? "custom" : "month");
  const filter = resolvePayrollFilter({ ...q, period });
  const [{ lines, policy }, settings, instructors] = await Promise.all([
    getPayrollLines(repos, ctx, filter),
    repos.tenant.orgSettings.list(ctx),
    repos.tenant.instructor.list(ctx),
  ]);
  const cur = SYMBOL[settings[0]?.currency ?? "GBP"] ?? "";
  const money = (n: number | null) => (n == null ? "—" : `${cur}${n.toFixed(2)}`);
  const enabled = hasFeature(settings[0]?.enabledFeatures, "payroll");
  const summary = summariseByInstructor(lines);
  const totalPay = summary.reduce((s, r) => s + r.pay, 0);
  const totalPaidMins = summary.reduce((s, r) => s + r.payableMinutes, 0);
  const who = filter.instructorId ? instructors.find((i) => i.id === filter.instructorId)?.name : null;
  const span = filter.from || filter.to ? `${fmtDate(filter.from ?? null)} – ${fmtDate(filter.to ?? null)}` : "All time";

  const qs = new URLSearchParams();
  qs.set("period", period);
  if (period === "custom") { if (filter.from) qs.set("from", filter.from); if (filter.to) qs.set("to", filter.to); }
  if (filter.instructorId) qs.set("instructor", filter.instructorId);
  const exportHref = (format: "detail" | "summary") => `/api/office/finance/csv?${qs.toString()}&format=${format}`;
  const field = "rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">Payroll</h1>
          <p className="text-sm text-slate-500">{organisation.name} · {span}{who ? ` · ${who}` : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <a href="/learn?topic=time" target="_blank" rel="noreferrer" className="text-sm font-medium text-teal hover:underline">📖 Read the guide</a>
          <a href={exportHref("detail")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-navy hover:bg-slate-50">Spreadsheet · every shift</a>
          <a href={exportHref("summary")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-navy hover:bg-slate-50">Spreadsheet · totals</a>
          <PrintButton label="PDF" downloadName={`${ctx.slug}-payroll${who ? `-${who}` : ""}-${filter.from ?? "all"}`} />
        </div>
      </div>

      <FeatureNotice feature="payroll" enabled={enabled} />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-card border border-slate-200 bg-white p-3 print:hidden">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">Period
          <select name="period" defaultValue={period} className={field}>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="last-month">Last month</option>
            <option value="custom">Custom dates</option>
            <option value="all">All time</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">From
          <input type="date" name="from" defaultValue={period === "custom" ? filter.from ?? "" : ""} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">To
          <input type="date" name="to" defaultValue={period === "custom" ? filter.to ?? "" : ""} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">Instructor
          <select name="instructor" defaultValue={filter.instructorId ?? ""} className={field}>
            <option value="">Everyone</option>
            {instructors.slice().sort((a, b) => a.name.localeCompare(b.name)).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700">Show</button>
        <span className="text-xs text-slate-400">Dates only apply with “Custom dates”.</span>
      </form>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card><p className="text-sm text-slate-500">Total pay</p><p className="mt-1 text-3xl font-semibold text-navy">{money(totalPay)}</p></Card>
        <Card><p className="text-sm text-slate-500">Paid hours</p><p className="mt-1 text-3xl font-semibold text-navy">{hrs(totalPaidMins)}</p></Card>
        <Card>
          <p className="text-sm text-slate-500">Lunch breaks</p>
          <p className="mt-1 text-sm text-navy">
            {policy.breakMinutes > 0 ? `${policy.breakMinutes} min ${policy.paid ? "paid" : "unpaid"} after ${hrs(policy.afterMinutes)} h` : "Off"}
          </p>
          <a href="/office/settings" className="text-xs font-medium text-teal hover:underline print:hidden">Change in Settings →</a>
        </Card>
      </div>

      <Card className="mb-4 p-0">
        <h2 className="px-4 pt-3 font-semibold text-navy">Totals per instructor</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2">Instructor</th><th className="px-4 py-2">Shifts</th><th className="px-4 py-2">Worked (h)</th><th className="px-4 py-2">Lunch (h)</th><th className="px-4 py-2">Paid (h)</th><th className="px-4 py-2">Pay</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No hours in this period.</td></tr>
              ) : summary.map((r) => (
                <tr key={r.instructorName}>
                  <td className="px-4 py-2 font-medium text-navy">{r.instructorName}</td>
                  <td className="px-4 py-2 text-slate-600">{r.shifts}</td>
                  <td className="px-4 py-2 text-slate-600">{hrs(r.workedMinutes)}</td>
                  <td className="px-4 py-2 text-slate-600">{hrs(r.breakMinutes)}</td>
                  <td className="px-4 py-2 text-slate-600">{hrs(r.payableMinutes)}</td>
                  <td className="px-4 py-2 font-medium text-navy">{money(r.pay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-0">
        <h2 className="px-4 pt-3 font-semibold text-navy">Every shift</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Date</th><th className="px-4 py-2">Instructor</th><th className="px-4 py-2">Course</th>
                <th className="px-4 py-2">Start</th><th className="px-4 py-2">Finish</th><th className="px-4 py-2">Lunch</th>
                <th className="px-4 py-2">Paid (h)</th><th className="px-4 py-2">Rate</th><th className="px-4 py-2">Pay</th><th className="px-4 py-2">Approved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-6 text-center text-slate-400">No hours in this period.</td></tr>
              ) : lines.map((l, i) => (
                <tr key={i} className="break-inside-avoid">
                  <td className="px-4 py-2 text-slate-600">{fmtDate(l.date)}</td>
                  <td className="px-4 py-2 font-medium text-navy">{l.instructorName}</td>
                  <td className="px-4 py-2 text-slate-600">{l.courseName}</td>
                  <td className="px-4 py-2 text-slate-600" title={l.clocked ? "From clock-in" : "Scheduled"}>{l.start ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600" title={l.clocked ? "From clock-out" : "Scheduled"}>{l.finish ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{l.breakMinutes ? `${l.breakMinutes} min` : "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{hrs(l.payableMinutes)}</td>
                  <td className="px-4 py-2 text-slate-600">{money(l.rate)}</td>
                  <td className="px-4 py-2 text-slate-600">{money(l.pay)}</td>
                  <td className="px-4 py-2"><StatusPill tone={l.approved ? "covered" : "neutral"}>{l.approved ? "Yes" : "No"}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
