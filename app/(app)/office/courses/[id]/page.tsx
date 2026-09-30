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
import { AssignStaffForm } from "@/components/office/AssignStaffForm";
import { RemoveStaffButton } from "@/components/office/RemoveStaffButton";

export const dynamic = "force-dynamic";

const fmtTime = (v: Date | number) => new Date(v instanceof Date ? v.getTime() : Number(v)).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const AUD: Record<string, { label: string; cls: string }> = {
  youth: { label: "Youth", cls: "bg-amber/15 text-amber" },
  adult: { label: "Adult", cls: "bg-teal/15 text-teal" },
  all: { label: "All ages", cls: "bg-slate-100 text-slate-500" },
};

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, repos } = await requireTenant({ role: "admin" });

  const course = await repos.tenant.course.findById(ctx, id);
  if (!course) notFound();

  const [courseTypes, sessions, assignments, roles, instructors, staffFit, settings] = await Promise.all([
    repos.tenant.courseType.list(ctx),
    repos.tenant.courseSession.list(ctx, eq(courseSessionTable.courseId, id)),
    repos.tenant.courseStaff.list(ctx, eq(courseStaffTable.courseId, id)),
    repos.tenant.roleType.list(ctx),
    repos.tenant.instructor.list(ctx),
    listStaffWithFit(repos, ctx),
    repos.tenant.orgSettings.list(ctx),
  ]);

  const ct = courseTypes.find((c) => c.id === course.courseTypeId);
  const slotStyle = (settings[0]?.slotStyle ?? "slots") as "slots" | "times";
  const nameById = new Map(instructors.map((i) => [i.id, i.name]));
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  const licenceOn = Boolean(settings[0]?.enforceLicenceChecks);
  const fitObjById = new Map(staffFit.map((s) => [s.instructor.id, s.fit]));
  const availForCourse = (await getCourseAvailabilityStates(repos, ctx)).get(id);
  const instructorOptions = instructors.filter((i) => i.status === "active").map((i) => {
    const f = fitObjById.get(i.id);
    return { id: i.id, name: i.name, fit: licenceOn ? (f?.fit ?? true) : true, reason: licenceOn && f ? fitReason(f) : "", avail: availForCourse?.get(i.id) ?? "none" as const };
  });
  const activeRoles = roles.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name }));
  const aud = AUD[ct?.audience ?? "all"]!;

  const sessionRows: SessionRow[] = [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({ id: s.id, date: s.date, slot: s.slot, start: fmtTime(s.startAt), end: fmtTime(s.endAt) }));

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/office/courses" className="text-sm text-slate-400 hover:text-navy">← All courses</Link>
      <div className="mb-6 mt-1 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-2xl font-bold text-navy">{course.name ?? ct?.name ?? "Course"}</h1>
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${aud.cls}`}>{aud.label}</span>
        <StatusPill tone={course.status === "cancelled" ? "conflict" : course.status === "completed" ? "neutral" : "covered"}>{course.status}</StatusPill>
      </div>
      <p className="mb-6 -mt-4 text-sm text-slate-500">{ct?.name}{ct?.scheme ? ` · ${ct.scheme}` : ""}</p>

      <Card className="mb-6"><h2 className="mb-3 font-semibold text-navy">Manage</h2><CourseManage id={course.id} name={course.name ?? ct?.name ?? ""} status={course.status} /></Card>

      <Card className="mb-6">
        <h2 className="mb-1 font-semibold text-navy">Sessions</h2>
        <p className="mb-3 text-xs text-slate-500">Add every date this course runs — a 5-day camp has five sessions, a weekly club has one per week.</p>
        <SessionManager courseId={course.id} slotStyle={slotStyle} sessions={sessionRows} />
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-navy">Staff</h2>
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
        ) : <p className="mb-3 text-xs text-slate-400">No staff assigned yet.</p>}
        <AssignStaffForm courseId={course.id} instructors={instructorOptions} roles={activeRoles} />
      </Card>
    </div>
  );
}
