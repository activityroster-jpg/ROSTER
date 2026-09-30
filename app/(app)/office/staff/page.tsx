import { requireTenant } from "@/lib/tenant/require";
import { listStaffWithFit } from "@/lib/services/staff";
import { getTeachingMatrix } from "@/lib/services/teaching";
import { Card } from "@/components/ui";
import { AddInstructorForm } from "@/components/office/AddInstructorForm";
import { StaffTable, type StaffRow } from "@/components/office/StaffTable";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const [staff, qualTypes, teaching, courseTypes, complianceTypes] = await Promise.all([
    listStaffWithFit(repos, ctx),
    repos.tenant.qualificationType.list(ctx),
    getTeachingMatrix(repos, ctx),
    repos.tenant.courseType.list(ctx),
    repos.tenant.complianceType.list(ctx),
  ]);
  const qualChoices = qualTypes
    .filter((q) => q.active)
    .sort((a, b) => a.rank - b.rank)
    .map((q) => ({ id: q.id, name: q.name }));
  const courseChoices = courseTypes
    .filter((c) => c.active)
    .map((c) => ({ id: c.id, name: c.name, audience: c.audience, scheme: c.scheme, category: c.category }));
  const checkChoices = complianceTypes
    .filter((c) => c.active)
    .map((c) => ({ id: c.id, name: c.name, mandatory: Boolean(c.mandatory) }));

  const rows: StaffRow[] = staff.map(({ instructor, fit }) => {
    const teach = teaching.get(instructor.id) ?? [];
    return {
      id: instructor.id,
      name: instructor.name,
      email: instructor.email,
      employment: instructor.employmentType,
      fit: fit.fit,
      warnings: fit.warnings.length,
      blockText: fit.blocks.map((b) => (b.kind === "missing" ? `${b.name} missing` : `${b.name} expired`)).join(", "),
      linked: Boolean(instructor.userId),
      hasEmail: Boolean(instructor.email),
      teaches: teach.map((c) => c.name),
      teachesYouth: teach.some((c) => c.audience === "youth" || c.audience === "all"),
      teachesAdult: teach.some((c) => c.audience === "adult" || c.audience === "all"),
    };
  });

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy">Staff</h1>
          <p className="text-sm text-slate-500">{rows.length} instructors · fit-to-roster and the courses each can teach, from the qualifications they hold</p>
        </div>
        <a href="/office/staff/import" className="flex-none rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-slate-50">Import from spreadsheet</a>
      </div>

      <Card className="mb-5">
        <h2 className="mb-1 font-semibold text-navy">Add an instructor</h2>
        <p className="mb-3 text-xs text-slate-500">Enter their details and what they teach — we email them an invite to set up their account and upload their licences.</p>
        <AddInstructorForm courses={courseChoices} quals={qualChoices} checks={checkChoices} />
      </Card>

      <StaffTable rows={rows} />
    </div>
  );
}
