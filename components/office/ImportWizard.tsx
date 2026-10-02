"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  autoDetectColumns,
  draftsFromCsv,
  draftsFromIcs,
  parseCsv,
  type DraftRow,
  type ImportField,
} from "@/lib/import/parse";
import { importCoursesAction, type ImportResult } from "@/app/(app)/office/import/actions";
import type { CourseAudience } from "@/lib/db/schema";
import { suggestCourseType } from "@/lib/domain/course-type-match";
import { CourseTypeChoice, initialChoice, type TypeOption } from "@/components/office/CourseTypeChoice";

const FIELD_LABELS: Record<ImportField, string> = {
  name: "Course name", date: "Date", startTime: "Start", endTime: "End", audience: "Youth / Adult", location: "Location", staff: "Staff",
};
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function issuesFor(r: DraftRow): string[] {
  const out: string[] = [];
  if (!r.name.trim()) out.push("No course name");
  if (!ISO.test(r.date)) out.push("Date needs to be YYYY-MM-DD");
  if (r.startTime && r.endTime && r.endTime <= r.startTime) out.push("End is not after start");
  return out;
}

export function ImportWizard({ types = [] }: { types?: TypeOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [phase, setPhase] = useState<"input" | "map" | "review" | "done">("input");
  const [text, setText] = useState("");
  const [grid, setGrid] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<ImportField, number>>({} as Record<ImportField, number>);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Course type per row: auto-matched from the name until the admin picks one.
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [manual, setManual] = useState<Set<number>>(new Set());
  const suggestion = (name: string) => suggestCourseType(name, types)?.type.id ?? null;
  const startReview = (rows: DraftRow[]) => {
    setDrafts(rows);
    setChoices(Object.fromEntries(rows.map((r, i) => [i, initialChoice(suggestion(r.name))])));
    setManual(new Set());
    setPhase("review");
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const parse = () => {
    setErr(null);
    const t = text.trim();
    if (!t) { setErr("Paste your schedule or choose a file first."); return; }
    if (/BEGIN:V(CALENDAR|EVENT)/i.test(t)) {
      const rows = draftsFromIcs(t);
      if (!rows.length) { setErr("No calendar events found."); return; }
      startReview(rows);
      return;
    }
    const g = parseCsv(t);
    if (g.length < 2) { setErr("That doesn't look like a table with a header row and data."); return; }
    setGrid(g);
    setMapping(autoDetectColumns(g[0]!));
    setPhase("map");
  };

  const buildReview = () => {
    startReview(draftsFromCsv(grid, mapping, true));
  };

  const edit = (i: number, field: ImportField, value: string) => {
    if (field === "name" && !manual.has(i)) setChoices((c) => ({ ...c, [i]: initialChoice(suggestion(value)) }));
    setDrafts((d) => d.map((r, idx) => {
      if (idx !== i) return r;
      const next = { ...r, [field]: field === "audience" ? (value as CourseAudience) : value } as DraftRow;
      next.issues = issuesFor(next);
      return next;
    }));
  };

  const importable = drafts.map((r, i) => ({ r, i })).filter(({ r }) => r.name.trim() && ISO.test(r.date));
  const unmatched = importable.filter(({ r, i }) => !manual.has(i) && !suggestion(r.name)).length;
  const flagged = drafts.filter((r) => r.issues.length > 0);

  const doImport = () => {
    setErr(null);
    startTransition(async () => {
      const res = await importCoursesAction(importable.map(({ r, i }) => ({
        name: r.name, date: r.date, startTime: r.startTime, endTime: r.endTime, audience: r.audience, location: r.location, staff: r.staff,
        typeChoice: choices[i],
      })));
      setResult(res); setPhase("done");
      if (res.ok) router.refresh();
    });
  };

  const headers = grid[0] ?? [];

  return (
    <div>
      {/* STEP: input */}
      {phase === "input" ? (
        <div className="rounded-card border border-slate-200 bg-white p-6">
          <h2 className="font-display text-lg font-semibold text-navy">1 · Bring in your existing schedule</h2>
          <p className="mt-1 text-sm text-slate-500">
            Export from your spreadsheet (Excel / Google Sheets → CSV), your booking/admin system, or your calendar
            (Google or Outlook → <code className="rounded bg-slate-100 px-1">.ics</code>), then paste it below or upload the file.
            We&apos;ll read it and let you check everything before anything is created.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50">
              Choose file (.csv / .ics)
              <input type="file" accept=".csv,.ics,.txt,text/csv,text/calendar" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); }} />
            </label>
            <span className="text-xs text-slate-400">or paste below</span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={"Course,Date,Start,End,Audience,Location,Instructor\nStage 1,12/07/2026,09:30,12:30,Youth,Main lake,Sam Green"}
            className="mt-3 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs outline-none focus:border-teal"
          />
          {err ? <p className="mt-2 text-sm text-port">{err}</p> : null}
          <div className="mt-3 flex justify-end">
            <button onClick={parse} className="rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">Read it →</button>
          </div>
        </div>
      ) : null}

      {/* STEP: map columns (CSV only) */}
      {phase === "map" ? (
        <div className="rounded-card border border-slate-200 bg-white p-6">
          <h2 className="font-display text-lg font-semibold text-navy">2 · Match your columns</h2>
          <p className="mt-1 text-sm text-slate-500">We&apos;ve guessed these from your headers — fix any that are wrong.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(Object.keys(FIELD_LABELS) as ImportField[]).map((f) => (
              <label key={f} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                <span className="text-sm font-medium text-navy">{FIELD_LABELS[f]}</span>
                <select
                  value={mapping[f] ?? -1}
                  onChange={(e) => setMapping((m) => ({ ...m, [f]: Number(e.target.value) }))}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                >
                  <option value={-1}>— none —</option>
                  {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-between">
            <button onClick={() => setPhase("input")} className="text-sm font-semibold text-slate-500 hover:text-navy">← Back</button>
            <button onClick={buildReview} className="rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">Preview →</button>
          </div>
        </div>
      ) : null}

      {/* STEP: review & fix */}
      {phase === "review" ? (
        <div className="rounded-card border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-navy">3 · Check &amp; fix</h2>
            <p className="text-sm text-slate-500">
              <span className="font-semibold text-starboard">{importable.length} ready</span>
              {flagged.length ? <span> · <span className="font-semibold text-amber">{flagged.length} need a look</span></span> : null}
              {unmatched ? <span> · <span className="font-semibold text-amber">{unmatched} with no type match</span></span> : null}
            </p>
          </div>
          <p className="mt-1 text-sm text-slate-500">Anything we couldn&apos;t read confidently is highlighted — correct it here. Rows without a name or valid date won&apos;t be imported. Each course is matched to one of your course types — check the Type column, and pick a type for any marked “no match”, add it to your list, or keep it as a one-off.</p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>{(Object.keys(FIELD_LABELS) as ImportField[]).map((f) => <th key={f} className="px-2 py-2 font-semibold">{FIELD_LABELS[f]}</th>)}<th className="px-2 py-2 font-semibold">Type</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drafts.map((r, i) => {
                  const bad = r.issues.length > 0;
                  return (
                    <tr key={i} className={bad ? "bg-amber/5" : ""}>
                      <td className="px-2 py-1"><input value={r.name} onChange={(e) => edit(i, "name", e.target.value)} className="w-40 rounded border border-slate-300 px-2 py-1 text-sm" /></td>
                      <td className="px-2 py-1"><input value={r.date} onChange={(e) => edit(i, "date", e.target.value)} placeholder="YYYY-MM-DD" className={`w-32 rounded border px-2 py-1 text-sm ${ISO.test(r.date) ? "border-slate-300" : "border-amber"}`} /></td>
                      <td className="px-2 py-1"><input value={r.startTime} onChange={(e) => edit(i, "startTime", e.target.value)} placeholder="HH:MM" className="w-20 rounded border border-slate-300 px-2 py-1 text-sm" /></td>
                      <td className="px-2 py-1"><input value={r.endTime} onChange={(e) => edit(i, "endTime", e.target.value)} placeholder="HH:MM" className="w-20 rounded border border-slate-300 px-2 py-1 text-sm" /></td>
                      <td className="px-2 py-1">
                        <select value={r.audience} onChange={(e) => edit(i, "audience", e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm">
                          <option value="youth">Youth</option><option value="adult">Adult</option><option value="all">All</option>
                        </select>
                      </td>
                      <td className="px-2 py-1"><input value={r.location} onChange={(e) => edit(i, "location", e.target.value)} className="w-32 rounded border border-slate-300 px-2 py-1 text-sm" /></td>
                      <td className="px-2 py-1"><input value={r.staff} onChange={(e) => edit(i, "staff", e.target.value)} className="w-32 rounded border border-slate-300 px-2 py-1 text-sm" /></td>
                      <td className="px-2 py-1">
                        <CourseTypeChoice value={choices[i] ?? initialChoice(suggestion(r.name))} onChange={(v) => { setChoices((c) => ({ ...c, [i]: v })); setManual((m) => new Set(m).add(i)); }}
                          types={types} importedName={r.name || "this course"} matched={manual.has(i) || Boolean(suggestion(r.name))} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {flagged.length ? (
            <p className="mt-2 text-xs text-amber">{flagged.length} row{flagged.length === 1 ? "" : "s"} still flagged: {[...new Set(flagged.flatMap((r) => r.issues))].join("; ")}.</p>
          ) : null}
          {err ? <p className="mt-2 text-sm text-port">{err}</p> : null}

          <div className="mt-4 flex justify-between">
            <button onClick={() => setPhase("input")} className="text-sm font-semibold text-slate-500 hover:text-navy">← Start over</button>
            <button onClick={doImport} disabled={pending || importable.length === 0} className="rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
              {pending ? "Importing…" : `Import ${importable.length} course${importable.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      ) : null}

      {/* STEP: done */}
      {phase === "done" && result ? (
        <div className="rounded-card border border-slate-200 bg-white p-8 text-center">
          {result.ok ? (
            <>
              <p className="font-display text-2xl font-semibold text-navy">✅ {result.message}</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">Courses were filed under the types you chose; new locations were created where needed. Review and roster staff in Courses.</p>
              <div className="mt-6 flex justify-center gap-3">
                <a href="/office/courses" className="rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">Go to Courses →</a>
                <button onClick={() => { setPhase("input"); setText(""); setDrafts([]); setResult(null); }} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-navy hover:bg-slate-50">Import more</button>
              </div>
            </>
          ) : (
            <>
              <p className="font-display text-xl font-semibold text-port">Import failed</p>
              <p className="mt-2 text-sm text-slate-600">{result.error}</p>
              <button onClick={() => setPhase("review")} className="mt-6 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-navy hover:bg-slate-50">Back to review</button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
