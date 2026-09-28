import Link from "next/link";
import { requireTenant } from "@/lib/tenant/require";
import { ImportWizard } from "@/components/office/ImportWizard";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  // Admin-only; ensures a tenant context exists before rendering the client wizard.
  await requireTenant({ role: "admin" });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4">
        <Link href="/office/courses" className="text-sm text-slate-400 hover:text-navy">← Back to Courses</Link>
        <h1 className="mt-1 font-display text-2xl font-bold text-navy">Import your courses</h1>
        <p className="text-sm text-slate-500">
          Bring your existing timetable across from a spreadsheet, booking system or calendar instead of typing it in.
          We read it, flag anything unclear, and you confirm before anything is created.
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}
