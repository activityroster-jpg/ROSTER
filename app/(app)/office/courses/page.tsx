import { requireTenant } from "@/lib/tenant/require";
import { addDays, getSessionEvents, getWeekSchedule, weekStart } from "@/lib/services/schedule";
import { fitReason, listStaffWithFit } from "@/lib/services/staff";
import { getCourseAvailabilityStates } from "@/lib/services/availability";
import { Card } from "@/components/ui";
import { RestoreCourseTypes } from "@/components/office/RestoreCourseTypes";
import { CoursePlanner } from "@/components/office/CoursePlanner";
import { CourseCard } from "@/components/office/CourseCard";
import { roleNeedsByCourse } from "@/lib/services/course-editor";
import { parseDefaultSchedule } from "@/lib/domain";
import { BulkAssignForm } from "@/components/office/BulkAssignForm";
import { CourseUpdatesCheck } from "@/components/office/CourseUpdatesCheck";
import { providerName, providerColor } from "@/lib/integrations/catalogue";

export const dynamic = "force-dynamic";

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string }> }) {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  const sp = await searchParams;
  const view: "upcoming" | "past" = sp.view === "past" ? "past" : "upcoming";
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 80);
  const qLower = q.toLowerCase();
  const qs = (v: "upcoming" | "past") => `/office/courses?${v === "past" ? "view=past" : ""}${q ? `${v === "past" ? "&" : ""}q=${encodeURIComponent(q)}` : ""}`.replace(/\?$/, "");
  const monday = weekStart(new Date());
  const [{ coverageByCourse }, courseTypes, staff, roles, assignments, instructors, settings, events, locationRows, equipmentRows] = await Promise.all([
    getWeekSchedule(repos, ctx, monday),
    repos.tenant.courseType.list(ctx),
    listStaffWithFit(repos, ctx),
    repos.tenant.roleType.list(ctx),
    repos.tenant.courseStaff.list(ctx),
    repos.tenant.instructor.list(ctx),
    repos.tenant.orgSettings.list(ctx),
    getSessionEvents(repos, ctx, addDays(monday, -28), addDays(monday, 7 * 26)),
    repos.tenant.location.list(ctx),
    repos.tenant.equipment.list(ctx),
  ]);
  const plannerLocations = locationRows.filter((l) => l.active).map((l) => ({ id: l.id, name: l.name })).sort((a, b) => a.name.localeCompare(b.name));
  const plannerEquipment = equipmentRows.filter((e) => e.status === "available").map((e) => ({ id: e.id, name: e.identifier ? `${e.name} (${e.identifier})` : e.name })).sort((a, b) => a.name.localeCompare(b.name));
  const slotStyle = settings[0]?.slotStyle ?? "slots";
  const licenceOn = Boolean(settings[0]?.enforceLicenceChecks);
  const ratioOn = Boolean(settings[0]?.enforceRatioChecks);
  const conflictOn = Boolean(settings[0]?.enforceConflictChecks);
  const courses = [...coverageByCourse.values()];
  const activeTypes = courseTypes.filter((c) => c.active && c.listed).map((c) => ({ id: c.id, name: c.name, audience: c.audience, schedule: parseDefaultSchedule(c.defaultSchedule) }));
  const courseRows = await repos.tenant.course.list(ctx);
  const audienceByCourse = new Map(courseRows.map((c) => [c.id, courseTypes.find((t) => t.id === c.courseTypeId)?.audience ?? "all"]));
  const staffReqByCourse = new Map(courseRows.map((c) => [c.id, c.staffRequired ?? null]));
  const activeRoles = roles.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name }));
  const fitById = new Map(staff.map((s) => [s.instructor.id, s.fit]));
  const instructorOptions = instructors
    .filter((i) => i.status === "active")
    .map((i) => {
      const f = fitById.get(i.id);
      // Licence "fit" only annotates/gates the picker when the centre opted in.
      return { id: i.id, name: i.name, fit: licenceOn ? (f?.fit ?? true) : true, reason: licenceOn && f ? fitReason(f) : "" };
    });
  const nameById = new Map(instructors.map((i) => [i.id, i.name]));
  const roleName = new Map(roles.map((r) => [r.id, r.name]));

  const courseAvail = await getCourseAvailabilityStates(repos, ctx);
  const roleNeeds = roleNeedsByCourse(await repos.tenant.courseRoleRequirement.list(ctx), assignments, (id) => roleName.get(id) ?? "Role");

  // Connected booking systems — so "Check for updates" lives next to the calendar.
  const integrationRows = await repos.tenant.integration.list(ctx);
  const connectedIntegrations = integrationRows.map((r) => ({ id: r.id, provider: r.provider, name: providerName(r.provider), color: providerColor(r.provider) }));

  // Sessions per course (with ids), so the card can edit date/time inline.
  const allSessions = await repos.tenant.courseSession.list(ctx);
  const sessionsFullByCourse = new Map<string, { id: string; date: string; startMs: number; endMs: number }[]>();
  for (const s of allSessions) {
    if (s.cancelledAt) continue; // cancelled days are not planned work
    const arr = sessionsFullByCourse.get(s.courseId) ?? [];
    arr.push({ id: s.id, date: s.date, startMs: s.startAt instanceof Date ? s.startAt.getTime() : Number(s.startAt), endMs: s.endAt instanceof Date ? s.endAt.getTime() : Number(s.endAt) });
    sessionsFullByCourse.set(s.courseId, arr);
  }
  for (const arr of sessionsFullByCourse.values()) arr.sort((a, b) => a.date.localeCompare(b.date) || a.startMs - b.startMs);

  const assignedByCourse = new Map<string, typeof assignments>();
  for (const a of assignments) {
    assignedByCourse.set(a.courseId, [...(assignedByCourse.get(a.courseId) ?? []), a]);
  }

  // --- Chronological grouping: sort by first session, group by week, head each
  //     month/year; unscheduled courses sink to the end. -----------------------
  type Course = (typeof courses)[number];
  const earliest = (courseId: string) => sessionsFullByCourse.get(courseId)?.[0] ?? null; // sessions pre-sorted ascending
  const matchesQuery = (c: Course) => !qLower || `${c.courseName} ${c.courseTypeName}`.toLowerCase().includes(qLower);
  const sortedCourses = [...courses].filter(matchesQuery).sort((a, b) => (earliest(a.courseId)?.startMs ?? Infinity) - (earliest(b.courseId)?.startMs ?? Infinity));

  const monthLabelOf = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const weekRangeOf = (mondayIso: string) => {
    const sun = addDays(mondayIso, 6);
    const d = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    return `Week of ${d(mondayIso)} – ${d(sun)}`;
  };

  // Partition into upcoming vs past by the course's LAST session. Undated
  //  (no sessions yet) always sits under "upcoming" so it can be scheduled.
  const now = Date.now();
  const lastMsOf = (courseId: string) => {
    const ss = sessionsFullByCourse.get(courseId);
    return ss && ss.length ? Math.max(...ss.map((s) => s.endMs)) : null;
  };
  const undated: Course[] = sortedCourses.filter((c) => earliest(c.courseId) == null);
  const pastCourses = sortedCourses.filter((c) => { const l = lastMsOf(c.courseId); return l != null && l < now; });
  const upcomingCourses = sortedCourses.filter((c) => { const l = lastMsOf(c.courseId); return l != null && l >= now; });
  const upcomingCount = upcomingCourses.length + undated.length;

  // Group the active view by week. Past is shown newest-first.
  const activeList = view === "past" ? [...pastCourses].reverse() : upcomingCourses;
  interface WeekGroup { weekStart: string; weekLabel: string; monthKey: string; monthLabel: string; list: Course[] }
  const weekGroups: WeekGroup[] = [];
  for (const c of activeList) {
    const first = earliest(c.courseId)!;
    const wk = weekStart(new Date(`${first.date}T00:00:00Z`));
    let g = weekGroups.find((x) => x.weekStart === wk);
    if (!g) {
      const monthKey = wk.slice(0, 7);
      g = { weekStart: wk, weekLabel: weekRangeOf(wk), monthKey, monthLabel: monthLabelOf(monthKey), list: [] };
      weekGroups.push(g);
    }
    g.list.push(c);
  }
  // Roll weeks up into month sections for a clear month → week → courses layout.
  interface MonthSection { key: string; label: string; weeks: WeekGroup[]; count: number }
  const monthSections: MonthSection[] = [];
  for (const g of weekGroups) {
    let m = monthSections.find((x) => x.key === g.monthKey);
    if (!m) { m = { key: g.monthKey, label: g.monthLabel, weeks: [], count: 0 }; monthSections.push(m); }
    m.weeks.push(g);
    m.count += g.list.length;
  }
  const monthNav = monthSections.map((m) => ({ key: m.key, label: m.label }));

  const cardFor = (c: Course, shade = false) => {
    const assigned = (assignedByCourse.get(c.courseId) ?? []).map((a) => ({
      id: a.id,
      instructorName: nameById.get(a.instructorId) ?? "Instructor",
      roleName: roleName.get(a.roleTypeId) ?? "role",
      isOverride: Boolean(a.isOverride),
      status: a.status,
      declineNote: a.declineNote,
    }));
    return (
      <CourseCard
        key={c.courseId}
        course={{ id: c.courseId, name: c.courseName, courseTypeName: c.courseTypeName, status: c.status, staffRequired: staffReqByCourse.get(c.courseId) ?? null }}
        audience={audienceByCourse.get(c.courseId) ?? "all"}
        sessions={sessionsFullByCourse.get(c.courseId) ?? []}
        assigned={assigned}
        instructors={instructorOptions.map((o) => ({ ...o, avail: courseAvail.get(c.courseId)?.get(o.id) ?? "none" }))}
        roles={activeRoles}
        ratioOn={ratioOn}
        ratio={ratioOn ? { ok: c.ratio.ok, understaffed: c.ratio.understaffed, missingSafetyCover: c.ratio.missingSafetyCover } : undefined}
        computedRequired={c.ratio.requiredStaff}
        roleNeeds={roleNeeds.get(c.courseId)}
        shade={shade}
      />
    );
  };

  /** Render a week's courses grouped by day, alternating a light shade per day. */
  const renderWeekBody = (list: Course[]) => {
    const byDay: { date: string; items: Course[] }[] = [];
    for (const c of list) {
      const date = earliest(c.courseId)?.date ?? "";
      let d = byDay.find((x) => x.date === date);
      if (!d) { d = { date, items: [] }; byDay.push(d); }
      d.items.push(c);
    }
    return byDay.map((d, di) => (
      <div key={d.date} className="space-y-2">{d.items.map((c) => cardFor(c, di % 2 === 1))}</div>
    ));
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-navy">Courses</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{courses.length} scheduled</span>
          <a href="/office/integrations" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-slate-50">Integrations &amp; import →</a>
        </div>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        Add a course, then assign staff to it. Youth and adult courses are labelled so they never get mixed up.
        {(() => {
          const checks = [licenceOn && "instructor certs", ratioOn && "ratios & safety-boat cover", conflictOn && "double-bookings"].filter(Boolean);
          return checks.length
            ? ` We check ${checks.join(", ").replace(/, ([^,]*)$/, " and $1")} as you go — anything short is flagged.`
            : " Optional checks (certs, ratios, safety cover) can be switched on in Settings.";
        })()}
      </p>

      <CourseUpdatesCheck integrations={connectedIntegrations} />

      {activeTypes.length === 0 ? <RestoreCourseTypes /> : null}

      <CoursePlanner courseTypes={activeTypes} events={events} slotStyle={slotStyle} roles={activeRoles} locations={plannerLocations} equipment={plannerEquipment} />

      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-display text-lg font-semibold text-navy">Courses</h2>
        <div className="ml-2 flex rounded-lg border border-slate-200 p-0.5 text-sm">
          <a href={qs("upcoming")} className={`rounded-md px-3 py-1 font-medium ${view === "upcoming" ? "bg-navy text-white" : "text-slate-500 hover:text-navy"}`}>Upcoming ({upcomingCount})</a>
          <a href={qs("past")} className={`rounded-md px-3 py-1 font-medium ${view === "past" ? "bg-navy text-white" : "text-slate-500 hover:text-navy"}`}>Past ({pastCourses.length})</a>
        </div>
        <form method="get" className="ml-auto flex items-center gap-2">
          {view === "past" ? <input type="hidden" name="view" value="past" /> : null}
          <input name="q" defaultValue={q} placeholder="Search courses…" aria-label="Search courses" className="w-44 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-teal sm:w-56" />
          {q ? <a href={view === "past" ? "/office/courses?view=past" : "/office/courses"} className="text-sm text-slate-500 hover:text-navy">Clear</a> : null}
        </form>
      </div>

      {view === "upcoming" ? (
        <BulkAssignForm
          courses={upcomingCourses.map((c) => ({ id: c.courseId, name: c.courseName, audience: audienceByCourse.get(c.courseId) ?? "all", covered: ratioOn ? c.ratio.ok : true }))}
          instructors={instructorOptions}
          roles={activeRoles}
        />
      ) : null}

      <div className="scroll-smooth lg:grid lg:grid-cols-[1fr_11rem] lg:gap-6">
        <div className="space-y-8">
          {monthSections.length === 0 && (view === "past" || undated.length === 0) ? (
            <Card>
              <p className="text-sm text-slate-400">{view === "past" ? "No past courses yet." : "No upcoming courses. Add one above to start rostering."}</p>
            </Card>
          ) : (
            monthSections.map((m) => (
              <section key={m.key} id={`mo-${m.key}`} className="scroll-mt-4">
                {/* Month header */}
                <div className="mb-3 flex items-center gap-3 border-b-2 border-navy/10 pb-2">
                  <span className="h-6 w-1.5 flex-none rounded-full bg-teal" />
                  <h3 className="font-display text-xl font-bold text-navy">{m.label}</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{m.count} course{m.count === 1 ? "" : "s"}</span>
                </div>
                <div className="space-y-5">
                  {m.weeks.map((w) => (
                    <div key={w.weekStart} id={`wk-${w.weekStart}`} className="scroll-mt-4">
                      {/* Week sub-header — prominent band */}
                      <div className="mb-2 flex items-center justify-between rounded-lg bg-navy px-3 py-1.5">
                        <span className="font-display text-sm font-bold text-white">{w.weekLabel}</span>
                        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white">{w.list.length} course{w.list.length === 1 ? "" : "s"}</span>
                      </div>
                      {renderWeekBody(w.list)}
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}

          {view === "upcoming" && undated.length > 0 ? (
            <section id="mo-none" className="scroll-mt-4">
              <div className="mb-3 flex items-center gap-3 border-b-2 border-amber/20 pb-2">
                <span className="h-6 w-1.5 flex-none rounded-full bg-amber" />
                <h3 className="font-display text-xl font-bold text-navy">No date yet</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{undated.length}</span>
              </div>
              <div className="space-y-2">{undated.map((c) => cardFor(c))}</div>
            </section>
          ) : null}
        </div>

        {/* Jump-to nav */}
        {monthNav.length > 0 || (view === "upcoming" && undated.length > 0) ? (
          <nav className="mt-4 hidden self-start lg:sticky lg:top-4 lg:mt-0 lg:block">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Jump to</p>
            <ul className="space-y-1 text-sm">
              {monthNav.map((m) => (
                <li key={m.key}><a href={`#mo-${m.key}`} className="text-slate-600 hover:text-navy hover:underline">{m.label}</a></li>
              ))}
              {view === "upcoming" && undated.length > 0 ? (
                <li><a href="#mo-none" className="text-slate-600 hover:text-navy hover:underline">No date yet</a></li>
              ) : null}
            </ul>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
