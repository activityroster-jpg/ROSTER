import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireTenant } from "@/lib/tenant/require";
import { fitReason, listStaffWithFit } from "@/lib/services/staff";
import { getCourseAvailabilityStates } from "@/lib/services/availability";
import { courseSession as courseSessionTable, courseStaff as courseStaffTable } from "@/lib/db/schema";
import { Card, StatusPill } from "@/components/ui";
import { CourseManage } from "@/components/office/CourseManage";
import { SessionManager, type SessionRow } from "@/components/office/SessionManager";
import { canDeleteCourse } from "@/lib/services/cancel";
import { AssignStaffForm } from "@/components/office/AssignStaffForm";
import { RemoveStaffButton } from "@/components/office/RemoveStaffButton";
import { StaffingPanel } from "@/components/office/StaffingPanel";
import { CourseResources } from "@/components/office/CourseResources";
import { equipmentContextForCourse, getCourseResources, staffingViewFrom } from "@/lib/services/course-resources";
import { suggestedKit } from "@/lib/services/kit";
import { hasFeature } from "@/lib/features";
import { getTeachingMatrix } from "@/lib/services/teaching";
import { qualificationGap } from "@/lib/services/problems";
import { staffBySession } from "@/lib/services/session-staff";

export const dynamic = "force-dynamic";

