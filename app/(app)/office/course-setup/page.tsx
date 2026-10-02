import { requireTenant } from "@/lib/tenant/require";
import { CourseTypeTable, type CourseTypeRow } from "@/components/office/CourseTypeTable";
import { OneOffCourseTypes } from "@/components/office/OneOffCourseTypes";
import { eq } from "drizzle-orm";
import { course as courseTable } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function CourseSetupPage() {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const courseTypes = await repos.tenant.courseType.list(ctx);

  const rows: CourseTypeRow[] = courseTypes
    .filter((c) => c.listed)
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

  // One-off types (typed in manually, or imported without a match).
  const oneOffs = await Promise.all(
    courseTypes
      .filter((c) => !c.listed && c.active)
      .map(async (c) => ({ id: c.id, name: c.name, courses: await repos.tenant.course.count(ctx, eq(courseTable.courseTypeId, c.id)) })),
  );
  oneOffs.sort((a, b) => a.name.localeCompare(b.name));
  const listedChoices = rows.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name }));

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">Course setup</h1>
      <p className="mb-4 text-sm text-slate-500">
        Your course-type catalogue. Edit any field in place, add new types, or delete ones you don&apos;t run. A type
        that&apos;s already used by courses is retired rather than deleted, so past courses still show it.
      </p>
      <a href="/learn?topic=courses" target="_blank" rel="noreferrer" className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50">📖 Read the guide</a>
      <CourseTypeTable rows={rows} />
      <OneOffCourseTypes items={oneOffs} listed={listedChoices} />
    </div>
  );
}
