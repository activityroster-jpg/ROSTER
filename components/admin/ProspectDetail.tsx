"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PIPELINE_META,
  PIPELINE_STAGES,
  PROSPECT_STATUS_META,
  VIBE_META,
  addressComplete,
  draftProspectEmail,
  vibeOf,
  type PipelineStage,
} from "@/lib/marketing";
import type { ProspectInteractionKind, ProspectStatus } from "@/lib/db/schema";
import {
  addInteractionAction,
  deleteInteractionAction,
  setEngagedAction,
  setProspectBasisAction,
  setProspectStageAction,
  updateProspectAction,
} from "@/app/admin/marketing/actions";

export interface ProspectDetailData {
  id: string;
  name: string;
  region: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
  email: string;
  website: string;
  linkedinUrl: string;
  contactName: string;
  contactRole: string;
  notes: string;
  basisNote: string;
  statuses: ProspectStatus[];
  stage: PipelineStage;
  engagedAt: number | null;
  source: string;
  soleTrader: boolean;
  lawfulBasis: string;
  createdAt: number;
  updatedAt: number;
}

export interface InteractionRow {
  id: string;
  kind: ProspectInteractionKind;
  occurredOn: string;
  summary: string | null;
  author: string | null;
  createdAt: number;
}

/** How each kind of log entry is shown, and what logging it does besides. */
const KIND_META: Record<ProspectInteractionKind, { label: string; icon: string; effect?: string }> = {
  letter_sent: { label: "Letter sent", icon: "✉", effect: "ticks Letter sent" },
  email_out: { label: "Email sent", icon: "📧", effect: "ticks Email sent" },
  email_in: { label: "Email received", icon: "📨", effect: "marks them engaged" },
  linkedin_out: { label: "LinkedIn message sent", icon: "in", effect: "ticks LinkedIn contacted" },
  linkedin_in: { label: "LinkedIn reply", icon: "in", effect: "marks them engaged" },
  call: { label: "Phone call", icon: "📞", effect: "ticks Called" },
  meeting: { label: "Meeting / demo", icon: "🤝", effect: "marks them engaged" },
  note: { label: "Note", icon: "📝" },
  stage: { label: "Stage changed", icon: "→" },
};
const LOGGABLE = (Object.keys(KIND_META) as ProspectInteractionKind[]).filter((k) => k !== "stage");

const FIELDS: { key: keyof ProspectDetailData; label: string; wide?: boolean; type?: string }[] = [
  { key: "name", label: "Centre / club name", wide: true },
  { key: "region", label: "Region" },
  { key: "contactName", label: "Contact name" },
  { key: "contactRole", label: "Role (Principal / Owner)" },
  { key: "email", label: "Email", type: "email" },
  { key: "addressLine1", label: "Address line 1" },
  { key: "addressLine2", label: "Address line 2" },
  { key: "city", label: "City / town" },
  { key: "postcode", label: "Postcode" },
  { key: "country", label: "Country" },
  { key: "website", label: "Website" },
  { key: "linkedinUrl", label: "LinkedIn URL", wide: true },
];
type Draft = Record<(typeof FIELDS)[number]["key"] | "notes", string>;
const toDraft = (p: ProspectDetailData): Draft => {
  const d = {} as Draft;
  for (const f of FIELDS) d[f.key] = String(p[f.key] ?? "");
  d.notes = p.notes;
  return d;
};

const today = () => new Date().toISOString().slice(0, 10);
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtWhen = (ms: number) => new Date(ms).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
const external = (url: string) => (url.startsWith("http") ? url : `https://${url}`);

