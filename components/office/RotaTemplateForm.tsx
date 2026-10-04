"use client";

import { useState, useTransition } from "react";
import { setRotaTemplateAction } from "@/app/(app)/office/settings/actions";
import { ROTA_FIELDS, ROTA_STYLES, type RotaStyle, type RotaTemplateSettings } from "@/lib/rota/template";

/**
 * A miniature of the sheet in a given style and orientation: a day bar, a
 * column header, and three course rows (name, times, staff, extras). Drawn
 * with divs so the choice is obvious without downloading anything.
 */
function Preview({ style, orientation, selected }: { style: RotaStyle; orientation: "vertical" | "horizontal"; selected: boolean }) {
  const border = selected ? "border-teal ring-2 ring-teal/30" : "border-slate-200";
  const look = {
    classic: { day: "bg-teal/15 text-navy", col: "text-slate-400", zebra: "", rule: "border-slate-200", accent: "" },
    bold: { day: "bg-navy text-white", col: "bg-teal text-white", zebra: "odd:bg-teal/5", rule: "border-slate-200", accent: "border-l-2 border-teal" },
    minimal: { day: "border-b-2 border-slate-800 text-slate-800", col: "text-slate-500", zebra: "", rule: "border-slate-300", accent: "" },
    compact: { day: "bg-teal/15 text-navy", col: "text-slate-400", zebra: "odd:bg-slate-50", rule: "border-slate-200", accent: "" },
  }[style];
  const rows = style === "compact" ? 5 : 3;
  const dims = orientation === "vertical" ? "h-32 w-24" : "h-24 w-32";
  const rowH = style === "compact" ? "h-1.5" : "h-2";
  return (
    <div className={`${dims} shrink-0 overflow-hidden rounded border bg-white p-1.5 text-[5px] leading-none ${border}`} aria-hidden>
      <div className="mb-1 h-1.5 w-10 rounded bg-navy/70" />
      <div className={`mb-0.5 flex items-center justify-between rounded-sm px-0.5 ${look.day}`} style={{ height: 7 }}><span className="font-bold">Mon 6 Oct</span><span className="opacity-70">{rows} courses</span></div>
      <div className={`mb-0.5 flex gap-0.5 px-0.5 font-bold ${look.col}`}><span className="flex-[1.3]">Course</span><span className="w-5">Times</span><span className="flex-[1.5]">Staff</span><span className="flex-1">Where</span></div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className={`flex items-center gap-0.5 border-b px-0.5 ${look.rule} ${look.zebra} ${look.accent} ${rowH}`}>
          <div className="h-1 flex-[1.3] rounded-sm bg-navy/60" />
          <div className="h-1 w-5 rounded-sm bg-slate-300" />
          <div className="h-1 flex-[1.5] rounded-sm bg-slate-300" />
          <div className="h-1 flex-1 rounded-sm bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

export function RotaTemplateForm({ initial, onSaved, compact = false }: { initial: RotaTemplateSettings; onSaved?: () => void; compact?: boolean }) {
  const [t, setT] = useState<RotaTemplateSettings>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = () => start(async () => {
    const r = await setRotaTemplateAction(t);
    setMsg({ ok: r.ok, text: r.ok ? "Saved" : r.error ?? "Could not save" });
    if (r.ok) onSaved?.();
  });
  const field = (k: keyof RotaTemplateSettings["fields"], v: boolean) => setT((x) => ({ ...x, fields: { ...x.fields, [k]: v, ...(k === "instructors" && !v ? { roles: false } : {}) } }));

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">The sheet is a breakdown of each day: a row for every course, with the course name on the left, then its times, then who is working, then any extras you tick.</p>
      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">Columns</p>
        <div className={`grid gap-1.5 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
          {ROTA_FIELDS.map((f) => (
            <label key={f.key} className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={t.fields[f.key]} onChange={(e) => field(f.key, e.target.checked)} disabled={f.key === "roles" && !t.fields.instructors} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
              <span>{f.label}</span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-400">The course name and the date are always shown. The number of students comes from how many are booked on each course. Staff appear by first name, one per line; a surname initial is added only when two people on the sheet share a first name.</p>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">Style</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROTA_STYLES.map((s) => (
            <label key={s.key} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-2 ${t.style === s.key ? "border-teal bg-teal/5" : "border-slate-200 hover:border-slate-300"}`}>
              <input type="radio" name="style" className="sr-only" checked={t.style === s.key} onChange={() => setT((x) => ({ ...x, style: s.key }))} />
              <Preview style={s.key} orientation={t.orientation} selected={t.style === s.key} />
              <span className="text-sm"><span className="font-medium text-navy">{s.label}</span><span className="block text-xs text-slate-500">{s.blurb}</span></span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">Page</p>
        <div className="flex flex-wrap gap-2">
          {([["vertical", "Portrait", "Upright page. Fine for a few columns."], ["horizontal", "Landscape", "Wide page. Better with staff roles, locations and equipment all on."]] as const).map(([v, l, d]) => (
            <label key={v} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${t.orientation === v ? "border-teal bg-teal/5 text-navy" : "border-slate-200 text-slate-600"}`} title={d}>
              <input type="radio" name="orientation" className="sr-only" checked={t.orientation === v} onChange={() => setT((x) => ({ ...x, orientation: v }))} />{l}
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">How much time per download</p>
        <div className="flex flex-wrap gap-2">
          {([["day", "One day"], ["week", "One week"], ["month", "One month"]] as const).map(([v, l]) => (
            <label key={v} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${t.range === v ? "border-teal bg-teal/5 text-navy" : "border-slate-200 text-slate-600"}`}>
              <input type="radio" name="range" className="sr-only" checked={t.range === v} onChange={() => setT((x) => ({ ...x, range: v }))} />{l}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-400">This is the default; you can pick a different period each time you download. A week or month is the same day-by-day breakdown, one day after another.</p>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={pending} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : compact ? "Save and continue →" : "Save rota layout"}</button>
        {!compact ? <a href="/api/office/rota.pdf" target="_blank" rel="noreferrer" className="text-sm font-medium text-teal hover:underline">Preview today&rsquo;s PDF</a> : null}
        {msg ? <span className={`text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</span> : null}
      </div>
    </div>
  );
}
