"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateFeatureRequestAction } from "@/app/admin/requests/actions";
import { IMPORTANCE_LABEL, STATUS_INFO } from "@/lib/validation/feature-request";
import type { FeatureRequestImportance, FeatureRequestStatus } from "@/lib/db/schema";

export interface RequestRow {
  id: string;
  centreName: string;
  centreSlug: string;
  submitterName: string | null;
  kind: "feature" | "problem";
  title: string;
  publicTitle: string;
  problem: string;
  change: string;
  whoAffected: string | null;
  frequency: string | null;
  workaround: string | null;
  importance: FeatureRequestImportance;
  details: string | null;
  hasScreenshot: boolean;
  status: FeatureRequestStatus;
  hidden: boolean;
  responseToCentre: string | null;
  votes: number;
  createdAt: string;
}

const COLUMNS: { key: FeatureRequestStatus; accent: string }[] = [
  { key: "submitted", accent: "border-slate-300" },
  { key: "in_review", accent: "border-navy" },
  { key: "approved", accent: "border-teal" },
  { key: "in_development", accent: "border-teal" },
  { key: "testing", accent: "border-amber" },
  { key: "live", accent: "border-starboard" },
  { key: "not_possible", accent: "border-port" },
];
const IMPORTANCE_CHIP: Record<FeatureRequestImportance, string> = { blocking: "bg-port/15 text-port", important: "bg-amber/15 text-amber", nice: "bg-slate-100 text-slate-500" };
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/**
 * The Dev Center board of centres' requests, laid out like the task planner:
 * drag a card between stages (or use the stage picker in its panel). The
 * centre's own page reads the same rows, so a move shows there at once.
 */
