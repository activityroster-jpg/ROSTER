"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PIPELINE_COLUMNS, PIPELINE_META, PIPELINE_STAGES, SENT_AGE_META, VIBE_META, sentAgeTone, vibeOf, workingDaysSince, type PipelineStage } from "@/lib/marketing";
import { setProspectStageAction } from "@/app/admin/marketing/actions";

export interface PipelineTile {
  id: string;
  name: string;
  region: string;
  city: string;
  stage: PipelineStage;
  engaged: boolean;
  hasEmail: boolean;
  /** A letter or flyer was posted earlier (the older steps, shown as a chip). */
  letter: boolean;
  /** The day the booklet went (tiles in the Booklet column) or the email went (Email column), YYYY-MM-DD. */
  bookletSentOn: string | null;
  emailSentOn: string | null;
}

/** Tiles shown per column before "Show more": a couple of thousand centres sit in "No action". */
const CHUNK = 60;

/** "3 working days" with the green / orange / red tone, for a booklet or email sent on `sentOn`. */
function SentAge({ sentOn, today, what }: { sentOn: string; today: string; what: "Booklet" | "Email" }) {
  const days = workingDaysSince(sentOn, new Date(`${today}T12:00:00`));
  const meta = SENT_AGE_META[sentAgeTone(days)];
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${meta.chip}`} title={`${what} sent ${sentOn}. ${meta.hint}`}>
      {days === 0 ? `${what} sent today` : `${days} working day${days === 1 ? "" : "s"}`}
    </span>
  );
}

export function ProspectPipeline({ tiles: initial, today }: { tiles: PipelineTile[]; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Local copy so a dragged tile lands straight away; the server copy replaces it after each save.
  const [tiles, setTiles] = useState(initial);
  useEffect(() => setTiles(initial), [initial]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<PipelineStage | null>(null);
  const [query, setQuery] = useState("");
  const [showRejected, setShowRejected] = useState(false);
  const [shown, setShown] = useState<Record<PipelineStage, number>>(() => Object.fromEntries(PIPELINE_STAGES.map((s) => [s, CHUNK])) as Record<PipelineStage, number>);
  const [err, setErr] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => (q ? tiles.filter((t) => `${t.name} ${t.region} ${t.city}`.toLowerCase().includes(q)) : tiles), [tiles, q]);
  const byStage = useMemo(() => {
    const m = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, [] as PipelineTile[]])) as Record<PipelineStage, PipelineTile[]>;
    for (const t of visible) m[t.stage].push(t);
    // Oldest sent first in the booklet and email columns (the ones most overdue a follow-up at the top); engaged first elsewhere.
    for (const s of PIPELINE_STAGES) m[s].sort((a, b) => Number(b.engaged) - Number(a.engaged) || (a.bookletSentOn ?? a.emailSentOn ?? "").localeCompare(b.bookletSentOn ?? b.emailSentOn ?? "") || a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
    return m;
  }, [visible]);

  const move = (id: string, stage: PipelineStage) => {
    const t = tiles.find((x) => x.id === id);
    if (!t || t.stage === stage) return;
    const before = t.stage;
    setErr(null);
    // Dropped into Booklet or Email: the counter starts today until the server copy arrives.
    setTiles((list) => list.map((x) => (x.id === id ? { ...x, stage, bookletSentOn: stage === "booklet" ? today : null, emailSentOn: stage === "email" ? today : null } : x)));
    start(async () => {
      const r = await setProspectStageAction(id, stage);
      if (!r.ok) { setErr(`${t.name}: ${r.error ?? "couldn't move"}`); setTiles((list) => list.map((x) => (x.id === id ? { ...x, stage: before } : x))); }
      router.refresh();
    });
  };

  const dropProps = (stage: PipelineStage) => ({
    onDragOver: (e: React.DragEvent) => { if (dragId) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (overCol !== stage) setOverCol(stage); } },
    onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverCol(null); },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || dragId; setOverCol(null); setDragId(null); if (id) move(id, stage); },
  });

  const tile = (t: PipelineTile) => {
    const vibe = VIBE_META[vibeOf(t.stage, t.engaged) ?? "none"];
    const place = [t.region, t.city].filter(Boolean).join(" · ");
    return (
      <div
        key={t.id}
        draggable
        onDragStart={(e) => { e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; setDragId(t.id); }}
        onDragEnd={() => { setDragId(null); setOverCol(null); }}
        className={`group cursor-grab rounded-lg border border-slate-200 bg-white px-2.5 py-2 active:cursor-grabbing ${dragId === t.id ? "opacity-40" : ""}`}
      >
        <div className="flex items-start gap-2">
          <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${vibe.dot}`} title={vibe.label} />
          <div className="min-w-0 flex-1">
            <a href={`/admin/marketing/${t.id}`} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-navy hover:text-teal hover:underline" title={`${t.name} — opens their page in a new tab`}>{t.name}</a>
            {place ? <p className="truncate text-[11px] text-slate-400">{place}</p> : null}
          </div>
        </div>
        {t.bookletSentOn || t.emailSentOn || t.letter ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {t.bookletSentOn ? <SentAge sentOn={t.bookletSentOn} today={today} what="Booklet" /> : null}
            {t.emailSentOn ? <SentAge sentOn={t.emailSentOn} today={today} what="Email" /> : null}
            {t.letter ? <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500" title="A letter or flyer was posted earlier">Letter sent</span> : null}
          </div>
        ) : null}
        <select
          value={t.stage}
          disabled={pending}
          onChange={(e) => move(t.id, e.target.value as PipelineStage)}
          aria-label={`Move ${t.name} to`}
          className="mt-1.5 w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] text-slate-500 opacity-0 outline-none focus:opacity-100 focus:border-teal group-hover:opacity-100"
        >
          {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{s === t.stage ? "Move to…" : PIPELINE_META[s].label}</option>)}
        </select>
      </div>
    );
  };

  const rejected = byStage.rejected;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a centre, region or town…"
          aria-label="Find a centre"
          className="w-72 max-w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-teal"
        />
        <span className="text-xs text-slate-500">{visible.length === tiles.length ? `${tiles.length} centres` : `${visible.length} of ${tiles.length} centres`}</span>
        <button
          type="button"
          onClick={() => setShowRejected((v) => !v)}
          aria-expanded={showRejected}
          {...dropProps("rejected")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${showRejected ? "border-port bg-port/10 text-port" : "border-slate-300 bg-white text-slate-600 hover:border-port hover:text-port"} ${overCol === "rejected" ? "ring-2 ring-port/40" : ""}`}
          title="Who said no. Drop a centre here to mark it rejected."
        >
          {showRejected ? "Hide rejected" : "Rejected"} ({rejected.length})
        </button>
        <span className="ml-auto flex items-center gap-3 text-[11px] text-slate-500">
          {(["green", "orange", "red"] as const).map((v) => <span key={v} className="inline-flex items-center gap-1"><span className={`inline-block h-2 w-2 rounded-full ${VIBE_META[v].dot}`} />{VIBE_META[v].label}</span>)}
        </span>
        {pending ? <span className="text-xs text-slate-400">Saving…</span> : null}
        {err ? <span className="text-xs text-port">{err}</span> : null}
      </div>

      {showRejected ? (
        <section id="rejected" aria-label="Rejected" {...dropProps("rejected")} className={`mb-3 rounded-card border border-port/30 border-t-4 border-t-port p-2.5 ${overCol === "rejected" ? "bg-port/5 ring-2 ring-port/30" : "bg-white"}`}>
          <div className="mb-2 flex items-center justify-between px-0.5">
            <h2 className="font-display text-sm font-bold text-navy">Rejected</h2>
            <span className="text-xs text-slate-500">{rejected.length} centre{rejected.length === 1 ? "" : "s"} said no. Move one back with its dropdown if they change their mind.</span>
          </div>
          {rejected.length === 0 ? <p className="px-1 py-4 text-center text-xs text-slate-400">{q ? "No matches here." : "Nobody has said no yet."}</p> : (
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
              {rejected.slice(0, shown.rejected).map(tile)}
            </div>
          )}
          {rejected.length > shown.rejected ? (
            <button type="button" onClick={() => setShown((m) => ({ ...m, rejected: m.rejected + CHUNK * 2 }))} className="mt-2 w-full rounded-lg border border-dashed border-slate-300 py-1.5 text-xs font-medium text-slate-500 hover:border-teal hover:text-teal">
              Show more ({rejected.length - shown.rejected} hidden)
            </button>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {PIPELINE_COLUMNS.map((stage) => {
          const list = byStage[stage];
          const n = shown[stage];
          return (
            <section
              key={stage}
              id={stage}
              aria-label={PIPELINE_META[stage].label}
              {...dropProps(stage)}
              className={`flex min-h-[12rem] flex-col rounded-card border-t-4 ${PIPELINE_META[stage].accent} border-x border-b border-slate-200 p-2.5 transition-colors ${overCol === stage ? "bg-teal/5 ring-2 ring-teal/30" : "bg-slate-50/50"}`}
            >
              <div className="mb-2 flex items-center justify-between px-0.5">
                <h2 className="font-display text-sm font-bold text-navy">{PIPELINE_META[stage].label}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">{list.length}</span>
              </div>
              <div className="space-y-1.5">
                {list.length === 0 ? <p className="px-1 py-6 text-center text-xs text-slate-400">{q ? "No matches here." : "Nothing here."}</p> : list.slice(0, n).map(tile)}
                {list.length > n ? (
                  <button type="button" onClick={() => setShown((m) => ({ ...m, [stage]: m[stage] + CHUNK * 2 }))} className="w-full rounded-lg border border-dashed border-slate-300 py-1.5 text-xs font-medium text-slate-500 hover:border-teal hover:text-teal">
                    Show more ({list.length - n} hidden)
                  </button>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
