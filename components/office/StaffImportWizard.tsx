"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { autoDetectStaffColumns, draftsStaffFromCsv, parseCsv, splitList, STAFF_FIELD_LABELS, type DraftStaff, type StaffField } from "@/lib/import/staff";
import { importInstructorsAction, type ConfirmedStaff, type StaffImportResult } from "@/app/(app)/office/staff/import/actions";

const FIELDS: StaffField[] = ["name", "email", "phone", "employment", "quals", "courses"];
const input = "rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal";

export function StaffImportWizard() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [phase, setPhase] = useState<"input" | "map" | "review" | "done">("input");
  const [text, setText] = useState("");
  const [grid, setGrid] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<StaffField, number>>({} as Record<StaffField, number>);
  const [drafts, setDrafts] = useState<DraftStaff[]>([]);
  const [sendInvites, setSendInvites] = useState(false);
  const [result, setResult] = useState<StaffImportResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const parse = () => {
    setErr(null);
    const g = parseCsv(text.trim());
    if (g.length < 2) { setErr("That doesn't look like a table with a header row and rows below it."); return; }
    setGrid(g);
    setMapping(autoDetectStaffColumns(g[0]!));
    setPhase("map");
  };

  const toReview = () => {
    if (mapping.name < 0) { setErr("Tell us which column holds the person's name."); return; }
    setErr(null);
    setDrafts(draftsStaffFromCsv(grid, mapping, true));
    setPhase("review");
  };

  const update = (i: number, patch: Partial<DraftStaff>) => setDrafts((d) => d.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => setDrafts((d) => d.filter((_, j) => j !== i));

  const doImport = () => {
    const rows: ConfirmedStaff[] = drafts.filter((d) => d.name.trim()).map((d) => ({ name: d.name, email: d.email, phone: d.phone, employment: d.employment, quals: d.quals, courses: d.courses }));
    if (rows.length === 0) { setErr("No rows with a name to import."); return; }
    start(async () => {
      const res = await importInstructorsAction(rows, { sendInvites });
      setResult(res);
      if (res.ok) { setPhase("done"); router.refresh(); }
      else setErr(res.error ?? "Import failed");
    });
  };

  const header = grid[0] ?? [];
  const importable = drafts.filter((d) => d.name.trim()).length;

  return (
    <div className="rounded-card border border-slate-200 bg-white p-6">
      {err ? <p role="alert" className="mb-3 rounded-lg bg-port/10 px-3 py-2 text-sm text-port">{err}</p> : null}

      {phase === "input" ? (
        <div>
          <p className="mb-3 text-sm text-slate-600">Paste your staff list (or upload a CSV). It doesn&apos;t need to be complete — just include at least a name column. You&apos;ll review everything before anything is saved.</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder={"Name, Email, Employment, Qualifications, Courses\nSam Jones, sam@club.org, Freelance, Dinghy Instructor; First Aid, Youth Stage 1"} className={`w-full font-mono text-xs ${input}`} />
          <div className="mt-3 flex items-center gap-3">
            <input type="file" accept=".csv,text/csv,text/plain" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); }} className="text-sm" />
            <button type="button" onClick={parse} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">Continue</button>
          </div>
        </div>
      ) : null}

      {phase === "map" ? (
        <div>
          <p className="mb-3 text-sm text-slate-600">Match your columns. We&apos;ve guessed — correct any that are wrong. Only the name is required.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f} className="text-sm">
                <span className="mb-1 block font-medium text-navy">{STAFF_FIELD_LABELS[f]}{f === "name" ? " *" : ""}</span>
                <select value={mapping[f]} onChange={(e) => setMapping((m) => ({ ...m, [f]: Number(e.target.value) }))} className={`w-full ${input}`}>
                  <option value={-1}>— not in my sheet —</option>
                  {header.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button type="button" onClick={() => setPhase("input")} className="text-sm font-medium text-slate-500 hover:text-navy">← Back</button>
            <button type="button" onClick={toReview} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">Review {grid.length - 1} rows</button>
          </div>
        </div>
      ) : null}

      {phase === "review" ? (
        <div>
          <p className="mb-3 text-sm text-slate-600">Fix anything flagged, then import. Rows without a name are skipped. Unrecognised licences/courses are ignored — you can add them on each profile later.</p>
          <div className="max-h-[28rem] space-y-2 overflow-y-auto">
            {drafts.map((d, i) => (
              <div key={i} className={`rounded-lg border p-3 ${d.name.trim() ? "border-slate-200" : "border-port/40 bg-port/5"}`}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={d.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Full name *" className={input} />
                  <input value={d.email} onChange={(e) => update(i, { email: e.target.value })} placeholder="Email" className={input} />
                  <input value={d.quals} onChange={(e) => update(i, { quals: e.target.value })} placeholder="Qualifications / licences" className={input} />
                  <input value={d.courses} onChange={(e) => update(i, { courses: e.target.value })} placeholder="Courses they can teach" className={input} />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <select value={d.employment} onChange={(e) => update(i, { employment: e.target.value })} className={input}>
                    <option value="employed">Employed</option><option value="freelance">Freelance</option><option value="volunteer">Volunteer</option>
                  </select>
                  {splitList(d.quals).length ? <span className="text-[11px] text-slate-400">{splitList(d.quals).length} licence(s)</span> : null}
                  {splitList(d.courses).length ? <span className="text-[11px] text-slate-400">· {splitList(d.courses).length} course(s)</span> : null}
                  {d.issues.map((x) => <span key={x} className="rounded bg-amber/15 px-1.5 py-0.5 text-[10px] font-medium text-amber">{x}</span>)}
                  <button type="button" onClick={() => remove(i)} className="ml-auto text-xs text-slate-400 hover:text-port">Remove</button>
                </div>
              </div>
            ))}
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={sendInvites} onChange={(e) => setSendInvites(e.target.checked)} />
            Email a portal invite to everyone with a valid email address
          </label>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" onClick={() => setPhase("map")} className="text-sm font-medium text-slate-500 hover:text-navy">← Back</button>
            <button type="button" onClick={doImport} disabled={pending} className="rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Importing…" : `Import ${importable} staff`}</button>
          </div>
        </div>
      ) : null}

      {phase === "done" && result ? (
        <div className="text-center">
          <p className="font-display text-xl font-semibold text-navy">Imported ✓</p>
          <p className="mt-1 text-sm text-slate-600">{result.message}</p>
          <a href="/office/staff" className="mt-4 inline-block rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">View staff</a>
        </div>
      ) : null}
    </div>
  );
}
