import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { Card } from "@/components/ui";
import { LETTER_BATCH_SUMMARY, groupLetterBatches } from "@/lib/marketing/letter-batches";
import { LetterBatchList } from "@/components/admin/LetterBatchList";

export const dynamic = "force-dynamic";
export const metadata = { title: "Printed letters · Prospects" };

/** Every letter batch printed so far, newest first, each one ready to print again. */
export default async function LetterHistoryPage() {
  await requirePlatformAdmin();
  const platform = new PlatformRepository(await getDb());
  const [entries, prospects] = await Promise.all([platform.interactionsWithSummary(LETTER_BATCH_SUMMARY), platform.listProspects(10_000, 0)]);
  const batches = groupLetterBatches(entries);
  const names = new Map(prospects.map((p) => [p.id, p.name]));
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Outreach CRM</p>
          <h1 className="font-display text-2xl font-bold text-navy">Printed letters</h1>
          <p className="mt-1 text-sm text-slate-500">Every batch from “Download next 10 letters”, with when it was printed. “Print again” opens the same letters in the same order to print or save as PDF; it doesn&apos;t change any centre&apos;s ticks.</p>
        </div>
        <Link href="/admin/marketing" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-navy hover:border-teal hover:text-teal">← Prospects list</Link>
      </div>
      <Card><LetterBatchList batches={batches} names={names} /></Card>
    </div>
  );
}
