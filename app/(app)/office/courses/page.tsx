import { requireTenant } from "@/lib/tenant/require";
import { getWeekSchedule, weekStart } from "@/lib/services/schedule";
import { Card, StatusPill } from "@/components/ui";
import { CreateCourseForm } from "@/components/office/CreateCourseForm";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const monday = weekStart(new Date());
  const [{ coverageByCourse }, courseTypes] = await Promise.all([
    getWeekSchedule(repos, ctx, monday),
    repos.tenant.courseType.list(ctx),
  ]);
  const courses = [...coverageByCourse.values()];
  const activeTypes = courseTypes.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name }));

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

      <div className="space-y-3">
        {courses.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-400">
              No courses yet. Course creation (with session builder and fit-checked staff assignment) lands in
              Phase 4.
            </p>
          </Card>
        ) : (
          courses.map((c) => (
            <Card key={c.courseId} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-navy">{c.courseName}</p>
                <p className="text-xs text-slate-500">
                  {c.courseTypeName} · <span className="capitalize">{c.status}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {c.ratio.understaffed ? <StatusPill tone="attention">Under-staffed</StatusPill> : null}
                {c.ratio.missingSafetyCover ? <StatusPill tone="conflict">No safety cover</StatusPill> : null}
                {c.ratio.ok ? <StatusPill tone="covered">Covered</StatusPill> : null}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
