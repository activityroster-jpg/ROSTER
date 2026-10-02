import { requireTenant } from "@/lib/tenant/require";
import { CourseTypeTable, type CourseTypeRow } from "@/components/office/CourseTypeTable";

export const dynamic = "force-dynamic";

export default async function CourseSetupPage() {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const courseTypes = await repos.tenant.courseType.list(ctx);

  const rows: CourseTypeRow[] = courseTypes
    .map((c) => ({
      id: c.id,
      name: c.name,
      scheme: c.scheme ?? null,
      audience: c.audience,
      defaultCapacity: c.defaultCapacity,
      studentsPerInstructor: c.studentsPerInstructor,
      active: Boolean(c.active),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">Course setup</h1>
      <p className="mb-4 text-sm text-slate-500">
        Your course-type catalogue. Edit any field in place, add new types, or delete ones you don&apos;t run. A type
        that&apos;s already used by courses is retired rather than deleted, so past courses still show it.
      </p>
      <CourseTypeTable rows={rows} />
    </div>
  );
}
