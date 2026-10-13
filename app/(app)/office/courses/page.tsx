import { coursePageScope } from "@/lib/services/course-list";
import { coverageForCourses } from "@/lib/services/schedule";
import { course as courseTable, courseRoleRequirement as courseRoleRequirementTable, courseSession as courseSessionTable, courseStaff as courseStaffTable } from "@/lib/db/schema";
import Link from "next/link";
import { requireTenant } from "@/lib/tenant/require";
import { packFor } from "@/lib/packs";
import { addDays, getSessionEvents, weekStart } from "@/lib/services/schedule";
import { fitReason, listStaffWithFit } from "@/lib/services/staff";
import { getCourseAvailabilityStates } from "@/lib/services/availability";
import { Card } from "@/components/ui";
import { RestoreCourseTypes } from "@/components/office/RestoreCourseTypes";
import { CoursePlanner } from "@/components/office/CoursePlanner";
import { CourseCard } from "@/components/office/CourseCard";
import { roleNeedsByCourse } from "@/lib/services/course-editor";
import { suggestRoles } from "@/lib/domain/staffing";
import type { SlotLine } from "@/lib/domain/role-slots";
import { elsewhereFor, indexSessions } from "@/lib/domain/clash-note";
import { parseDefaultSchedule } from "@/lib/domain";
import { BulkAssignForm } from "@/components/office/BulkAssignForm";
import { CourseUpdatesCheck } from "@/components/office/CourseUpdatesCheck";
import { providerName, providerColor } from "@/lib/integrations/catalogue";
import { fillsByInstructor, getTeachingContext, getTeachingMatrix, leadPlaceFor, pickerPlaces, relevantPlacesFor, staffingRolesOf } from "@/lib/services/teaching";
import { qualificationGap } from "@/lib/services/problems";

