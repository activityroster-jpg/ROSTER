"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseCsv } from "@/lib/import/parse";
import { parseLinkedinSheet } from "@/lib/marketing/linkedin-import";
import { importLinkedinAction } from "@/app/admin/marketing/actions";

const SLICE = 200;

/**
 * Import LinkedIn research from a spreadsheet saved as CSV: a "name" column,
 * optional "postcode", "linkedin" (company page) and up to three people
 * ("contact", "role", "contact LinkedIn", then "contact 2 …", "contact 3 …").
 * Read in the browser and sent in slices; nothing already there is removed.
 */
export function LinkedinImport() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string; unmatched?: string[] } | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setResult(null);
    if (!/\.csv$/i.test(file.name)) { setResult({ ok: false, text: "Choose a .csv file. In Excel: File → Save As → CSV UTF-8, using the sheet with the centres." }); return; }
    const rows = parseLinkedinSheet(parseCsv(await file.text()));
    if (rows.length === 0) { setResult({ ok: false, text: "No rows with a LinkedIn page or a contact found. The first row needs headings, including “name”." }); return; }
    let matched = 0, updated = 0;
    const unmatched: string[] = [];
    for (let i = 0; i < rows.length; i += SLICE) {
      setBusy(`Importing ${Math.min(i + SLICE, rows.length)} of ${rows.length}…`);
      const r = await importLinkedinAction(rows.slice(i, i + SLICE)).catch(() => ({ ok: false as const, error: "Lost connection" }));
      if (!r.ok) { setBusy(null); setResult({ ok: false, text: `Stopped after ${i} rows: ${r.error ?? "couldn't save"}. Rows already imported are kept; importing the same file again is safe.` }); router.refresh(); return; }
      matched += r.matched ?? 0; updated += r.updated ?? 0; unmatched.push(...(r.unmatched ?? []));
    }
    setBusy(null);
    setResult({ ok: true, text: `${rows.length} rows read · ${matched} matched to a centre · ${updated} centre${updated === 1 ? "" : "s"} updated${unmatched.length ? ` · ${unmatched.length} not found on the list` : ""}.`, unmatched });
    router.refresh();
  };

  return (
    <div className="text-right">
      <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-navy hover:border-teal hover:text-teal ${busy ? "pointer-events-none opacity-60" : ""}`}>
        {busy ?? "⬆ Import spreadsheet (CSV)"}
        <input type="file" accept=".csv,text/csv" onChange={onFile} className="sr-only" disabled={Boolean(busy)} />
      </label>
      {result ? (
        <div role="status" className={`mt-1 max-w-md text-left text-xs ${result.ok ? "text-starboard" : "text-port"}`}>
          {result.text}
          {result.unmatched?.length ? (
            <details className="mt-0.5 text-slate-500"><summary className="cursor-pointer">Show the ones not found</summary><p className="mt-1">{result.unmatched.join(" · ")}</p></details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
