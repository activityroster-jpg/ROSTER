import Link from "next/link";
import type { LetterBatch } from "@/lib/marketing/letter-batches";

const when = (d: Date) => d.toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Where a batch can be opened again: the same centres, in the same order, as a reprint. */
export function reprintHref(b: LetterBatch): string {
  return `/admin/marketing/letters?ids=${b.prospectIds.join(",")}&at=${b.printedAt.getTime()}`;
}

/**
 * Letter batches printed with "Download next 10 letters", newest first: when,
 * by whom, which centres, and a button to open the same letters again to
 * print or save as PDF. Reprinting changes nothing on the centres.
 */
export function LetterBatchList({ batches, names, more }: { batches: LetterBatch[]; names: Map<string, string>; more?: number }) {
  if (batches.length === 0) return <p className="text-sm text-slate-400">No letter batches printed yet. They appear here after “Download next 10 letters”.</p>;
  return (
    <div>
      <ul className="divide-y divide-slate-100">
        {batches.map((b) => {
          const centres = b.prospectIds.map((id) => names.get(id)).filter((n): n is string => Boolean(n));
          const gone = b.prospectIds.length - centres.length;
          return (
            <li key={b.key} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-navy">
                  {when(b.printedAt)} <span className="font-normal text-slate-500">· {b.prospectIds.length} letter{b.prospectIds.length === 1 ? "" : "s"}{b.author ? ` · ${b.author}` : ""}</span>
                </p>
                <details className="mt-0.5">
                  <summary className="cursor-pointer text-xs text-slate-500 hover:text-navy">{centres.slice(0, 3).join(", ")}{centres.length > 3 ? ` and ${centres.length - 3} more` : ""}</summary>
                  <ol className="mt-1 list-decimal pl-5 text-xs text-slate-600">
                    {b.prospectIds.map((id) => <li key={id}>{names.has(id) ? <Link href={`/admin/marketing/${id}`} className="hover:text-teal hover:underline">{names.get(id)}</Link> : <span className="text-slate-400">Centre since removed</span>}</li>)}
                  </ol>
                </details>
                {gone > 0 ? <p className="text-[11px] text-slate-400">{gone} centre{gone === 1 ? " has" : "s have"} since been removed from the list and won&apos;t reprint.</p> : null}
              </div>
              <a href={reprintHref(b)} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:border-teal hover:text-teal">🖨 Print again</a>
            </li>
          );
        })}
      </ul>
      {more && more > 0 ? <p className="mt-2 text-xs"><Link href="/admin/marketing/letters/history" className="font-medium text-teal hover:underline">See all {batches.length + more} batches →</Link></p> : null}
    </div>
  );
}
