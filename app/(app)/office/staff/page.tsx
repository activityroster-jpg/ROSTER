import { requireTenant } from "@/lib/tenant/require";
import { listStaffWithFit } from "@/lib/services/staff";
import { Card, StatusPill } from "@/components/ui";
import { AddInstructorForm } from "@/components/office/AddInstructorForm";
import { InviteInstructorButton } from "@/components/office/InviteInstructorButton";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const staff = await listStaffWithFit(repos, ctx);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-navy">Staff</h1>
        <span className="text-sm text-slate-500">{staff.length} instructors</span>
      </div>

      <Card className="mb-6">
        <h2 className="mb-3 font-semibold text-navy">Add an instructor</h2>
        <AddInstructorForm />
      </Card>

      <div className="overflow-hidden rounded-card border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Employment</th>
              <th className="px-4 py-3">Fit to roster</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3">Portal access</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staff.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No instructors yet. Add your team to start rostering.
                </td>
              </tr>
            ) : (
              staff.map(({ instructor, fit }) => (
                <tr key={instructor.id}>
                  <td className="px-4 py-3 font-medium text-navy">{instructor.name}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{instructor.employmentType}</td>
                  <td className="px-4 py-3">
                    {fit.fit ? (
                      <StatusPill tone="covered">Fit</StatusPill>
                    ) : (
                      <StatusPill tone="conflict">Blocked</StatusPill>
                    )}
                    {fit.warnings.length > 0 ? (
                      <span className="ml-2">
                        <StatusPill tone="attention">{fit.warnings.length} expiring</StatusPill>
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {fit.blocks.length > 0
                      ? fit.blocks
                          .map((b) => (b.kind === "missing" ? `${b.name} missing` : `${b.name} expired`))
                          .join(", ")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {instructor.email ? (
                      <InviteInstructorButton instructorId={instructor.id} linked={Boolean(instructor.userId)} />
                    ) : (
                      <span className="text-xs text-slate-400">Add email to invite</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