const fmtTime = (v: Date | number) => new Date(v instanceof Date ? v.getTime() : Number(v)).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const AUD: Record<string, { label: string; cls: string }> = {
  youth: { label: "Youth", cls: "bg-amber/15 text-amber" },
  adult: { label: "Adult", cls: "bg-teal/15 text-teal" },
  all: { label: "All ages", cls: "bg-slate-100 text-slate-500" },
};

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });

  const course = await repos.tenant.course.findById(ctx, id);
  if (!course) notFound();

  const [courseTypes, sessions, assignments, roles, instructors, staffFit, settings, requirements, locations, units, equipmentTypes, resources, teaching, quals] = await Promise.all([
    repos.tenant.courseType.list(ctx),
    repos.tenant.courseSession.list(ctx, eq(courseSessionTable.courseId, id)),
    repos.tenant.courseStaff.list(ctx, eq(courseStaffTable.courseId, id)),
    repos.tenant.roleType.list(ctx),
    repos.tenant.instructor.list(ctx),
    listStaffWithFit(repos, ctx),
    repos.tenant.orgSettings.list(ctx),
    repos.tenant.courseRoleRequirement.list(ctx),
    repos.tenant.location.list(ctx),
    repos.tenant.equipment.list(ctx),
    repos.tenant.equipmentType.list(ctx),
    getCourseResources(repos, ctx, id),
    getTeachingMatrix(repos, ctx),
    repos.tenant.qualification.list(ctx),
  ]);

  const ct = courseTypes.find((c) => c.id === course.courseTypeId);
  const staffing = staffingViewFrom(course, ct, roles, requirements.filter((r) => r.courseId === id), assignments);
  const membersBySession = await staffBySession(repos, ctx, sessions, assignments);
  const roleNameOf = (rid: string) => roles.find((r) => r.id === rid)?.name ?? "Role";
  // Declared before the per-day loop below uses it: declaring it later threw
  // "Cannot access 'nameById' before initialization" on any course with sessions.
  const nameById = new Map(instructors.map((i) => [i.id, i.name]));
  const dayStaffBySession: Record<string, { members: { instructorId: string; name: string; role: string; roleTypeId: string; status: string; source: "course" | "day" }[]; skipped: { instructorId: string; name: string }[] }> = {};
  for (const s of sessions) {
    const members = membersBySession.get(s.id) ?? [];
    const present = new Set(members.map((m) => m.instructorId));
    dayStaffBySession[s.id] = {
      members: members.map((m) => ({ instructorId: m.instructorId, name: nameById.get(m.instructorId) ?? "Instructor", role: roleNameOf(m.roleTypeId), roleTypeId: m.roleTypeId, status: m.status, source: m.source })),
      skipped: assignments.filter((a) => a.status !== "declined" && !present.has(a.instructorId)).map((a) => ({ instructorId: a.instructorId, name: nameById.get(a.instructorId) ?? "Instructor" })),
    };
  }
  const equipmentOn = hasFeature(settings[0]?.enabledFeatures, "equipment");
  const [equipmentContext, kitSuggestion] = equipmentOn
    ? await Promise.all([equipmentContextForCourse(repos, ctx, course.id), suggestedKit(repos, ctx, course.courseTypeId, course.capacity)])
    : [{ unitBusy: {}, typeOthers: {} }, []];
  const holdsAny = new Set(quals.map((q) => q.instructorId));
  const slotStyle = (settings[0]?.slotStyle ?? "slots") as "slots" | "times";
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  const licenceOn = Boolean(settings[0]?.enforceLicenceChecks);
  const fitObjById = new Map(staffFit.map((s) => [s.instructor.id, s.fit]));
  const availForCourse = (await getCourseAvailabilityStates(repos, ctx)).get(id);
  const instructorOptions = instructors.filter((i) => i.status === "active").map((i) => {
    const f = fitObjById.get(i.id);
    const gap = qualificationGap(teaching.get(i.id) ?? [], holdsAny.has(i.id), course.courseTypeId);
    return { id: i.id, name: i.name, fit: licenceOn ? (f?.fit ?? true) : true, reason: licenceOn && f ? fitReason(f) : "", avail: availForCourse?.get(i.id) ?? "none" as const, qualified: gap.known ? gap.qualified : null };
  });
  const activeRoles = roles.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name }));
  const aud = AUD[ct?.audience ?? "all"]!;

  const sessionRows: SessionRow[] = [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({ id: s.id, date: s.date, slot: s.slot, start: fmtTime(s.startAt), end: fmtTime(s.endAt), cancelled: Boolean(s.cancelledAt), cancelReason: s.cancelReason }));
  const liveCount = sessions.filter((s) => !s.cancelledAt).length;
  const staffCount = assignments.filter((a) => a.status !== "declined").length;
  const deletable = await canDeleteCourse(repos, ctx, id);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/office/courses" className="text-sm text-slate-400 hover:text-navy">← All courses</Link>
      <div className="mb-6 mt-1 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-2xl font-bold text-navy">{course.name ?? ct?.name ?? "Course"}</h1>
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${aud.cls}`}>{aud.label}</span>
        <StatusPill tone={course.status === "cancelled" ? "conflict" : course.status === "completed" ? "neutral" : "covered"}>{course.status}</StatusPill>
      </div>
      <p className="mb-6 -mt-4 text-sm text-slate-500">{ct?.name}{ct?.scheme ? ` · ${ct.scheme}` : ""}</p>

      <Card className="mb-6"><h2 className="mb-3 font-semibold text-navy">Manage</h2><CourseManage id={course.id} name={course.name ?? ct?.name ?? ""} status={course.status} liveSessions={liveCount} staffCount={staffCount} canDelete={deletable.ok} deleteBlockedBecause={deletable.ok ? null : deletable.reason} cancelReason={course.cancelReason} /></Card>

      <Card className="mb-6">
        <h2 className="mb-1 font-semibold text-navy">Staffing</h2>
        <p className="mb-3 text-xs text-slate-500">Students booked, what the RYA ratio implies, and the roles you want filled. The number of staff needed follows from the roles.</p>
        <StaffingPanel courseId={course.id} staffing={staffing} />
      </Card>

      <Card className="mb-6">
        <h2 className="mb-1 font-semibold text-navy">Where &amp; what</h2>
        <p className="mb-3 text-xs text-slate-500">Locations and equipment can be changed any time; clashes and units in maintenance show on the problems list.</p>
        <CourseResources
          courseId={course.id}
          locations={locations.map((l) => ({ id: l.id, name: l.name, active: Boolean(l.active) })).sort((a, b) => a.name.localeCompare(b.name))}
          units={units.map((u) => ({ id: u.id, name: u.identifier ? `${u.name} (${u.identifier})` : u.name, typeId: u.equipmentTypeId, status: u.status })).sort((a, b) => a.name.localeCompare(b.name))}
          types={equipmentTypes.map((t) => ({ id: t.id, name: t.name, quantity: t.quantity ?? null, inventoryTracked: Boolean(t.inventoryTracked), active: Boolean(t.active) })).sort((a, b) => a.name.localeCompare(b.name))}
          initial={resources}
          showEquipment={equipmentOn}
          context={equipmentContext}
          suggestedKit={kitSuggestion}
          version={course.updatedAt.getTime()}
        />
      </Card>

      <Card className="mb-6">
        <h2 className="mb-1 font-semibold text-navy">Sessions</h2>
        <p className="mb-3 text-xs text-slate-500">Add every date this course runs — a 5-day camp has five sessions, a weekly club has one per week.</p>
        <SessionManager courseId={course.id} slotStyle={slotStyle} sessions={sessionRows} staffCount={staffCount} dayStaff={dayStaffBySession} instructorOptions={instructors.filter((i) => i.status === "active").map((i) => ({ id: i.id, name: i.name })).sort((a, b) => a.name.localeCompare(b.name))} roleOptions={activeRoles} />
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-navy">Instructors</h2>
        {assignments.length > 0 ? (
          <ul className="mb-3 flex flex-wrap gap-2">
            {assignments.map((a) => (
              <li key={a.id} className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                {nameById.get(a.instructorId) ?? "Instructor"} · {roleName.get(a.roleTypeId) ?? "role"}
                {a.isOverride ? <span className="text-amber">(override)</span> : null}
                <RemoveStaffButton courseId={course.id} assignmentId={a.id} />
              </li>
            ))}
          </ul>
        ) : <p className="mb-3 text-xs text-slate-400">No instructors assigned yet.</p>}
        <AssignStaffForm courseId={course.id} instructors={instructorOptions} roles={activeRoles} />
      </Card>
    </div>
  );
}
