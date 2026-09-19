import { requireTenant } from "@/lib/tenant/require";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CourseSetupPage() {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const courseTypes = await repos.tenant.courseType.list(ctx);

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold text-navy">Course setup</h1>
      <p className="mb-4 text-sm text-slate-500">
        Your RYA course-type catalogue. Editing defaults and add/remove lands with full course management.
      </p>
      <Card className="p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Course type</th>
              <th className="px-4 py-3">Scheme</th>
              <th className="px-4 py-3">Capacity</th>
              <th className="px-4 py-3">Ratio</th>
              <th className="px-4 py-3">Safety boat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {courseTypes.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium text-navy">{c.name}</td>
                <td className="px-4 py-3 text-slate-600">{c.scheme ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{c.defaultCapacity}</td>
                <td className="px-4 py-3 text-slate-600">1:{c.studentsPerInstructor}</td>
                <td className="px-4 py-3 text-slate-600">{c.requiresSafetyBoat ? "Required" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
