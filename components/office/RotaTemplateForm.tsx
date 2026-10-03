"use client";

import { useState, useTransition } from "react";
import { setRotaTemplateAction } from "@/app/(app)/office/settings/actions";
import { ROTA_FIELDS, type RotaTemplateSettings } from "@/lib/rota/template";

/** Tiny drawings of the two layouts so the choice is obvious without downloading. */
function Preview({ orientation, selected }: { orientation: "vertical" | "horizontal"; selected: boolean }) {
  const border = selected ? "border-teal ring-2 ring-teal/30" : "border-slate-200";
  if (orientation === "vertical") {
    return (
      <div className={`h-28 w-20 rounded border bg-white p-1.5 ${border}`} aria-hidden>
        <div className="mb-1 h-1.5 w-10 rounded bg-navy/70" />
        {[0, 1, 2].map((d) => (
          <div key={d} className="mb-1">
            <div className="mb-0.5 h-1 w-full rounded bg-teal/30" />
            {[0, 1].map((r) => <div key={r} className="mb-0.5 flex gap-0.5"><div className="h-1 w-3 rounded bg-slate-300" /><div className="h-1 flex-1 rounded bg-slate-200" /><div className="h-1 w-4 rounded bg-slate-200" /></div>)}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={`h-20 w-28 rounded border bg-white p-1.5 ${border}`} aria-hidden>
      <div className="mb-1 h-1.5 w-12 rounded bg-navy/70" />
      <div className="flex gap-0.5">
        {[0, 1, 2, 3, 4, 5, 6].map((d) => (
          <div key={d} className="flex-1">
            <div className="mb-0.5 h-1 rounded bg-teal/30" />
            {[0, 1, 2].slice(0, d % 2 ? 2 : 3).map((r) => <div key={r} className="mb-0.5 h-2.5 rounded border-l-2 border-teal bg-slate-100" />)}
          </div>
        ))}
      </div>
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
  const field = (k: keyof RotaTemplateSettings["fields"], v: boolean) => setT((x) => ({ ...x, fields: { ...x.fields, [k]: v } }));

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">What goes on it</p>
        <div className={`grid gap-1.5 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
          {ROTA_FIELDS.map((f) => (
            <label key={f.key} className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={t.fields[f.key]} onChange={(e) => field(f.key, e.target.checked)} disabled={f.key === "roles" && !t.fields.instructors} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
              <span>{f.label}</span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-400">The course name and the date are always shown. Staff appear by first name; a surname initial is added only when two people on the sheet share a first name.</p>
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
        <p className="mt-1 text-xs text-slate-400">This is the default; you can pick a different period each time you download.</p>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">Layout</p>
        <div className="flex flex-wrap gap-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="radio" name="orientation" className="sr-only" checked={t.orientation === "vertical"} onChange={() => setT((x) => ({ ...x, orientation: "vertical" }))} />
            <Preview orientation="vertical" selected={t.orientation === "vertical"} />
            <span className="max-w-[12rem] text-sm"><span className="font-medium text-navy">Vertical</span><span className="block text-xs text-slate-500">Portrait page, a table for each day. Easy to read on a noticeboard.</span></span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input type="radio" name="orientation" className="sr-only" checked={t.orientation === "horizontal"} onChange={() => setT((x) => ({ ...x, orientation: "horizontal" }))} />
            <Preview orientation="horizontal" selected={t.orientation === "horizontal"} />
            <span className="max-w-[12rem] text-sm"><span className="font-medium text-navy">Horizontal</span><span className="block text-xs text-slate-500">Landscape page, days across the top. Better when you show lots of detail or run big courses with many staff; a month becomes a calendar.</span></span>
          </label>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={pending} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : compact ? "Save and continue →" : "Save rota layout"}</button>
        {!compact ? <a href="/api/office/rota.pdf" target="_blank" rel="noreferrer" className="text-sm font-medium text-teal hover:underline">Preview this week&rsquo;s PDF</a> : null}
        {msg ? <span className={`text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</span> : null}
      </div>
    </div>
  );
}
