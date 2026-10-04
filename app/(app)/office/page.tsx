import Link from "next/link";
import { isUnder18 } from "@/lib/domain/age";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/tenant/require";
import { ONBOARDED_COOKIE } from "@/lib/onboarding";
import { listStaffWithFit } from "@/lib/services/staff";
import { addDays, getSessionEvents, getWeekRota, getWeekSchedule, weekStart } from "@/lib/services/schedule";
import { getAttendanceBoard } from "@/lib/services/timeclock";
import { listLeave } from "@/lib/services/leave";
import { listOpenShifts } from "@/lib/services/openshifts";
import { getSetupStatus } from "@/lib/services/setup";
import { Card, StatusPill } from "@/components/ui";
import { WeekCalendarView } from "@/components/office/WeekCalendarView";
import { todayIso } from "@/lib/domain";
import { GuideLink } from "@/components/GuideLink";
import { confirmationSummary } from "@/lib/services/roster";

export const dynamic = "force-dynamic";

const SLOT_LABEL: Record<string, string> = { AM: "Morning", PM: "Afternoon", EV: "Evening" };

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

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
  const { ctx, repos, organisation } = await requireTenant({ permission: "office.view" });
  const monday = weekStart(new Date());
  const today = todayIso();

  const [staff, schedule, attendance, leave, shifts, setup, rota, events, settingsRows] = await Promise.all([
    listStaffWithFit(repos, ctx),
    getWeekSchedule(repos, ctx, monday),
    getAttendanceBoard(repos, ctx, today),
    listLeave(repos, ctx),
    listOpenShifts(repos, ctx, true),
    getSetupStatus(repos, ctx),
    getWeekRota(repos, ctx, monday),
    getSessionEvents(repos, ctx, addDays(monday, -7), addDays(monday, 7 * 12)),
    repos.tenant.orgSettings.list(ctx),
  ]);
  const { sessions, coverageByCourse } = schedule;
  const confirmations = await confirmationSummary(repos, ctx, today);
  const licenceOn = Boolean(settingsRows[0]?.enforceLicenceChecks);
  const ratioOn = Boolean(settingsRows[0]?.enforceRatioChecks);
  const clockOn = Boolean(settingsRows[0]?.timeclockEnabled);

  // Brand-new centre with no staff yet → guide them through onboarding first,
  // unless they've chosen to skip it (cookie).
  const hasStaff = setup.steps.find((s) => s.label === "Add your staff")?.done ?? false;
  const dismissed = (await cookies()).get(ONBOARDED_COOKIE)?.value === "1";
  if (!hasStaff && !dismissed) redirect("/office/onboarding");

  const blocked = staff.filter((s) => !s.fit.fit).length;
  const expiring = staff.filter((s) => s.fit.warnings.length > 0).length;
  const uncovered = [...coverageByCourse.values()].filter((c) => !c.ratio.ok).length;
  const pendingLeave = leave.filter((l) => l.status === "pending").length;
  const openShifts = shifts.filter((s) => s.status === "open" || s.status === "offered").length;

  const weekSessions = sessions.length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">Dashboard</h1>
          <p className="text-sm text-slate-500">{organisation.name} · week of {monday}</p>
        </div>
        <GuideLink topic="dashboard" />
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
                  : "You chose full setup — work through these now to get everything ready."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-28 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-teal" style={{ width: `${setup.completePct}%` }} /></div>
                <span className="text-sm font-semibold text-navy">{setup.completePct}%</span>
              </div>
              <Link href="/office/onboarding" className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700">Guided setup</Link>
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

      {/* First course — once the team is in but nothing is on the calendar */}
      {hasStaff && events.length === 0 ? (
        <Card className="mb-6 border-teal/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-navy">Next: build your first week</h2>
              <p className="text-sm text-slate-600">Add a course, drop in its sessions, then put instructors on it. Publish the week and your team sees it in the app.</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/office/courses" className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">Add a course</Link>
              <Link href="/office/import" className="text-sm font-medium text-teal hover:underline">Import a spreadsheet</Link>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Today */}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Today</p>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {clockOn ? <Tile href="/office/timeclock" label="On the water now" value={attendance.onWater} sub="Clocked in" tone={attendance.onWater > 0 ? "starboard" : "navy"} /> : null}
        {clockOn ? <Tile href="/office/timeclock" label="Hours logged today" value={(attendance.minutesToday / 60).toFixed(1)} sub={`${attendance.started} started`} /> : null}
        <Tile href="/office/rota" label="Sessions this week" value={weekSessions} sub="View / print roster" tone="teal" />
        {!clockOn ? <Tile href="/office/staff" label="Instructors" value={staff.filter((s) => s.instructor.status === "active").length} sub="On the team" /> : null}
        {staff.some((s) => s.instructor.status === "active" && isUnder18(s.instructor.dateOfBirth)) ? <Tile href="/office/staff" label="Under 18 on the team" value={staff.filter((s) => s.instructor.status === "active" && isUnder18(s.instructor.dateOfBirth)).length} sub="Higher-privacy defaults apply" tone="teal" /> : null}
        {!clockOn ? <Tile href="/office/finance" label="Paid hours this month" value={"→"} sub="Review payroll" /> : null}
      </div>

      {/* Needs attention */}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Needs attention</p>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {licenceOn ? <Tile href="/office/staff" label="Not cleared to roster" value={blocked} sub="Missing or expired certs" tone={blocked > 0 ? "port" : "navy"} /> : null}
        <Tile href="/office/staff" label="Certs expiring" value={expiring} sub="Within lead time" tone={expiring > 0 ? "amber" : "navy"} />
        {ratioOn ? <Tile href="/office/courses" label="Courses to cover" value={uncovered} sub="Understaffed / no cover" tone={uncovered > 0 ? "amber" : "navy"} /> : null}
        <Tile href="/office/leave" label="Leave to approve" value={pendingLeave} sub="Pending requests" tone={pendingLeave > 0 ? "amber" : "navy"} />
        <Tile href="/office/leave" label="Open shifts" value={openShifts} sub="Need cover" tone={openShifts > 0 ? "amber" : "navy"} />
        <Tile href="/office/rota" label="Awaiting confirmation" value={confirmations.awaiting} sub={confirmations.declined ? `${confirmations.declined} can't make it` : "On published weeks"} tone={confirmations.declined > 0 ? "port" : confirmations.awaiting > 0 ? "amber" : "navy"} />
      </div>

      {/* Calendar — the visual heart of the week */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-navy">Calendar</h2>
        <Link href="/office/courses" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50">
          Plan courses →
        </Link>
      </div>
      <div className="mb-8">
        <WeekCalendarView events={events} addHref="/office/courses" />
      </div>

      {/* This week's rota */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-navy">This week&apos;s roster</h2>
        <Link href="/office/rota" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50">
          Full roster · print / PDF →
        </Link>
      </div>
      <Card className="p-0">
        {weekSessions === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400">No sessions scheduled this week. Add courses and roster staff in <Link href="/office/courses" className="text-teal hover:underline">Courses</Link>.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {rota.filter((d) => d.sessions.length > 0).map((day) => (
              <div key={day.date} className="px-4 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{day.label}</p>
                <ul className="space-y-1.5">
                  {day.sessions.map((s) => (
                    <li key={s.sessionId} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="w-28 flex-none font-medium text-navy">{SLOT_LABEL[s.slot] ?? s.slot} <span className="text-xs font-normal text-slate-400">{fmtTime(s.startAt)}</span></span>
                      <span className="flex-1 min-w-[10rem]">
                        <span className={`mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${s.audience === "youth" ? "bg-amber/15 text-amber" : s.audience === "adult" ? "bg-teal/15 text-teal" : "bg-slate-100 text-slate-500"}`}>{s.audience === "youth" ? "Youth" : s.audience === "adult" ? "Adult" : "All"}</span>
                        <span className="font-medium text-navy">{s.courseName}</span>
                        {s.locations.length ? <span className="text-xs text-slate-400"> · {s.locations.join(", ")}</span> : null}
                      </span>
                      <span className="text-xs text-slate-500">
                        {s.staff.length ? s.staff.map((m) => (m.status === "confirmed" ? `${m.name} ✓` : m.status === "declined" ? `${m.name} ✕` : m.name)).join(", ") : <span className="font-semibold text-port">Unassigned</span>}
                      </span>
                      {!s.coverageOk ? <StatusPill tone="attention">Needs cover</StatusPill> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Coverage — only when the centre uses ratio & safety-cover checks */}
      {ratioOn ? (
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
      ) : null}
    </div>
  );
}
