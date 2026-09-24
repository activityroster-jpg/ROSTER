import { requireTenant } from "@/lib/tenant/require";
import { getAttendanceBoard } from "@/lib/services/timeclock";
import { Card, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

const fmt = (ms: number | null) => (ms == null ? "—" : new Date(ms).toISOString().slice(11, 16));

export default async function TimeClockPage() {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const today = new Date().toISOString().slice(0, 10);
  const board = await getAttendanceBoard(repos, ctx, today);

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">Time clock</h1>
      <p className="mb-6 text-sm text-slate-500">Attendance for {today} — built from instructor clock-ins.</p>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm font-semibold text-navy">On the water now</p><p className="mt-1 text-3xl font-semibold text-starboard">{board.onWater}</p><p className="text-xs text-slate-500">Clocked in, not yet out</p></Card>
        <Card><p className="text-sm font-semibold text-navy">Started today</p><p className="mt-1 text-3xl font-semibold text-navy">{board.started}</p><p className="text-xs text-slate-500">Instructors clocked in</p></Card>
        <Card><p className="text-sm font-semibold text-navy">Hours logged today</p><p className="mt-1 text-3xl font-semibold text-navy">{(board.minutesToday / 60).toFixed(1)}</p><p className="text-xs text-slate-500">Actual, from clock times</p></Card>
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
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No one has clocked in today.</td>
              </tr>
            ) : (
              board.rows.map((r) => (
                <tr key={r.entryId}>
                  <td className="px-4 py-3 font-medium text-navy">{r.instructorName}</td>
                  <td className="px-4 py-3 text-slate-600">{r.courseName ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{fmt(r.clockInAt)}</td>
                  <td className="px-4 py-3 text-slate-600">{fmt(r.clockOutAt)}</td>
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