export function RequestPlanner({ requests: initial }: { requests: RequestRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState(initial);
  useEffect(() => setRows(initial), [initial]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<FeatureRequestStatus | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const save = (id: string, patch: Parameters<typeof updateFeatureRequestAction>[1], local: Partial<RequestRow>) => {
    setErr(null);
    setRows((list) => list.map((x) => (x.id === id ? { ...x, ...local } : x)));
    start(async () => {
      const res = await updateFeatureRequestAction(id, patch);
      if (!res.ok) { setErr(res.error ?? "That didn't save"); setRows(initial); }
      else router.refresh();
    });
  };
  const move = (id: string, status: FeatureRequestStatus) => {
    const r = rows.find((x) => x.id === id);
    if (r && r.status !== status) save(id, { status }, { status });
  };

  const open = rows.find((r) => r.id === openId) ?? null;

  return (
    <div>
      {err ? <p className="mb-2 text-sm text-port">{err}</p> : null}
      <p className="mb-2 text-xs text-slate-400">Drag a card to another stage, or click it to read the brief and edit it.</p>
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1100px] grid-cols-7 gap-3">
          {COLUMNS.map((col) => {
            const list = rows.filter((r) => r.status === col.key).sort((a, b) => b.votes - a.votes || (a.createdAt < b.createdAt ? -1 : 1));
            return (
              <div
                key={col.key}
                onDragOver={(e) => { if (dragId) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (overCol !== col.key) setOverCol(col.key); } }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverCol(null); }}
                onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || dragId; setOverCol(null); setDragId(null); if (id) move(id, col.key); }}
                className={`rounded-card border-t-4 ${col.accent} border-x border-b border-slate-200 p-2.5 transition-colors ${overCol === col.key ? "bg-teal/5 ring-2 ring-teal/30" : "bg-slate-50/50"}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-display text-sm font-bold text-navy">{STATUS_INFO[col.key].label}</h2>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">{list.length}</span>
                </div>
                <div className="space-y-2">
                  {list.length === 0 ? <p className="px-1 py-4 text-center text-xs text-slate-400">Nothing here.</p> : list.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData("text/plain", r.id); e.dataTransfer.effectAllowed = "move"; setDragId(r.id); }}
                      onDragEnd={() => { setDragId(null); setOverCol(null); }}
                      onClick={() => setOpenId(r.id)}
                      className={`block w-full cursor-grab rounded-lg border bg-white p-2.5 text-left active:cursor-grabbing ${openId === r.id ? "border-teal ring-1 ring-teal/40" : "border-slate-200"} ${dragId === r.id ? "opacity-40" : ""}`}
                    >
                      <p className="text-sm font-medium text-navy">{r.publicTitle}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{r.centreName} · {fmt(r.createdAt)}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${r.kind === "problem" ? "bg-port/10 text-port" : "bg-teal/10 text-teal"}`}>{r.kind === "problem" ? "Problem" : "Feature"}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${IMPORTANCE_CHIP[r.importance]}`}>{r.importance === "nice" ? "Nice to have" : r.importance === "blocking" ? "Blocking" : "Important"}</span>
                        {r.votes ? <span className="rounded bg-navy/5 px-1.5 py-0.5 text-[10px] font-semibold text-navy">👍 {r.votes}</span> : null}
                        {r.hidden ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">Off the board</span> : null}
                        {r.hasScreenshot ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">📎</span> : null}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {open ? <RequestPanel key={open.id} row={open} pending={pending} onClose={() => setOpenId(null)} onSave={save} /> : null}
    </div>
  );
}

function RequestPanel({ row, pending, onClose, onSave }: {
  row: RequestRow;
  pending: boolean;
  onClose: () => void;
  onSave: (id: string, patch: Parameters<typeof updateFeatureRequestAction>[1], local: Partial<RequestRow>) => void;
}) {
  const [publicTitle, setPublicTitle] = useState(row.publicTitle);
  const [response, setResponse] = useState(row.responseToCentre ?? "");
  const block = (label: string, value: string | null) => (value ? (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{value}</p>
    </div>
  ) : null);
  const field = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal";

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={row.title}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div className="relative h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">{row.centreName} ({row.centreSlug}){row.submitterName ? ` · ${row.submitterName}` : ""} · {new Date(row.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-navy">{row.title}</h2>
            <p className="mt-1 text-xs text-slate-500">{row.kind === "problem" ? "Problem report" : "Feature request"} · {IMPORTANCE_LABEL[row.importance]} · 👍 {row.votes} other {row.votes === 1 ? "centre" : "centres"}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-navy" aria-label="Close">✕</button>
        </div>

        <div className="mt-5 space-y-4">
          {block("The problem", row.problem)}
          {block(row.kind === "problem" ? "What should happen instead" : "What they'd change", row.change)}
          {block("Who it affects", row.whoAffected)}
          {block("How often", row.frequency)}
          {block("How they get round it today", row.workaround)}
          {block("Anything else", row.details)}
          {row.hasScreenshot ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Screenshot (private)</p>
              <a href={`/api/admin/feature-requests/${row.id}/screenshot`} target="_blank" rel="noreferrer" className="mt-1 block overflow-hidden rounded-lg border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/admin/feature-requests/${row.id}/screenshot`} alt="Screenshot sent with the request" className="block h-auto w-full" />
              </a>
            </div>
          ) : null}
        </div>

        <div className="mt-6 space-y-4 border-t border-slate-200 pt-5">
          <div>
            <label htmlFor="fr-stage" className="block text-sm font-medium text-navy">Stage</label>
            <select id="fr-stage" value={row.status} disabled={pending} onChange={(e) => onSave(row.id, { status: e.target.value }, { status: e.target.value as FeatureRequestStatus })} className={`mt-1 ${field}`}>
              {COLUMNS.map((c) => <option key={c.key} value={c.key}>{STATUS_INFO[c.key].label}</option>)}
            </select>
            <p className="mt-0.5 text-xs text-slate-500">Moving it emails the person who sent it. From In review on, the public title shows on every centre&rsquo;s board.</p>
          </div>

          <div>
            <label htmlFor="fr-public" className="block text-sm font-medium text-navy">Public title</label>
            <div className="mt-1 flex gap-2">
              <input id="fr-public" value={publicTitle} maxLength={120} onChange={(e) => setPublicTitle(e.target.value)} className={field} />
              <button type="button" disabled={pending || publicTitle.trim() === row.publicTitle} onClick={() => onSave(row.id, { publicTitle }, { publicTitle: publicTitle.trim() })} className="rounded-lg bg-teal px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">Save</button>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">The only text other centres see. Keep it short, general, and free of names or anything that identifies the centre.</p>
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={row.hidden} disabled={pending} onChange={(e) => onSave(row.id, { hidden: e.target.checked }, { hidden: e.target.checked })} className="mt-0.5 h-4 w-4 accent-teal" />
            <span>Keep off the public board <span className="text-slate-400">(a duplicate, or something only this centre needs)</span></span>
          </label>

          <div>
            <label htmlFor="fr-response" className="block text-sm font-medium text-navy">Note to the centre</label>
            <textarea id="fr-response" rows={3} value={response} onChange={(e) => setResponse(e.target.value)} className={`mt-1 ${field}`} placeholder="Shown only to this centre, under My requests. Useful for Not possible: say why." />
            <button type="button" disabled={pending || response.trim() === (row.responseToCentre ?? "")} onClick={() => onSave(row.id, { responseToCentre: response.trim() || null }, { responseToCentre: response.trim() || null })} className="mt-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50 disabled:opacity-50">Save note</button>
          </div>
        </div>
      </div>
    </div>
  );
}
