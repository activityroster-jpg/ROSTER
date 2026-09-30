import { requireTenant } from "@/lib/tenant/require";
import { addDays, getSessionEvents, getWeekSchedule, weekStart } from "@/lib/services/schedule";
import { fitReason, listStaffWithFit } from "@/lib/services/staff";
import { getCourseAvailabilityStates } from "@/lib/services/availability";
import { Card, StatusPill } from "@/components/ui";
import { CoursePlanner } from "@/components/office/CoursePlanner";
import { AssignStaffForm } from "@/components/office/AssignStaffForm";
import { BulkAssignForm } from "@/components/office/BulkAssignForm";
import { CourseUpdatesCheck } from "@/components/office/CourseUpdatesCheck";
import { providerName, providerColor } from "@/lib/integrations/catalogue";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const monday = weekStart(new Date());
  const [{ coverageByCourse }, courseTypes, staff, roles, assignments, instructors, settings, events] = await Promise.all([
    getWeekSchedule(repos, ctx, monday),
    repos.tenant.courseType.list(ctx),
    listStaffWithFit(repos, ctx),
    repos.tenant.roleType.list(ctx),
    repos.tenant.courseStaff.list(ctx),
    repos.tenant.instructor.list(ctx),
    repos.tenant.orgSettings.list(ctx),
    getSessionEvents(repos, ctx, addDays(monday, -28), addDays(monday, 7 * 26)),
  ]);
  const slotStyle = settings[0]?.slotStyle ?? "slots";
  const licenceOn = Boolean(settings[0]?.enforceLicenceChecks);
  const ratioOn = Boolean(settings[0]?.enforceRatioChecks);
  const conflictOn = Boolean(settings[0]?.enforceConflictChecks);
  const courses = [...coverageByCourse.values()];
  const activeTypes = courseTypes.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name, audience: c.audience }));
  const audienceByCourse = new Map(
    (await repos.tenant.course.list(ctx)).map((c) => [c.id, courseTypes.find((t) => t.id === c.courseTypeId)?.audience ?? "all"]),
  );
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

  // Connected booking systems — so "Check for updates" lives next to the calendar.
  const integrationRows = await repos.tenant.integration.list(ctx);
  const connectedIntegrations = integrationRows.map((r) => ({ id: r.id, provider: r.provider, name: providerName(r.provider), color: providerColor(r.provider) }));

  // Session date/time summary per course, for the cards.
  const allSessions = await repos.tenant.courseSession.list(ctx);
  const sessionsByCourse = new Map<string, { date: string; startAt: number; endAt: number }[]>();
  for (const s of allSessions) {
    const arr = sessionsByCourse.get(s.courseId) ?? [];
    arr.push({ date: s.date, startAt: s.startAt instanceof Date ? s.startAt.getTime() : Number(s.startAt), endAt: s.endAt instanceof Date ? s.endAt.getTime() : Number(s.endAt) });
    sessionsByCourse.set(s.courseId, arr);
  }
  const fmtD = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const fmtT = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  const courseWhen = (courseId: string): string => {
    const ss = (sessionsByCourse.get(courseId) ?? []).sort((a, b) => a.date.localeCompare(b.date) || a.startAt - b.startAt);
    if (ss.length === 0) return "No sessions scheduled yet";
    const first = ss[0]!;
    const label = `${fmtD(first.date)}, ${fmtT(first.startAt)}–${fmtT(first.endAt)}`;
    return ss.length > 1 ? `${ss.length} sessions · first ${label}` : label;
  };

  const assignedByCourse = new Map<string, typeof assignments>();
  for (const a of assignments) {
    assignedByCourse.set(a.courseId, [...(assignedByCourse.get(a.courseId) ?? []), a]);
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-navy">Courses</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{courses.length} scheduled</span>
          <a href="/office/integrations" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-slate-50">Connect a booking system</a>
          <a href="/office/import" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-slate-50">Import from spreadsheet / calendar</a>
        </div>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        Add a course, then assign staff to it. Youth and adult courses are labelled so they never get mixed up.
        {(() => {
          const checks = [licenceOn && "instructor qualifications", ratioOn && "ratios & safety-boat cover", conflictOn && "double-bookings"].filter(Boolean);
          return checks.length
            ? ` We check ${checks.join(", ").replace(/, ([^,]*)$/, " and $1")} as you go — anything short is flagged.`
            : " Optional compliance checks (qualifications, ratios, safety cover) can be switched on in Settings.";
        })()}
      </p>

      <CourseUpdatesCheck integrations={connectedIntegrations} />

      <CoursePlanner courseTypes={activeTypes} events={events} slotStyle={slotStyle} />

      <h2 className="mb-3 font-display text-lg font-semibold text-navy">Scheduled courses</h2>

      <BulkAssignForm
        courses={courses.map((c) => ({ id: c.courseId, name: c.courseName, audience: audienceByCourse.get(c.courseId) ?? "all", covered: ratioOn ? c.ratio.ok : true }))}
        instructors={instructorOptions}
        roles={activeRoles}
      />

      <div className="space-y-4">
        {courses.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-400">No courses yet. Add one above to start rostering.</p>
          </Card>
        ) : (
          courses.map((c) => {
            const assigned = assignedByCourse.get(c.courseId) ?? [];
            return (
              <Card key={c.courseId}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="flex items-center gap-2 font-medium text-navy">
                      {(() => { const a = audienceByCourse.get(c.courseId) ?? "all"; return (
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${a === "youth" ? "bg-amber/15 text-amber" : a === "adult" ? "bg-teal/15 text-teal" : "bg-slate-100 text-slate-500"}`}>{a === "youth" ? "Youth" : a === "adult" ? "Adult" : "All"}</span>
                      ); })()}
                      <a href={`/office/courses/${c.courseId}`} className="hover:text-teal hover:underline">{c.courseName}</a>
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-navy">📅 {courseWhen(c.courseId)}</p>
                    <p className="text-xs text-slate-500">
                      {c.courseTypeName} · <span className="capitalize">{c.status}</span> ·{" "}
                      {ratioOn ? <>{c.ratio.ratioCountingStaff}/{c.ratio.requiredStaff} staff · </> : null}
                      <a href={`/office/courses/${c.courseId}`} className="text-teal hover:underline">manage →</a>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {ratioOn ? (
                      <>
                        {c.ratio.understaffed ? <StatusPill tone="attention">Under-staffed</StatusPill> : null}
                        {c.ratio.missingSafetyCover ? <StatusPill tone="conflict">No safety cover</StatusPill> : null}
                        {c.ratio.ok ? <StatusPill tone="covered">Covered</StatusPill> : null}
                      </>
                    ) : null}
                  </div>
                </div>

                {assigned.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {assigned.map((a) => (
                      <li key={a.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                        {nameById.get(a.instructorId) ?? "Instructor"} · {roleName.get(a.roleTypeId) ?? "role"}
                        {a.isOverride ? <span className="ml-1 text-amber">(override)</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-slate-400">No staff assigned yet.</p>
                )}

                <AssignStaffForm courseId={c.courseId} instructors={instructorOptions.map((o) => ({ ...o, avail: courseAvail.get(c.courseId)?.get(o.id) ?? "none" }))} roles={activeRoles} />
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
