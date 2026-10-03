import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { PrintButton } from "@/components/office/PrintButton";
import { LetterSheet, LetterStyles } from "@/components/admin/LetterSheet";
import { AutoPrint } from "@/components/admin/AutoPrint";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const n = ((await searchParams).ids ?? "").split(",").filter(Boolean).length;
  return { title: { absolute: `ActivityRoster-letters-${new Date().toISOString().slice(0, 10)}-${n}` } };
}

/** A batch of window-envelope letters (one A4 sheet each) — print / save as one PDF. */
export default async function LettersBatchPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  await requirePlatformAdmin();
  const ids = ((await searchParams).ids ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50);
  const platform = new PlatformRepository(await getDb());
  const prospects = (await Promise.all(ids.map((id) => platform.prospectById(id)))).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const name = `ActivityRoster-letters-${new Date().toISOString().slice(0, 10)}-${prospects.length}`;

  return (
    <>
      <LetterStyles />
      <AutoPrint />
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 px-2">
        <div>
          <p className="text-sm font-semibold text-navy">{prospects.length} letter{prospects.length === 1 ? "" : "s"} ready</p>
          <p className="text-xs text-slate-500">One A4 sheet each, addresses positioned for a DL/C5 window envelope. The print dialog opens automatically — choose “Save as PDF”. These centres are now marked <strong>Letter sent</strong>. <Link href="/admin/marketing" className="font-medium text-teal hover:underline">Back to marketing</Link></p>
        </div>
        <PrintButton label="Print / save as PDF" downloadName={name} />
      </div>
      <div className="letters-doc">
        {prospects.length === 0 ? <p className="p-6 text-center text-slate-500">No letters to show.</p> : prospects.map((p) => <LetterSheet key={p.id} p={p} />)}
      </div>
    </>
  );
}
