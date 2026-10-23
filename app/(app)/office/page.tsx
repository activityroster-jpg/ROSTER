import { coursePageScope } from "@/lib/services/course-list";
import { coverageForCourses } from "@/lib/services/schedule";
import { can, FEATURE_LABEL, featureForPermission, ownerName } from "@/lib/auth/rbac";
import { listOfficeMembers } from "@/lib/services/office-access";
import Link from "next/link";
import { isUnder18 } from "@/lib/domain/age";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/tenant/require";
import { postingAccess, showHiringCard } from "@/lib/domain/jobs";
import { HiringSeasonCard } from "@/components/office/RecruitBoard";
import { ONBOARDED_COOKIE } from "@/lib/onboarding";
import { listStaffWithFit } from "@/lib/services/staff";
import { addDays, getSessionEvents, getWeekRota, getWeekSchedule, weekStart } from "@/lib/services/schedule";
import { getAttendanceBoard } from "@/lib/services/timeclock";
import { listLeave } from "@/lib/services/leave";
import { listOpenShifts } from "@/lib/services/openshifts";
import { getSetupStatus } from "@/lib/services/setup";
import { exampleWeekState } from "@/lib/services/example-week";
import { ExampleWeekNotice, LoadExampleWeekButton } from "@/components/office/ExampleWeek";
import { Card, StatusPill } from "@/components/ui";
import { WeekCalendarView } from "@/components/office/WeekCalendarView";
import { todayIso } from "@/lib/domain";
import { GuideLink } from "@/components/GuideLink";
import { confirmationSummary } from "@/lib/services/roster";
import { findProblems, problemLabel } from "@/lib/services/problems";
import { summariseToday } from "@/lib/domain/today";
import { Collapsible } from "@/components/office/Collapsible";

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

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { ctx, repos, organisation, trial } = await requireTenant({ permission: "office.view" });
  const deniedFeature = featureForPermission(String((await searchParams).denied ?? ""));
  const deniedOwner = deniedFeature ? ownerName(await listOfficeMembers(repos, ctx)) : null;
  const monday = weekStart(new Date());
  const today = todayIso();

  const [staff, schedule, attendance, leave, shifts, setup, rota, events, settingsRows, example] = await Promise.all([
    listStaffWithFit(repos, ctx),
    getWeekSchedule(repos, ctx, monday),
    getAttendanceBoard(repos, ctx, today),
    listLeave(repos, ctx),
    listOpenShifts(repos, ctx, true),
    getSetupStatus(repos, ctx, organisation),
    getWeekRota(repos, ctx, monday),
    getSessionEvents(repos, ctx, addDays(monday, -7), addDays(monday, 7 * 12)),
    repos.tenant.orgSettings.list(ctx),
    exampleWeekState(repos, ctx),
  ]);
  const { sessions } = schedule;
  const [confirmations, problems] = await Promise.all([confirmationSummary(repos, ctx, today), findProblems(repos, ctx, { from: today, to: addDays(today, 28) })]);
  const licenceOn = Boolean(settingsRows[0]?.enforceLicenceChecks);
  const ratioOn = Boolean(settingsRows[0]?.enforceRatioChecks);
  const clockOn = Boolean(settingsRows[0]?.timeclockEnabled);

  // Brand-new centre with no staff yet → guide them through onboarding first,
  // unless they've chosen to skip it (cookie).
  const hasStaff = setup.hasStaff;
  // A first-week nudge: three days in and no day confirmed yet.
  const signedUpDaysAgo = organisation.createdAt ? (Date.now() - new Date(organisation.createdAt).getTime()) / 86_400_000 : 0;
  const nudge = !setup.firstDayConfirmed && signedUpDaysAgo >= 3;
  const dismissed = (await cookies()).get(ONBOARDED_COOKIE)?.value === "1";
  // An empty centre goes to the wizard, unless the example week is on the roster: then there is something to see.
  if (!hasStaff && !dismissed && !example.loaded) redirect("/office/onboarding");

  const blocked = staff.filter((s) => !s.fit.fit).length;
  const expiring = staff.filter((s) => s.fit.warnings.length > 0).length;
  // Upcoming courses short of cover (past courses no longer count).
  const uncovered = ratioOn ? [...(await coverageForCourses(repos, ctx, (await coursePageScope(repos, ctx, { view: "upcoming", today })).ids)).values()].filter((c) => !c.ratio.ok).length : 0;
  const pendingLeave = leave.filter((l) => l.status === "pending").length;
  const openShifts = shifts.filter((s) => s.status === "open" || s.status === "offered").length;

  const weekSessions = sessions.length;
  const todayDay = rota.find((d) => d.date === today);
  const todaySummary = summariseToday((todayDay?.sessions ?? []).map((s) => ({ sessionId: s.sessionId, courseName: s.courseName, startAt: s.startAt, endAt: s.endAt, coverageOk: s.coverageOk, staff: s.staff.map((m) => ({ instructorId: m.instructorId, name: m.name, status: m.status })) })));
  const problemsToday = problems.problems.filter((p) => p.date === today);
  // 1 Dec – 30 Apr: free job posts on Boaty Jobs, for those who can post them.
  const dismissedAt = settingsRows[0]?.recruitCardDismissedAt;
  const hiringCard = can(ctx, "staff.edit") && showHiringCard(new Date(), dismissedAt ? new Date(dismissedAt).getTime() : null)
    && postingAccess({ orgStatus: organisation.status, subscriptionStatus: organisation.subscriptionStatus ?? null, trialKind: trial.kind, readOnly: Boolean(ctx.readOnly) }).kind === "post";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">Dashboard</h1>
          <p className="text-sm text-slate-500">{organisation.name} · week of {new Date(`${monday}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}</p>
        </div>
        <GuideLink topic="dashboard" />
      </div>
      {deniedFeature ? (
        <p role="alert" className="mb-4 rounded-lg border border-amber/40 bg-amber/10 px-4 py-2 text-sm text-navy">
          You don&apos;t have <strong>{FEATURE_LABEL[deniedFeature].label}</strong> access, so that page didn&apos;t open. {deniedOwner ? `Ask ${deniedOwner} (superadmin) to tick it under Instructors → Office access.` : "Ask your centre's superadmin to tick it under Instructors → Office access."}
        </p>
      ) : null}

      {hiringCard ? <HiringSeasonCard /> : null}

      {/* First-week nudge: a few days in and nothing confirmed yet */}
      {nudge ? (
        <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-amber/50 bg-amber/10 px-4 py-3">
          <p className="text-sm text-navy"><span className="font-semibold">Your team hasn&apos;t had a roster yet.</span> Open the roster, press Auto-roster, fill any gaps, then confirm a day: everyone on it gets a message.</p>
          <Link href="/office/rota" className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700">Open the roster →</Link>
        </div>
      ) : null}

      {/* The example week is on the roster: say so on every visit, with the one click that clears it */}
      {example.loaded ? <ExampleWeekNotice instructors={example.instructors} sessions={example.sessions} from={example.from} to={example.to} week={example.from ? weekStart(new Date(`${example.from}T00:00:00Z`)) : null} /> : null}

      {/* Getting started — the route to a first confirmed roster, shown until the essentials are done */}
      <div id="getting-started" />
      {!setup.complete ? (
        <Card className="mb-6 border-teal/40 bg-teal/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-navy">Getting started</h2>
              <p className="text-sm text-slate-600">The quickest route to your first roster, in order. Setting up courses and team takes the longest; after that, rostering is quick.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-28 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-teal" style={{ width: `${setup.completePct}%` }} /></div>
                <span className="text-sm font-semibold text-navy">{setup.completePct}%</span>
              </div>
              <a href="/learn?topic=getting-started" target="_blank" rel="noreferrer" className="text-xs font-medium text-teal hover:underline">📖 Read the guide</a>
            </div>
          </div>
          {(() => { const nxt = setup.steps.find((x) => x.stage === "essential" && !x.done); return nxt ? (
            <Link href={nxt.href} className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-teal bg-teal/5 px-4 py-3 hover:bg-teal/10">
              <span><span className="text-xs font-semibold uppercase tracking-wide text-teal">Next</span><span className="block font-semibold text-navy">{nxt.label}</span>{nxt.hint ? <span className="block text-xs text-slate-500">{nxt.hint}</span> : null}</span>
              <span className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white">Do this now →</span>
            </Link>
          ) : null; })()}
          <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {setup.steps.filter((s) => s.stage === "essential").map((s, i) => {
              const next = !s.done && setup.steps.filter((x) => x.stage === "essential").findIndex((x) => !x.done) === i;
              return (
                <li key={s.key}>
                  <Link href={s.href} className={`flex h-full items-start gap-2 rounded-lg border px-3 py-2 text-sm transition ${s.done ? "border-slate-200 bg-white text-slate-500" : next ? "border-teal bg-white text-navy shadow-sm hover:border-teal-700" : "border-teal/30 bg-white text-navy hover:border-teal"}`}>
                    <span className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-bold ${s.done ? "bg-starboard text-white" : next ? "bg-teal text-white" : "bg-slate-200 text-slate-600"}`}>{s.done ? "✓" : i + 1}</span>
                    <span className="min-w-0">
                      <span className={s.done ? "line-through" : "font-medium"}>{s.label}</span>
                      {next ? <span className="ml-1.5 rounded-full bg-teal/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-teal">Next</span> : null}
                      {!s.done && s.hint ? <span className="block text-xs text-amber">{s.hint}</span> : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
          <p className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Later, once your first roster is out</p>
          <ul className="flex flex-wrap gap-2">
            {setup.steps.filter((s) => s.stage === "later").map((s) => (
              <li key={s.key}>
                <Link href={s.href} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${s.done ? "border-slate-200 bg-white text-slate-400 line-through" : "border-dashed border-slate-300 bg-white text-navy hover:border-teal"}`}>{s.done ? "✓ " : ""}{s.label}</Link>
              </li>
            ))}
          </ul>
          {!example.loaded && !setup.steps.find((s) => s.key === "courses")?.done ? (
            <p className="mt-4 flex flex-wrap items-center gap-2 border-t border-teal/20 pt-3 text-sm text-slate-600">
              Want to see a working roster before adding your own? <LoadExampleWeekButton className="font-semibold text-teal hover:underline disabled:opacity-60" /> <span className="text-xs text-slate-400">Six made-up instructors and a week of sessions; one click clears it.</span>
            </p>
          ) : null}
        </Card>
      ) : null}

      {/* Today strip: what matters at 08:00 on a sailing day */}
      <div className="mb-4 rounded-card border border-navy/15 bg-navy px-4 py-3 text-white">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="font-display text-lg font-semibold">Today · {new Date(`${today}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}</p>
          <p className="text-sm text-white/80">
            {todaySummary.sessions === 0 ? "Nothing on the water today." : <>{todaySummary.sessions} session{todaySummary.sessions === 1 ? "" : "s"}{todaySummary.firstStart != null && todaySummary.lastEnd != null ? ` from ${fmtTime(todaySummary.firstStart)} to ${fmtTime(todaySummary.lastEnd)}` : ""} · {todaySummary.people} {todaySummary.people === 1 ? "person" : "people"} on</>}
          </p>
        </div>
        {todaySummary.sessions > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Link href="/office/rota" className={`rounded-full px-2.5 py-1 font-semibold ${todaySummary.uncovered ? "bg-amber text-navy" : "bg-white/15 text-white"}`}>{todaySummary.uncovered ? `${todaySummary.uncovered} uncovered` : "All covered"}</Link>
            <Link href="/office/rota" className={`rounded-full px-2.5 py-1 font-semibold ${todaySummary.declined ? "bg-port text-white" : "bg-white/15 text-white"}`}>{todaySummary.declined ? `${todaySummary.declined} can't make it${todaySummary.declinedNames.length ? `: ${todaySummary.declinedNames.slice(0, 3).join(", ")}` : ""}` : "Nobody has dropped out"}</Link>
            {todaySummary.unconfirmed ? <Link href="/office/rota" className="rounded-full bg-white/15 px-2.5 py-1 font-semibold text-white">{todaySummary.unconfirmed} unconfirmed</Link> : null}
            {problemsToday.length ? <a href="#problems" className="rounded-full bg-port px-2.5 py-1 font-semibold text-white">{problemsToday.length} problem{problemsToday.length === 1 ? "" : "s"} today</a> : null}
            <Link href="/office/rota/emergency" className="rounded-full bg-white/15 px-2.5 py-1 font-semibold text-white hover:bg-white/25">Emergency sheet →</Link>
          </div>
        ) : null}
      </div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">At a glance</p>
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
        <Tile href="/office/rota" label="Awaiting replies" value={confirmations.awaiting} sub={confirmations.declined ? `${confirmations.declined} can't make it` : "On confirmed days"} tone={confirmations.declined > 0 ? "port" : confirmations.awaiting > 0 ? "amber" : "navy"} />
        <Tile href="#problems" label="Problems on the roster" value={problems.problems.length} sub={problems.blocks ? `${problems.blocks} blocking · next 4 weeks` : "Next 4 weeks"} tone={problems.blocks > 0 ? "port" : problems.warns > 0 ? "amber" : "navy"} />
      </div>

      {/* Problems: what contradicts a rule the centre has switched on, as the data stands now */}
      {problems.problems.length > 0 ? (
        <div id="problems" className="mb-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-navy">Problems to sort out</h2>
            <a href="/learn?topic=problems" target="_blank" rel="noreferrer" className="text-xs font-medium text-teal hover:underline">📖 Read the guide</a>
          </div>
          <Card className="p-0">
            <ul className="divide-y divide-slate-100">
              {problems.problems.slice(0, 10).map((p, i) => (
                <li key={`${p.kind}-${p.courseId}-${p.instructorId ?? ""}-${p.date}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.severity === "block" ? "bg-port/15 text-port" : "bg-amber/15 text-amber"}`}>{problemLabel(p.kind)}</span>
                  <span className="font-medium text-navy">{p.instructorName ? `${p.instructorName} · ` : ""}<Link href={`/office/courses/${p.courseId}`} className="hover:underline">{p.courseName}</Link></span>
                  <span className="text-xs text-slate-500">{p.date}{p.slot ? ` ${p.slot}` : ""} · {p.detail}</span>
                </li>
              ))}
            </ul>
            {problems.problems.length > 10 ? <p className="px-4 py-2 text-xs text-slate-400">{problems.problems.length - 10} more on the <Link href="/office/rota" className="text-teal hover:underline">roster</Link>, week by week.</p> : null}
          </Card>
        </div>
      ) : null}

      {/* Calendar: open at a desk, folded on a phone */}
      <div className="mb-8">
        <Collapsible title="Calendar">
          <div className="mb-2 flex justify-end"><Link href="/office/courses" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50">Plan courses →</Link></div>
          <WeekCalendarView events={events} addHref="/office/courses" today={today} />
        </Collapsible>
      </div>

      {/* This week's roster */}
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
                      {ratioOn ? (!s.coverageOk ? <StatusPill tone="attention">{s.missingSafetyCover ? "No safety cover" : "Needs cover"}</StatusPill> : <StatusPill tone="covered">Covered</StatusPill>) : !s.coverageOk ? <StatusPill tone="attention">Needs cover</StatusPill> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

    </div>
  );
}