export function ProspectDetail({ prospect: p, interactions }: { prospect: ProspectDetailData; interactions: InteractionRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft>(() => toDraft(p));
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [kind, setKind] = useState<ProspectInteractionKind>("note");
  const [when, setWhen] = useState(today);
  const [summary, setSummary] = useState("");
  const [logMsg, setLogMsg] = useState<string | null>(null);
  const [basisNote, setBasisNote] = useState(p.basisNote);

  // Fresh server data (after a save or a log entry) replaces the form unless it is mid-edit.
  useEffect(() => { if (!dirty) setDraft(toDraft(p)); setBasisNote(p.basisNote); }, [p, dirty]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, onOk?: (m?: string) => void, onErr?: (e: string) => void) => {
    start(async () => {
      const r = await fn();
      if (r.ok) { onOk?.(r.message); router.refresh(); } else onErr?.(r.error ?? "Something went wrong");
    });
  };

  const save = () => run(
    () => updateProspectAction(p.id, draft),
    () => { setDirty(false); setMsg({ ok: true, text: "Saved" }); },
    (e) => setMsg({ ok: false, text: e }),
  );
  const addEntry = () => {
    if (!summary.trim() && kind === "note") { setLogMsg("Write the note first."); return; }
    run(
      () => addInteractionAction(p.id, { kind, occurredOn: when, summary }),
      () => { setSummary(""); setKind("note"); setWhen(today()); setLogMsg(null); },
      setLogMsg,
    );
  };
  const removeEntry = (id: string) => { if (confirm("Remove this entry from the log?")) run(() => deleteInteractionAction(p.id, id), undefined, setLogMsg); };

  const vibe = VIBE_META[vibeOf(p.stage, Boolean(p.engagedAt)) ?? "none"];
  const complete = addressComplete(p);
  const gmail = () => { const { subject, body } = draftProspectEmail(p, { signature: false }); return `https://mail.google.com/mail/?${new URLSearchParams({ view: "cm", fs: "1", to: p.email, su: subject, body })}`; };
  const mailto = () => { const { subject, body } = draftProspectEmail(p); return `mailto:${encodeURIComponent(p.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; };
  const touchpoints = p.statuses.filter((s) => s !== "new");

  const input = "w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-teal";
  const label = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500";
  const linkBtn = "inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-navy hover:border-teal hover:text-teal";

  return (
    <div className="space-y-5">
      <p className="flex flex-wrap gap-x-3 text-xs text-slate-500">
        <a href="/admin/marketing" className="text-teal hover:underline">← All prospects</a>
        <a href="/admin/marketing/pipeline" className="text-teal hover:underline">Pipeline board</a>
      </p>

      {/* Header: who they are, where they are in the pipeline, what you can do */}
      <div className="rounded-card border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-3.5 w-3.5 shrink-0 rounded-full ${vibe.dot}`} title={`Vibe: ${vibe.label}`} />
              <h1 className="font-display text-2xl font-bold text-navy">{p.name}</h1>
              {p.source === "sample" ? <span className="rounded bg-amber/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber">sample</span> : null}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {[p.region, [p.city, p.postcode].filter(Boolean).join(" ")].filter(Boolean).join(" · ") || "No location on file"}
              {p.contactName ? <> · {p.contactName}{p.contactRole ? ` (${p.contactRole})` : ""}</> : null}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Added {fmtWhen(p.createdAt)} · {p.source.replace(/_/g, " ")}
              {touchpoints.length ? <> · Touchpoints: {touchpoints.map((s) => PROSPECT_STATUS_META[s].label).join(", ")}</> : null}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
              Stage
              <select
                value={p.stage}
                disabled={pending}
                onChange={(e) => run(() => setProspectStageAction(p.id, e.target.value as PipelineStage), undefined, (er) => setMsg({ ok: false, text: er }))}
                className={`rounded-lg border border-transparent px-2 py-1 text-sm font-semibold outline-none hover:border-slate-300 focus:border-teal ${PIPELINE_META[p.stage].chip}`}
              >
                {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{PIPELINE_META[s].label}</option>)}
              </select>
            </label>
            {p.stage !== "signed_up" && p.stage !== "rejected" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => setEngagedAction(p.id, !p.engagedAt))}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${p.engagedAt ? "bg-amber/15 text-amber hover:bg-amber/25" : "border border-slate-200 text-slate-500 hover:border-amber hover:text-amber"}`}
                title={p.engagedAt ? `Engaged since ${fmtWhen(p.engagedAt)}. Click to clear.` : "They replied, met you or asked for more"}
              >
                {p.engagedAt ? "● Engaged" : "○ Mark as engaged"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {p.email ? <a href={gmail()} target="_blank" rel="noreferrer" className={linkBtn}>📧 Draft in Gmail</a> : <span className={`${linkBtn} cursor-not-allowed text-slate-300`}>📧 No email on file</span>}
          {p.email ? <a href={mailto()} className={linkBtn}>✉️ Draft in mail app</a> : null}
          {complete ? <a href={`/admin/marketing/${p.id}/letter`} target="_blank" rel="noreferrer" className={linkBtn}>✉ Letter</a> : <span className={`${linkBtn} cursor-not-allowed text-slate-300`} title="Add street, town and postcode first">✉ Letter (address incomplete)</span>}
          <a href={`/admin/marketing/${p.id}/mockup`} target="_blank" rel="noreferrer" className={linkBtn}>📄 Mock-up PDF</a>
          {p.website ? <a href={external(p.website)} target="_blank" rel="noreferrer" className={linkBtn}>Website ↗</a> : null}
          {p.linkedinUrl ? <a href={external(p.linkedinUrl)} target="_blank" rel="noreferrer" className={linkBtn}>LinkedIn ↗</a> : null}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Gmail drafts leave the signature off so it is not doubled: set the logo signature once in Gmail (Settings → See all settings → Signature → insert image → paste <span className="font-mono">https://activityroster.com/brand/email-signature.png</span>) and Gmail adds it to every email. The mail-app draft carries the text version.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Details */}
        <div className="rounded-card border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-display text-base font-bold text-navy">Details</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key} className={f.wide ? "sm:col-span-2" : ""}>
                <label htmlFor={`f-${f.key}`} className={label}>{f.label}</label>
                <input id={`f-${f.key}`} type={f.type ?? "text"} value={draft[f.key]} onChange={(e) => { setDraft((d) => ({ ...d, [f.key]: e.target.value })); setDirty(true); setMsg(null); }} className={input} />
              </div>
            ))}
            <div className="sm:col-span-2">
              <label htmlFor="f-notes" className={label}>Notes</label>
              <textarea id="f-notes" rows={5} value={draft.notes} onChange={(e) => { setDraft((d) => ({ ...d, notes: e.target.value })); setDirty(true); setMsg(null); }} placeholder="Anything worth remembering: who runs it, what they said, best time to call…" className={input} />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" onClick={save} disabled={pending || !dirty} className="rounded-lg bg-teal px-4 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">Save details</button>
            {dirty ? <button type="button" onClick={() => { setDraft(toDraft(p)); setDirty(false); setMsg(null); }} className="text-xs text-slate-500 hover:underline">Discard changes</button> : null}
            {msg ? <span className={`text-xs ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</span> : null}
          </div>

          <h3 className="mb-2 mt-6 text-sm font-semibold text-navy">Lawful basis</h3>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={p.soleTrader} disabled={pending} onChange={(e) => run(() => setProspectBasisAction(p.id, { soleTrader: e.target.checked, lawfulBasis: p.lawfulBasis, basisNote }))} className="h-4 w-4 rounded border-slate-300 text-teal" />
              Sole trader / individual
            </label>
            <select value={p.lawfulBasis} disabled={pending} onChange={(e) => run(() => setProspectBasisAction(p.id, { soleTrader: p.soleTrader, lawfulBasis: e.target.value, basisNote }))} className="rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-teal">
              <option value="legitimate_interests">Legitimate interests (a business)</option>
              <option value="consent">Consent given</option>
              <option value="existing_customer">Existing customer</option>
            </select>
          </div>
          <input value={basisNote} onChange={(e) => setBasisNote(e.target.value)} onBlur={() => { if (basisNote !== p.basisNote) run(() => setProspectBasisAction(p.id, { soleTrader: p.soleTrader, lawfulBasis: p.lawfulBasis, basisNote })); }} placeholder="Where consent came from, or why they count as a business (optional)" className={`${input} mt-2`} maxLength={200} />
          {p.soleTrader && p.lawfulBasis !== "consent" ? <p className="mt-1 text-xs text-port">Sole traders count as individuals under PECR: no marketing email without consent. Letters and LinkedIn are fine.</p> : null}
        </div>

        {/* Log */}
        <div className="rounded-card border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 font-display text-base font-bold text-navy">Contact log</h2>
          <p className="mb-3 text-xs text-slate-500">Every letter, email, LinkedIn message, call and note, newest first. Stage changes are added automatically.</p>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_9.5rem]">
              <select value={kind} onChange={(e) => setKind(e.target.value as ProspectInteractionKind)} className={input} aria-label="What happened">
                {LOGGABLE.map((k) => <option key={k} value={k}>{KIND_META[k].label}</option>)}
              </select>
              <input type="date" value={when} max={today()} onChange={(e) => setWhen(e.target.value)} className={input} aria-label="When" />
            </div>
            <textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={kind === "note" ? "The note…" : "What was said or sent (optional)"} className={`${input} mt-2`} maxLength={2000} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addEntry(); }} />
            <div className="mt-2 flex items-center gap-3">
              <button type="button" onClick={addEntry} disabled={pending} className="rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50">Add to log</button>
              {KIND_META[kind].effect ? <span className="text-[11px] text-slate-400">Also {KIND_META[kind].effect}.</span> : null}
              {logMsg ? <span className="text-xs text-port">{logMsg}</span> : null}
            </div>
          </div>

          {interactions.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">Nothing logged yet.</p>
          ) : (
            <ol className="mt-4 space-y-2">
              {interactions.map((i) => {
                const m = KIND_META[i.kind];
                return (
                  <li key={i.id} className="flex gap-3 rounded-lg border border-slate-100 px-3 py-2">
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${i.kind === "stage" ? "bg-slate-100 text-slate-500" : i.kind.endsWith("_in") || i.kind === "meeting" ? "bg-amber/15 text-amber" : "bg-teal/10 text-teal"}`} aria-hidden>{m.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-navy"><span className="font-semibold">{m.label}</span>{i.summary ? <span className="text-slate-600"> — {i.summary}</span> : null}</p>
                      <p className="text-[11px] text-slate-400">{fmtDay(i.occurredOn)}{i.author ? ` · ${i.author}` : " · automatic"}</p>
                    </div>
                    <button type="button" onClick={() => removeEntry(i.id)} disabled={pending} className="self-start text-slate-300 hover:text-port" title="Remove this entry" aria-label="Remove this entry">✕</button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
