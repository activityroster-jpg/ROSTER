import { requireTenant } from "@/lib/tenant/require";
import { getLabourReport } from "@/lib/services/reports";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const money = (n: number) => `£${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const hrs = (m: number) => (m / 60).toFixed(1);

function Bar({ label, value, max, sub, tone = "teal" }: { label: string; value: number; max: number; sub: string; tone?: "teal" | "navy" | "amber" }) {
  const pct = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  const bg = { teal: "bg-teal", navy: "bg-navy", amber: "bg-amber" }[tone];
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-xs"><span className="text-slate-600">{label}</span><span className="font-semibold text-navy">{sub}</span></div>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${bg}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default async function ReportsPage() {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const rep = await getLabourReport(repos, ctx);

  const maxMoney = Math.max(1, ...rep.byWeek.map((w) => Math.max(w.revenue, w.cost)));
  const maxInstr = Math.max(1, ...rep.byInstructor.map((i) => i.minutes));
  const maxBoat = Math.max(1, ...rep.boats.map((b) => b.bookings));

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">Reports</h1>
      <p className="mb-6 text-sm text-slate-500">Labour cost and utilisation, from your recorded hours.</p>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Card><p className="text-xs font-semibold text-navy">Revenue</p><p className="mt-1 text-2xl font-semibold text-navy">{money(rep.totalRevenue)}</p><p className="text-xs text-slate-400">{money(rep.outstandingRevenue)} provisional</p></Card>
        <Card><p className="text-xs font-semibold text-navy">Wage cost</p><p className="mt-1 text-2xl font-semibold text-amber">{money(rep.totalCost)}</p></Card>
        <Card><p className="text-xs font-semibold text-navy">Wage % of revenue</p><p className={`mt-1 text-2xl font-semibold ${rep.wagePctOfRevenue == null ? "text-slate-400" : rep.wagePctOfRevenue <= 55 ? "text-starboard" : "text-port"}`}>{rep.wagePctOfRevenue == null ? "—" : `${rep.wagePctOfRevenue}%`}</p></Card>
        <Card><p className="text-xs font-semibold text-navy">Actual hours</p><p className="mt-1 text-2xl font-semibold text-navy">{hrs(rep.totalActualMinutes)}</p><p className="text-xs text-slate-400">{hrs(rep.totalScheduledMinutes)} scheduled</p></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold text-navy">Revenue vs wage cost by week</h2>
          {rep.byWeek.length === 0 ? <p className="text-sm text-slate-400">No data yet.</p> : rep.byWeek.map((w) => (
            <div key={w.week} className="mb-3">
              <Bar label={`${w.week === "unscheduled" ? "Unscheduled" : `Week of ${w.week}`} · revenue`} value={w.revenue} max={maxMoney} sub={money(w.revenue)} tone="teal" />
              <Bar label="wage cost" value={w.cost} max={maxMoney} sub={money(w.cost)} tone="amber" />
            </div>
          ))}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold text-navy">Hours by instructor</h2>
          {rep.byInstructor.length === 0 ? <p className="text-sm text-slate-400">No hours recorded yet.</p> : rep.byInstructor.slice(0, 12).map((i) => (
            <Bar key={i.instructorId} label={i.name} value={i.minutes} max={maxInstr} sub={`${hrs(i.minutes)}h`} tone="navy" />
          ))}
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-semibold text-navy">Boat &amp; equipment bookings</h2>
          {rep.boats.length === 0 ? <p className="text-sm text-slate-400">No equipment bookings yet.</p> : rep.boats.slice(0, 12).map((b) => (
            <Bar key={b.name} label={b.name} value={b.bookings} max={maxBoat} sub={`${b.bookings}`} tone="amber" />
          ))}
        </Card>
      </div>
      <p className="mt-3 text-xs text-slate-400">Figures come straight from hours records and bookings. Export lives on the Payroll screen.</p>
    </div>
  );
}
