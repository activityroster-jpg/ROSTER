import { requireTenant } from "@/lib/tenant/require";
import { getAttendanceBoard } from "@/lib/services/timeclock";
import { Card, StatusPill } from "@/components/ui";
import { fmtClockTime, todayIso } from "@/lib/domain";
import { addDays } from "@/lib/services/schedule";
import { GuideLink } from "@/components/GuideLink";

export const dynamic = "force-dynamic";

const fmt = (ms: number | null) => (ms == null ? "—" : fmtClockTime(ms));

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export default async function TimeClockPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { ctx, repos } = await requireTenant({ permission: "finance.view" });
  const sp = await searchParams;
  const today = todayIso();
  const day = typeof sp.date === "string" && ISO.test(sp.date) ? sp.date : today;
  const isToday = day === today;
  const board = await getAttendanceBoard(repos, ctx, day);
  const nav = "rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-navy hover:bg-slate-50";

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-navy">Time clock</h1>
        <GuideLink topic="time" />
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{isToday ? "Today, " : ""}{fmtDay(day)} — built from instructor clock-ins.</p>
        <div className="flex items-center gap-2">
          <a href={`/office/timeclock?date=${addDays(day, -1)}`} className={nav}>← Prev day</a>
          {!isToday ? <a href="/office/timeclock" className={nav}>Today</a> : null}
          <a href={`/office/timeclock?date=${addDays(day, 1)}`} className={`${nav} ${day >= today ? "pointer-events-none opacity-40" : ""}`} aria-disabled={day >= today}>Next day →</a>
          <form method="get" className="ml-1"><input type="date" name="date" defaultValue={day} max={today} aria-label="Pick a day" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" /><button type="submit" className="ml-1 rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white">Go</button></form>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {isToday ? <Card><p className="text-sm font-semibold text-navy">On the water now</p><p className="mt-1 text-3xl font-semibold text-starboard">{board.onWater}</p><p className="text-xs text-slate-500">Clocked in, not yet out</p></Card> : <Card><p className="text-sm font-semibold text-navy">Still clocked in</p><p className="mt-1 text-3xl font-semibold text-amber">{board.onWater}</p><p className="text-xs text-slate-500">Never clocked out that day</p></Card>}
        <Card><p className="text-sm font-semibold text-navy">{isToday ? "Started today" : "Clocked in"}</p><p className="mt-1 text-3xl font-semibold text-navy">{board.started}</p><p className="text-xs text-slate-500">Instructors clocked in</p></Card>
        <Card><p className="text-sm font-semibold text-navy">{isToday ? "Hours logged today" : "Hours logged"}</p><p className="mt-1 text-3xl font-semibold text-navy">{(board.minutesToday / 60).toFixed(1)}</p><p className="text-xs text-slate-500">Actual, from clock times</p></Card>
      </div>

      <Card className="p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Instructor</th>
              <th className="px-4 py-3">Session</th>
              <th className="px-4 py-3">Clock in</th>
              <th className="px-4 py-3">Clock out</th>
              <th className="px-4 py-3">Hours</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {board.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">{isToday ? "No one has clocked in today." : "No clock-ins on this day."}</td>
              </tr>
            ) : (
              board.rows.map((r) => (
                <tr key={r.entryId}>
                  <td className="px-4 py-3 font-medium text-navy">{r.instructorName}</td>
                  <td className="px-4 py-3 text-slate-600">{r.courseName ?? (r.note ? <span className="italic text-slate-500">{r.note}</span> : "—")}</td>
                  <td className="px-4 py-3 text-slate-600">{fmt(r.clockInAt)}{r.inLocation ? <a href={`https://www.openstreetmap.org/?mlat=${r.inLocation.lat}&mlon=${r.inLocation.lng}#map=16/${r.inLocation.lat}/${r.inLocation.lng}`} target="_blank" rel="noreferrer" className="ml-1 text-xs text-teal hover:underline" title={`Clocked in near here (±${r.inLocation.accuracyM ?? "?"} m)`}>📍</a> : null}</td>
                  <td className="px-4 py-3 text-slate-600">{fmt(r.clockOutAt)}{r.outLocation ? <a href={`https://www.openstreetmap.org/?mlat=${r.outLocation.lat}&mlon=${r.outLocation.lng}#map=16/${r.outLocation.lat}/${r.outLocation.lng}`} target="_blank" rel="noreferrer" className="ml-1 text-xs text-teal hover:underline" title={`Clocked out near here (±${r.outLocation.accuracyM ?? "?"} m)`}>📍</a> : null}</td>
                  <td className="px-4 py-3 font-medium text-navy">{(r.minutes / 60).toFixed(1)}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone={r.status === "on-water" ? "covered" : "neutral"}>
                      {r.status === "on-water" ? "On the water" : "Signed off"}
                    </StatusPill>
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
