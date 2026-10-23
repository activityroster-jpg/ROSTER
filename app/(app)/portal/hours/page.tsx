import { eq } from "drizzle-orm";
import { requireTenant } from "@/lib/tenant/require";
import { instructor as instructorTable } from "@/lib/db/schema";
import { getInstructorHours } from "@/lib/services/finance";
import { Card, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

const hrs = (m: number) => (m / 60).toFixed(1);

export default async function PortalHoursPage() {
  const { ctx, repos } = await requireTenant();
  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];
  if (!me) {
    return <Card><p className="text-sm text-slate-600">Your instructor profile isn&apos;t linked yet.</p></Card>;
  }

  const { rows, totalMinutes, totalPay } = await getInstructorHours(repos, ctx, me.id);

  return (
    <div>
      <h1 className="mb-1 font-display text-xl font-semibold text-navy">My hours</h1>
      <p className="mb-4 text-sm text-slate-500">Your logged sessions, hours and estimated pay.</p>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Card><p className="text-sm text-slate-500">Total hours</p><p className="mt-1 text-2xl font-semibold text-navy">{hrs(totalMinutes)}</p></Card>
        <Card><p className="text-sm text-slate-500">Estimated pay</p><p className="mt-1 text-2xl font-semibold text-navy">£{totalPay.toFixed(2)}</p></Card>
      </div>

      {rows.length === 0 ? (
        <Card><p className="text-sm text-slate-500">No hours logged yet. Once you clock in to sessions, they&apos;ll appear here.</p></Card>
      ) : (
        <ul className="space-y-3">
          {(() => {
            // One block per day: the sessions, a subtotal, and the day's status once.
            const byDay = new Map<string, typeof rows>();
            for (const r of rows) { const k = r.date ?? "—"; byDay.set(k, [...(byDay.get(k) ?? []), r]); }
            return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([date, list]) => {
              const minutes = list.reduce((n, r) => n + r.minutes, 0);
              const pay = list.some((r) => r.pay != null) ? list.reduce((n, r) => n + (r.pay ?? 0), 0) : null;
              const approved = list.every((r) => r.approved);
              const label = date === "—" ? "No date" : new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
              return (
                <li key={date} className="rounded-card border border-slate-200 bg-white px-3 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-navy">{label}</span>
                    <span className="flex items-center gap-2 text-xs text-slate-500">{hrs(minutes)}h{pay != null ? ` · £${pay.toFixed(2)}` : ""}<StatusPill tone={approved ? "covered" : "neutral"}>{approved ? "Approved" : "Pending"}</StatusPill></span>
                  </div>
                  <ul className="mt-2 divide-y divide-slate-100">
                    {list.map((r, i) => (
                      <li key={i} className="flex items-center justify-between py-1.5 text-sm">
                        <span className="text-navy">{r.courseName}</span>
                        <span className="text-xs text-slate-400">{hrs(r.minutes)}h{r.actualMinutes != null && r.actualMinutes !== r.scheduledMinutes ? ` (was ${hrs(r.scheduledMinutes)}h scheduled)` : ""}{r.pay != null ? ` · £${r.pay.toFixed(2)}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            });
          })()}
        </ul>
      )}
      <p className="mt-3 text-center text-xs text-slate-400">Pay shown is an estimate from recorded hours × your rate. Your centre confirms final pay.</p>
    </div>
  );
}
