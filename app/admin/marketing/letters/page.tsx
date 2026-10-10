import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { PrintButton } from "@/components/office/PrintButton";
import { LetterSheet, LetterStyles } from "@/components/admin/LetterSheet";
import { AutoPrint } from "@/components/admin/AutoPrint";

export const dynamic = "force-dynamic";

type Search = Promise<{ ids?: string; at?: string }>;

/** A reprint carries the original print time (?at=ms) so the file name and note match the first PDF. */
function printedAt(at: string | undefined): Date | null {
  const ms = Number(at);
  return at && Number.isFinite(ms) && ms > 0 ? new Date(ms) : null;
}
const fileName = (when: Date | null, n: number) => `ActivityRoster-letters-${(when ?? new Date()).toISOString().slice(0, 10)}-${n}${when ? "-reprint" : ""}`;

export async function generateMetadata({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  return { title: { absolute: fileName(printedAt(sp.at), (sp.ids ?? "").split(",").filter(Boolean).length) } };
}

/** A batch of window-envelope letters (one A4 sheet each) — print / save as one PDF. */
export default async function LettersBatchPage({ searchParams }: { searchParams: Search }) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const reprintOf = printedAt(sp.at);
  const ids = (sp.ids ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50);
  const platform = new PlatformRepository(await getDb());
  const prospects = (await Promise.all(ids.map((id) => platform.prospectById(id)))).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const name = fileName(reprintOf, prospects.length);

  return (
    <>
      <LetterStyles />
      <AutoPrint />
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 px-2">
        <div>
          <p className="text-sm font-semibold text-navy">{prospects.length} letter{prospects.length === 1 ? "" : "s"} ready</p>
          <p className="text-xs text-slate-500">One A4 sheet each, addresses positioned for a DL/C5 window envelope. The print dialog opens automatically — choose “Save as PDF”. {reprintOf
            ? <>This is a reprint of the batch printed {reprintOf.toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}; nothing on the centres has changed.</>
            : <>These centres are now marked <strong>Ready to send</strong>; tick <strong>Letter sent</strong> once they are posted.</>} <Link href="/admin/marketing" className="font-medium text-teal hover:underline">Back to marketing</Link> · <Link href="/admin/marketing/letters/history" className="font-medium text-teal hover:underline">Printed letters</Link></p>
        </div>
        <PrintButton label="Print / save as PDF" downloadName={name} />
      </div>
      <div className="letters-doc">
        {prospects.length === 0 ? <p className="p-6 text-center text-slate-500">No letters to show.</p> : prospects.map((p) => <LetterSheet key={p.id} p={p} />)}
      </div>
    </>
  );
}
