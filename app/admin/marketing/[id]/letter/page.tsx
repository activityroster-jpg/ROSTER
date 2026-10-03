import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { PrintButton } from "@/components/office/PrintButton";
import { LetterSheet, LetterStyles } from "@/components/admin/LetterSheet";

export const dynamic = "force-dynamic";

// A unique, filename-friendly name per prospect so saving 20 letters doesn't land
// them all as the same name. Used for both the page <title> and the client-side
// document.title set at print time (which is what the save dialog actually reads).
function letterFileName(name: string | null | undefined, id: string) {
  const safe = (name ?? "").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
  return `ActivityRoster-letter-${safe ? `${safe}-` : ""}${id.slice(0, 8)}`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let name = "";
  try { name = (await new PlatformRepository(await getDb()).prospectById(id))?.name ?? ""; } catch { /* id fallback */ }
  return { title: { absolute: letterFileName(name, id) } };
}

export default async function ProspectLetterPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const platform = new PlatformRepository(await getDb());
  const p = await platform.prospectById(id);
  if (!p) notFound();

  return (
    <>
      <LetterStyles />
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 px-2">
        <div>
          <p className="text-sm font-semibold text-navy">Letter to {p.name}</p>
          <p className="text-xs text-slate-500">Prints on A4 · the recipient address starts at a fixed position for a standard DL/C5 window, so every letter is positioned identically. The dashed window guide is screen-only and won&apos;t print. Use &ldquo;Save as PDF&rdquo; to keep a copy.</p>
        </div>
        <PrintButton label="Print / save as PDF" downloadName={letterFileName(p.name, id)} />
      </div>
      <div className="letters-doc">
        <LetterSheet p={p} />
      </div>
    </>
  );
}
