import { requireTenant } from "@/lib/tenant/require";
import { getWeekSchedule, weekStart } from "@/lib/services/schedule";
import { listStaffWithFit } from "@/lib/services/staff";
import { Card, StatusPill } from "@/components/ui";
import { CreateCourseForm } from "@/components/office/CreateCourseForm";
import { AssignStaffForm } from "@/components/office/AssignStaffForm";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const monday = weekStart(new Date());
  const [{ coverageByCourse }, courseTypes, staff, roles, assignments, instructors] = await Promise.all([
    getWeekSchedule(repos, ctx, monday),
    repos.tenant.courseType.list(ctx),
    listStaffWithFit(repos, ctx),
    repos.tenant.roleType.list(ctx),
    repos.tenant.courseStaff.list(ctx),
    repos.tenant.instructor.list(ctx),
  ]);
  const courses = [...coverageByCourse.values()];
  const activeTypes = courseTypes.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name }));
  const activeRoles = roles.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name }));
  const fitByInstructor = new Map(staff.map((s) => [s.instructor.id, s.fit.fit]));
  const instructorOptions = instructors
    .filter((i) => i.status === "active")
    .map((i) => ({ id: i.id, name: i.name, fit: fitByInstructor.get(i.id) ?? true }));
  const nameById = new Map(instructors.map((i) => [i.id, i.name]));
  const roleName = new Map(roles.map((r) => [r.id, r.name]));

  const assignedByCourse = new Map<string, typeof assignments>();
  for (const a of assignments) {
    assignedByCourse.set(a.courseId, [...(assignedByCourse.get(a.courseId) ?? []), a]);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-navy">Courses</h1>
        <span className="text-sm text-slate-500">{courses.length} courses</span>
      </div>

      <Card className="mb-6">
        <h2 className="mb-3 font-semibold text-navy">Add a course</h2>
        <CreateCourseForm courseTypes={activeTypes} />
      </Card>

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
                    <p className="font-medium text-navy">{c.courseName}</p>
                    <p className="text-xs text-slate-500">
                      {c.courseTypeName} · <span className="capitalize">{c.status}</span> ·{" "}
                      {c.ratio.ratioCountingStaff}/{c.ratio.requiredStaff} staff
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.ratio.understaffed ? <StatusPill tone="attention">Under-staffed</StatusPill> : null}
                    {c.ratio.missingSafetyCover ? <StatusPill tone="conflict">No safety cover</StatusPill> : null}
                    {c.ratio.ok ? <StatusPill tone="covered">Covered</StatusPill> : null}
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

                <AssignStaffForm courseId={c.courseId} instructors={instructorOptions} roles={activeRoles} />
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
