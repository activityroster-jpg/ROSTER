import Link from "next/link";
import { requireTenant } from "@/lib/tenant/require";
import { listStaffWithFit } from "@/lib/services/staff";
import { getWeekSchedule, weekStart } from "@/lib/services/schedule";
import { getAttendanceBoard } from "@/lib/services/timeclock";
import { listLeave } from "@/lib/services/leave";
import { listOpenShifts } from "@/lib/services/openshifts";
import { getRevenueSummary } from "@/lib/services/bookings";
import { getSetupStatus } from "@/lib/services/setup";
import { Card, StatusPill } from "@/components/ui";
import type { SlotCode } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const SLOTS: SlotCode[] = ["AM", "PM", "EV"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}
const money = (n: number) => `£${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function Tile({ href, label, value, sub, tone = "navy" }: { href: string; label: string; value: string | number; sub: string; tone?: "navy" | "port" | "amber" | "starboard" | "teal" }) {
  const valTone = { navy: "text-navy", port: "text-port", amber: "text-amber", starboard: "text-starboard", teal: "text-teal" }[tone];
  return (
    <Link href={href} className="rounded-card border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal hover:shadow">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${valTone}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </Link>
  );
}

export default async function DashboardPage() {
  const { ctx, repos, organisation } = await requireTenant({ role: "admin" });
  const monday = weekStart(new Date());
  const today = new Date().toISOString().slice(0, 10);

  const [staff, schedule, attendance, leave, shifts, revenue, setup] = await Promise.all([
    listStaffWithFit(repos, ctx),
    getWeekSchedule(repos, ctx, monday),
    getAttendanceBoard(repos, ctx, today),
    listLeave(repos, ctx),
    listOpenShifts(repos, ctx, true),
    getRevenueSummary(repos, ctx),
    getSetupStatus(repos, ctx),
  ]);
  const { sessions, coverageByCourse } = schedule;

  const blocked = staff.filter((s) => !s.fit.fit).length;
  const expiring = staff.filter((s) => s.fit.warnings.length > 0).length;
  const uncovered = [...coverageByCourse.values()].filter((c) => !c.ratio.ok).length;
  const pendingLeave = leave.filter((l) => l.status === "pending").length;
  const openShifts = shifts.filter((s) => s.status === "open" || s.status === "offered").length;

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
        <p className="text-sm text-slate-500">{organisation.name} · week of {monday}</p>
      </div>

      {/* Getting started — shown until the checklist is complete */}
      {!setup.complete ? (
        <Card className="mb-6 border-teal/40 bg-teal/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-navy">Finish setting up your centre</h2>
              <p className="text-sm text-slate-600">
                {setup.setupMode === "basic"
                  ? "You're on the RYA defaults and can start rostering now — these steps unlock the rest."
                  : "Complete your full setup so everything's ready for the season."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-28 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-teal" style={{ width: `${setup.completePct}%` }} /></div>
              <span className="text-sm font-semibold text-navy">{setup.completePct}%</span>
            </div>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {setup.steps.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${s.done ? "border-slate-200 bg-white text-slate-500" : "border-teal/30 bg-white text-navy hover:border-teal"}`}>
                  <span className={`flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] text-white ${s.done ? "bg-starboard" : "bg-slate-300"}`}>{s.done ? "✓" : ""}</span>
                  <span className={s.done ? "line-through" : "font-medium"}>{s.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Today */}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Today</p>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Tile href="/office/timeclock" label="On the water now" value={attendance.onWater} sub="Clocked in" tone={attendance.onWater > 0 ? "starboard" : "navy"} />
        <Tile href="/office/timeclock" label="Hours logged today" value={(attendance.minutesToday / 60).toFixed(1)} sub={`${attendance.started} started`} />
        <Tile href="/office/bookings" label="Revenue earned" value={money(revenue.total)} sub={`${money(revenue.outstanding)} provisional`} tone="teal" />
      </div>

      {/* Needs attention */}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Needs attention</p>
      <div className="mb-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile href="/office/staff" label="Staff blocked" value={blocked} sub="Lapsed checks" tone={blocked > 0 ? "port" : "navy"} />
        <Tile href="/office/staff" label="Checks expiring" value={expiring} sub="Within lead time" tone={expiring > 0 ? "amber" : "navy"} />
        <Tile href="/office/courses" label="Courses to cover" value={uncovered} sub="Understaffed / no cover" tone={uncovered > 0 ? "amber" : "navy"} />
        <Tile href="/office/leave" label="Leave to approve" value={pendingLeave} sub="Pending requests" tone={pendingLeave > 0 ? "amber" : "navy"} />
        <Tile href="/office/leave" label="Open shifts" value={openShifts} sub="Need cover" tone={openShifts > 0 ? "amber" : "navy"} />
      </div>

      {/* Week grid */}
      <h2 className="mb-3 font-display text-lg font-semibold text-navy">This week</h2>
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
                      <div key={s.sessionId} className={`mb-1 rounded-md px-2 py-1 text-xs ${s.coverage.ok ? "bg-starboard/10 text-starboard" : "bg-port/10 text-port"}`}>
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

      {/* Coverage */}
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
                <p className="mt-1 text-xs text-slate-400">{c.ratio.ratioCountingStaff}/{c.ratio.requiredStaff} staff</p>
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