export const dynamic = "force-dynamic";

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; all?: string }> }) {
  const { ctx, repos, organisation } = await requireTenant({ permission: "roster.edit" });
  const sp = await searchParams;
  const view: "upcoming" | "past" = sp.view === "past" ? "past" : "upcoming";
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 80);
  const qLower = q.toLowerCase();
  const qs = (v: "upcoming" | "past") => `/office/courses?${v === "past" ? "view=past" : ""}${q ? `${v === "past" ? "&" : ""}q=${encodeURIComponent(q)}` : ""}`.replace(/\?$/, "");
  const monday = weekStart(new Date());
  // Only the courses in this view (upcoming, or the last 12 months of past), never the whole history.
  const scope = await coursePageScope(repos, ctx, { view, today: new Date().toISOString().slice(0, 10), pastMonths: sp.all === "1" ? null : 12 });
  const tc = await getTeachingContext(repos, ctx);
  const [coverageByCourse, courseTypes, staff, roles, assignments, instructors, settings, events, locationRows, equipmentRows, teaching] = await Promise.all([
    coverageForCourses(repos, ctx, scope.ids),
    repos.tenant.courseType.list(ctx),
    listStaffWithFit(repos, ctx),
    repos.tenant.roleType.list(ctx),
    repos.tenant.courseStaff.listIn(ctx, courseStaffTable.courseId, scope.ids),
    repos.tenant.instructor.list(ctx),
    repos.tenant.orgSettings.list(ctx),
    getSessionEvents(repos, ctx, addDays(monday, -28), addDays(monday, 7 * 26)),
    repos.tenant.location.list(ctx),
    repos.tenant.equipment.list(ctx),
    getTeachingMatrix(repos, ctx, tc),
  ]);
  const holdsAny = new Set([...tc.held].filter(([, types]) => types.size > 0).map(([instructorId]) => instructorId));
  const plannerLocations = locationRows.filter((l) => l.active).map((l) => ({ id: l.id, name: l.name })).sort((a, b) => a.name.localeCompare(b.name));
  const plannerEquipment = equipmentRows.filter((e) => e.status === "available").map((e) => ({ id: e.id, name: e.identifier ? `${e.name} (${e.identifier})` : e.name })).sort((a, b) => a.name.localeCompare(b.name));
  const slotStyle = settings[0]?.slotStyle ?? "slots";
  const licenceOn = Boolean(settings[0]?.enforceLicenceChecks);
  const ratioOn = Boolean(settings[0]?.enforceRatioChecks);
  const conflictOn = Boolean(settings[0]?.enforceConflictChecks);
  const courses = [...coverageByCourse.values()];
  const activeTypes = courseTypes.filter((c) => c.active && c.listed).map((c) => ({ id: c.id, name: c.name, audience: c.audience, schedule: parseDefaultSchedule(c.defaultSchedule) }));
  const courseRows = await repos.tenant.course.listIn(ctx, courseTable.id, scope.ids);
  const audienceByCourse = new Map(courseRows.map((c) => [c.id, courseTypes.find((t) => t.id === c.courseTypeId)?.audience ?? "all"]));
  const staffReqByCourse = new Map(courseRows.map((c) => [c.id, c.staffRequired ?? null]));
  const typeByCourse = new Map(courseRows.map((c) => [c.id, c.courseTypeId]));
  const qualifiedFor = (instructorId: string, courseId: string): boolean | null => { const g = qualificationGap(teaching.get(instructorId) ?? [], holdsAny.has(instructorId), typeByCourse.get(courseId) ?? ""); return g.known ? g.qualified : null; };
  const places = pickerPlaces(roles, tc);
  const typeCodes = new Map((await repos.tenant.qualificationType.list(ctx)).filter((q) => q.active).map((q) => [q.id, q.code]));
  const placeById = new Map(places.map((p) => [p.id, p]));
  const staffingRoles = staffingRolesOf(roles, tc);
  const fills = fillsByInstructor(tc, instructors.map((i) => i.id));
  const fitById = new Map(staff.map((s) => [s.instructor.id, s.fit]));
  const instructorOptions = instructors
    .filter((i) => i.status === "active")
    .map((i) => {
      const f = fitById.get(i.id);
      // Licence "fit" only annotates/gates the picker when the centre opted in.
      return { id: i.id, name: i.name, fit: licenceOn ? (f?.fit ?? true) : true, reason: licenceOn && f ? fitReason(f) : "", fills: tc.held.get(i.id)?.size ? fills.get(i.id) : undefined };
    });
  const nameById = new Map(instructors.map((i) => [i.id, i.name]));
  const roleName = new Map(roles.map((r) => [r.id, r.name]));

  const allSessions = await repos.tenant.courseSession.listIn(ctx, courseSessionTable.courseId, scope.ids);
  const courseAvail = await getCourseAvailabilityStates(repos, ctx, allSessions);
  // Who is on another course at the same time as each course (for the pickers' orange section).
  const liveScope = allSessions.filter((s) => !s.cancelledAt);
  const staffOfCourse = new Map<string, string[]>();
  for (const a of assignments) if (a.status !== "declined") staffOfCourse.set(a.courseId, [...(staffOfCourse.get(a.courseId) ?? []), a.instructorId]);
  const courseNameOf = new Map(courses.map((c) => [c.courseId, c.courseName]));
  // Indexed once: hundreds of courses × thousands of sessions must not cost a sort per card.
  const slotIndex = indexSessions(liveScope.map((s) => ({ courseId: s.courseId, courseName: courseNameOf.get(s.courseId) ?? "another course", date: s.date, slot: s.slot, instructorIds: staffOfCourse.get(s.courseId) ?? [] })));
  const sessionsOfCourse = new Map<string, { date: string; slot: string }[]>();
  for (const s of liveScope) sessionsOfCourse.set(s.courseId, [...(sessionsOfCourse.get(s.courseId) ?? []), { date: s.date, slot: s.slot }]);
  const busyFor = (courseId: string) => elsewhereFor(sessionsOfCourse.get(courseId) ?? [], slotIndex, courseId);
  // The required places on each card: the course's role lines, or what the ratio implies.
  const courseRowById = new Map(courseRows.map((c) => [c.id, c]));
  const slotLinesFor = (courseId: string): SlotLine[] => {
    const needs = roleNeeds.get(courseId);
    if (needs?.length) return needs.map((n) => ({ roleTypeId: n.roleTypeId, roleName: n.roleName, count: n.count, rank: placeById.get(n.roleTypeId)?.rank }));
    const row = courseRowById.get(courseId);
    if (!row || row.staffRequired === 0) return [];
    const ct = courseTypes.find((t) => t.id === row.courseTypeId);
    // The ratio's instructors go in the course's lead instructor type (Dinghy Instructor for Level 1…).
    return suggestRoles({ students: row.capacity, ratio: row.ratio, requiresSafetyBoat: Boolean(ct?.requiresSafetyBoat), roles: staffingRoles, leadRoleId: leadPlaceFor(tc, row.courseTypeId) }).map((l) => ({ roleTypeId: l.roleTypeId, roleName: roleName.get(l.roleTypeId) ?? "Role", count: l.count, rank: placeById.get(l.roleTypeId)?.rank }));
  };
  const roleNeeds = roleNeedsByCourse(await repos.tenant.courseRoleRequirement.listIn(ctx, courseRoleRequirementTable.courseId, scope.ids), assignments, (id) => roleName.get(id) ?? "Role");

  // Connected booking systems — so "Check for updates" lives next to the calendar.
  const integrationRows = await repos.tenant.integration.list(ctx);
  const connectedIntegrations = integrationRows.map((r) => ({ id: r.id, provider: r.provider, name: providerName(r.provider), color: providerColor(r.provider) }));

  // Sessions per course (with ids), so the card can edit date/time inline.
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
  const upcomingCount = scope.upcomingCount;

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
      instructorId: a.instructorId,
      roleTypeId: a.roleTypeId,
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
        instructors={(() => { const busy = busyFor(c.courseId); return instructorOptions.map((o) => ({ ...o, avail: courseAvail.get(c.courseId)?.get(o.id) ?? "none", qualified: qualifiedFor(o.id, c.courseId), busyWith: busy.get(o.id) })); })()}
        roles={places}
        relevant={relevantPlacesFor(tc, typeByCourse.get(c.courseId) ?? "")}
        ratioOn={ratioOn}
        ratio={ratioOn ? { ok: c.ratio.ok, understaffed: c.ratio.understaffed, missingSafetyCover: c.ratio.missingSafetyCover } : undefined}
        computedRequired={c.ratio.requiredStaff}
        roleNeeds={roleNeeds.get(c.courseId)}
        slotLines={slotLinesFor(c.courseId)}
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
        <h1 className="font-display text-2xl font-semibold text-navy">Courses <Link href="/office/course-setup" className="ml-2 align-middle text-sm font-medium text-teal hover:underline">Course setup →</Link></h1>
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

      {activeTypes.length === 0 ? <RestoreCourseTypes courseListName={packFor(organisation.activityType).wording.courseListName} /> : null}

      <CoursePlanner courseTypes={activeTypes} events={events} slotStyle={slotStyle} roles={places} relevantByType={Object.fromEntries(activeTypes.map((c) => [c.id, relevantPlacesFor(tc, c.id)]))} leadByType={Object.fromEntries(activeTypes.flatMap((c) => { const lead = leadPlaceFor(tc, c.id); return lead ? [[c.id, lead]] : []; }))} instructorTypes={[...tc.types.values()].filter((t) => t.discipline).sort((a, b) => a.rank - b.rank).map((t) => ({ id: t.id, name: t.name, code: typeCodes.get(t.id) ?? "", discipline: t.discipline, rank: t.rank }))} locations={plannerLocations} equipment={plannerEquipment} />

      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-display text-lg font-semibold text-navy">Courses</h2>
        <div className="ml-2 flex rounded-lg border border-slate-200 p-0.5 text-sm">
          <a href={qs("upcoming")} className={`rounded-md px-3 py-1 font-medium ${view === "upcoming" ? "bg-navy text-white" : "text-slate-500 hover:text-navy"}`}>Upcoming ({upcomingCount})</a>
          <a href={qs("past")} className={`rounded-md px-3 py-1 font-medium ${view === "past" ? "bg-navy text-white" : "text-slate-500 hover:text-navy"}`}>Past ({scope.pastCount})</a>
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
          roles={places}
        />
      ) : null}

      {view === "past" && (scope.olderHidden || sp.all === "1") ? (
        <p className="mb-3 text-xs text-slate-500">
          {sp.all === "1" ? <>Showing every past course. <a href={`/office/courses?view=past${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="text-teal hover:underline">Just the last 12 months</a></> : <>Showing courses from the last 12 months. <a href={`/office/courses?view=past&all=1${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="text-teal hover:underline">Show older courses too</a></>}
        </p>
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
