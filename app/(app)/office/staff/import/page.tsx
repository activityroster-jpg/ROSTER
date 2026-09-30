import Link from "next/link";
import { requireTenant } from "@/lib/tenant/require";
import { StaffImportWizard } from "@/components/office/StaffImportWizard";

export const dynamic = "force-dynamic";

export default async function StaffImportPage() {
  await requireTenant({ role: "admin" });
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-navy">Import staff</h1>
        <Link href="/office/staff" className="text-sm text-teal hover:underline">← Staff</Link>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Bring your team in from a spreadsheet — even a rough, incomplete one. Map your columns, review, and import.
      </p>
      <a href="/learn?topic=staff-import" target="_blank" rel="noreferrer" className="mb-6 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50">
        📖 Read the guide
      </a>
      <StaffImportWizard />
    </div>
  );
}
