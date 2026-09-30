import { requireTenant } from "@/lib/tenant/require";
import { addDays, getSessionEvents, getWeekSchedule, weekStart } from "@/lib/services/schedule";
import { fitReason, listStaffWithFit } from "@/lib/services/staff";
import { getCourseAvailabilityStates } from "@/lib/services/availability";
import { Card } from "@/components/ui";
import { CoursePlanner } from "@/components/office/CoursePlanner";
import { CourseCard } from "@/components/office/CourseCard";
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

  // Connected booking systems — so "Check for updates" lives next to the calendar.
  const integrationRows = await repos.tenant.integration.list(ctx);
  const connectedIntegrations = integrationRows.map((r) => ({ id: r.id, provider: r.provider, name: providerName(r.provider), color: providerColor(r.provider) }));

  // Sessions per course (with ids), so the card can edit date/time inline.
  const allSessions = await repos.tenant.courseSession.list(ctx);
  const sessionsFullByCourse = new Map<string, { id: string; date: string; startMs: number; endMs: number }[]>();
  for (const s of allSessions) {
    const arr = sessionsFullByCourse.get(s.courseId) ?? [];
    arr.push({ id: s.id, date: s.date, startMs: s.startAt instanceof Date ? s.startAt.getTime() : Number(s.startAt), endMs: s.endAt instanceof Date ? s.endAt.getTime() : Number(s.endAt) });
    sessionsFullByCourse.set(s.courseId, arr);
  }
  for (const arr of sessionsFullByCourse.values()) arr.sort((a, b) => a.date.localeCompare(b.date) || a.startMs - b.startMs);

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

      <div className="space-y-2">
        {courses.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-400">No courses yet. Add one above to start rostering.</p>
          </Card>
        ) : (
          courses.map((c) => {
            const assigned = (assignedByCourse.get(c.courseId) ?? []).map((a) => ({
              id: a.id,
              instructorName: nameById.get(a.instructorId) ?? "Instructor",
              roleName: roleName.get(a.roleTypeId) ?? "role",
              isOverride: Boolean(a.isOverride),
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
              />
            );
          })
        )}
      </div>
    </div>
  );
}
