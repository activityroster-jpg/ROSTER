import { requireTenant } from "@/lib/tenant/require";
import { listStaffWithFit } from "@/lib/services/staff";
import { getWeekSchedule, weekStart } from "@/lib/services/schedule";
import { Card, StatusPill } from "@/components/ui";
import type { SlotCode } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const SLOTS: SlotCode[] = ["AM", "PM", "EV"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

export default async function DashboardPage() {
  const { ctx, repos, organisation } = await requireTenant({ role: "admin" });
  const monday = weekStart(new Date());
  const [staff, { sessions, coverageByCourse }] = await Promise.all([
    listStaffWithFit(repos, ctx),
    getWeekSchedule(repos, ctx, monday),
  ]);

  const blocked = staff.filter((s) => !s.fit.fit).length;
  const expiring = staff.filter((s) => s.fit.warnings.length > 0).length;
  const uncovered = [...coverageByCourse.values()].filter((c) => !c.ratio.ok).length;

  // Build the weekly grid: day (0-6) × slot → sessions.
  const days = DAY_LABELS.map((_, i) => {
    const d = new Date(`${monday}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const cell = (dateIso: string, slot: SlotCode) => sessions.filter((s) => s.date === dateIso && s.slot === slot);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-navy">Dashboard</h1>
        <p className="text-sm text-slate-500">
          {organisation.name} · week of {monday}
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Staff blocked</p>
          <p className="mt-1 text-3xl font-semibold text-navy">{blocked}</p>
          <p className="mt-1 text-xs text-slate-400">Lapsed mandatory checks</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Checks expiring soon</p>
          <p className="mt-1 text-3xl font-semibold text-navy">{expiring}</p>
          <p className="mt-1 text-xs text-slate-400">Within alert lead time</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Courses needing attention</p>
          <p className="mt-1 text-3xl font-semibold text-navy">{uncovered}</p>
          <p className="mt-1 text-xs text-slate-400">Under-staffed or missing safety cover</p>
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-16 px-2 py-2 text-left text-xs uppercase text-slate-400"></th>
              {days.map((d, i) => (
                <th key={d} className="px-2 py-2 text-left text-xs font-semibold text-slate-500">
                  {DAY_LABELS[i]} <span className="text-slate-400">{d.slice(8)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOTS.map((slot) => (
              <tr key={slot} className="align-top">
                <td className="px-2 py-2 text-xs font-semibold text-slate-400">{slot}</td>
                {days.map((d) => (
                  <td key={d + slot} className="min-w-[90px] border border-slate-100 px-1.5 py-1.5">
                    {cell(d, slot).map((s) => (
                      <div
                        key={s.sessionId}
                        className={`mb-1 rounded-md px-2 py-1 text-xs ${
                          s.coverage.ok ? "bg-starboard/10 text-starboard" : "bg-port/10 text-port"
                        }`}
                      >
                        <div className="font-medium">{s.courseName}</div>
                        <div className="opacity-80">{fmtTime(s.startAt)}</div>
                      </div>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="mt-6">
        <h2 className="mb-3 font-display text-lg font-semibold text-navy">Coverage</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[...coverageByCourse.values()].map((c) => (
            <Card key={c.courseId} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-navy">{c.courseName}</p>
                <p className="text-xs text-slate-500">{c.courseTypeName}</p>
              </div>
              <div className="text-right">
                {c.ratio.ok ? (
                  <StatusPill tone="covered">Covered</StatusPill>
                ) : c.ratio.missingSafetyCover ? (
                  <StatusPill tone="conflict">No safety cover</StatusPill>
                ) : (
                  <StatusPill tone="attention">Under-staffed</StatusPill>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  {c.ratio.ratioCountingStaff}/{c.ratio.requiredStaff} staff
                </p>
              </div>
            </Card>
          ))}
          {coverageByCourse.size === 0 ? (
            <p className="text-sm text-slate-400">No courses yet. Create one from Courses.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
