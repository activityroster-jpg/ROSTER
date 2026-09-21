import { requireTenant } from "@/lib/tenant/require";
import { listStaffWithFit } from "@/lib/services/staff";
import { Card } from "@/components/ui";
import { AddInstructorForm } from "@/components/office/AddInstructorForm";
import { StaffTable, type StaffRow } from "@/components/office/StaffTable";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const staff = await listStaffWithFit(repos, ctx);

  const rows: StaffRow[] = staff.map(({ instructor, fit }) => ({
    id: instructor.id,
    name: instructor.name,
    email: instructor.email,
    employment: instructor.employmentType,
    fit: fit.fit,
    warnings: fit.warnings.length,
    blockText: fit.blocks.map((b) => (b.kind === "missing" ? `${b.name} missing` : `${b.name} expired`)).join(", "),
    linked: Boolean(instructor.userId),
    hasEmail: Boolean(instructor.email),
  }));

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold text-navy">Staff</h1>
        <p className="text-sm text-slate-500">{rows.length} instructors · fit-to-roster checked against your mandatory checks</p>
      </div>

      <Card className="mb-5">
        <h2 className="mb-3 font-semibold text-navy">Add an instructor</h2>
        <AddInstructorForm />
      </Card>

      <StaffTable rows={rows} />
    </div>
  );
}
