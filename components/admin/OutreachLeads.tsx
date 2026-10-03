"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { previewLeadEmailAction, researchLeadAction, setLeadContactAction, setLeadStatusAction, type OutreachResult } from "@/app/admin/outreach/actions";
import type { OutreachLeadStatus } from "@/lib/db/schema";

export interface LeadRow {
  id: string; centreName: string; website: string | null; region: string | null; email: string | null; emailVerified: boolean;
  contactName: string | null; contactRole: string | null; status: OutreachLeadStatus; stepIndex: number; nextSendAt: string | null;
  error: string | null; hooks: string[]; summary: string | null; chosenReason: string | null;
  messages: { step: number; subject: string; status: string; sentAt: string; bodyText: string }[];
}

export const LEAD_STATUS_META: Record<OutreachLeadStatus, { label: string; cls: string }> = {
  new: { label: "To research", cls: "bg-slate-100 text-slate-600" },
  no_email: { label: "No address", cls: "bg-amber-50 text-amber-700" },
  queued: { label: "Queued", cls: "bg-sky-50 text-sky-700" },
  sending: { label: "Sending", cls: "bg-sky-50 text-sky-700" },
  in_sequence: { label: "In sequence", cls: "bg-teal/10 text-teal-700" },
  completed: { label: "Sequence done", cls: "bg-slate-100 text-slate-600" },
  replied: { label: "Replied", cls: "bg-emerald-50 text-emerald-700" },
  booked: { label: "Booked", cls: "bg-emerald-100 text-emerald-800" },
  bounced: { label: "Bounced", cls: "bg-red-50 text-red-700" },
  opted_out: { label: "Opted out", cls: "bg-red-50 text-red-700" },
  skipped: { label: "Skipped", cls: "bg-slate-100 text-slate-500" },
  failed: { label: "Failed", cls: "bg-red-50 text-red-700" },
};

const FILTERS: { key: string; label: string; statuses: OutreachLeadStatus[] }[] = [
  { key: "all", label: "All", statuses: [] },
  { key: "attention", label: "Needs you", statuses: ["no_email", "failed", "replied"] },
  { key: "active", label: "Active", statuses: ["new", "queued", "sending", "in_sequence"] },
  { key: "done", label: "Done", statuses: ["completed", "booked", "bounced", "opted_out", "skipped"] },
];

export function OutreachLeads({ leads, steps }: { leads: LeadRow[]; steps: number }) {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Record<string, OutreachResult | undefined>>({});
  const [preview, setPreview] = useState<Record<string, { subject: string; text: string; usedAi: boolean } | undefined>>({});
  const [edit, setEdit] = useState<Record<string, { email: string; contactName: string; contactRole: string } | undefined>>({});

  const act = (id: string, fn: () => Promise<OutreachResult>) => start(async () => { const r = await fn(); setMsg((m) => ({ ...m, [id]: r })); if (r.ok) router.refresh(); });
  const f = FILTERS.find((x) => x.key === filter)!;
  const shown = leads.filter((l) => (!f.statuses.length || f.statuses.includes(l.status)) && (!q || `${l.centreName} ${l.email ?? ""} ${l.contactName ?? ""} ${l.region ?? ""}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-200 p-0.5">
          {FILTERS.map((x) => <button key={x.key} onClick={() => setFilter(x.key)} className={`rounded-md px-3 py-1 text-sm font-medium ${filter === x.key ? "bg-navy text-white" : "text-slate-500 hover:text-navy"}`}>{x.label}{x.statuses.length ? ` (${leads.filter((l) => x.statuses.includes(l.status)).length})` : ` (${leads.length})`}</button>)}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search centres…" className="ml-auto rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-teal" />
      </div>
      {shown.length === 0 ? <p className="rounded-card border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Nothing here.</p> : null}
      <ul className="space-y-2">
        {shown.map((l) => {
          const meta = LEAD_STATUS_META[l.status];
          const isOpen = open === l.id;
          const e = edit[l.id];
          const m = msg[l.id];
          const pv = preview[l.id];
          const canQueue = ["no_email", "failed", "skipped", "bounced"].includes(l.status);
          return (
            <li key={l.id} className="rounded-card border border-slate-200 bg-white">
              <button onClick={() => setOpen(isOpen ? null : l.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>
                <span className="font-semibold text-navy">{l.centreName}</span>
                {l.region ? <span className="text-xs text-slate-400">{l.region}</span> : null}
                <span className="ml-auto text-xs text-slate-500">{l.contactName ? `${l.contactName}${l.contactRole ? `, ${l.contactRole}` : ""} · ` : ""}{l.email ?? "no address"}{l.email && !l.emailVerified ? " (unverified)" : ""}</span>
                <span className="text-xs text-slate-400">step {Math.min(l.stepIndex + (l.status === "in_sequence" || l.status === "queued" ? 1 : 0), steps)}/{steps}{l.nextSendAt && (l.status === "in_sequence" || l.status === "queued") ? ` · next ${new Date(l.nextSendAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}</span>
              </button>
              {isOpen ? (
                <div className="border-t border-slate-100 px-4 py-3 text-sm">
                  {l.error ? <p className="mb-2 text-port">{l.error}</p> : null}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">What the agent found</p>
                      {l.website ? <p className="mt-1"><a href={l.website.startsWith("http") ? l.website : `https://${l.website}`} target="_blank" rel="noreferrer" className="text-teal hover:underline">{l.website}</a></p> : <p className="mt-1 text-slate-400">No website on file.</p>}
                      {l.summary ? <p className="mt-1 text-slate-700">{l.summary}</p> : null}
                      {l.hooks.length ? <ul className="mt-1 list-disc pl-5 text-slate-600">{l.hooks.map((h) => <li key={h}>{h}</li>)}</ul> : null}
                      {l.chosenReason ? <p className="mt-1 text-xs text-slate-500">Address choice: {l.chosenReason}</p> : null}
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Contact</p>
                        {e ? (
                          <div className="mt-1 grid gap-2">
                            <input value={e.email} onChange={(ev) => setEdit((s) => ({ ...s, [l.id]: { ...e, email: ev.target.value } }))} placeholder="email@centre.co.uk" className="rounded-lg border border-slate-300 px-3 py-1.5" />
                            <div className="grid grid-cols-2 gap-2">
                              <input value={e.contactName} onChange={(ev) => setEdit((s) => ({ ...s, [l.id]: { ...e, contactName: ev.target.value } }))} placeholder="Name" className="rounded-lg border border-slate-300 px-3 py-1.5" />
                              <input value={e.contactRole} onChange={(ev) => setEdit((s) => ({ ...s, [l.id]: { ...e, contactRole: ev.target.value } }))} placeholder="Role" className="rounded-lg border border-slate-300 px-3 py-1.5" />
                            </div>
                            <div className="flex gap-2">
                              <button disabled={pending} onClick={() => act(l.id, async () => { const r = await setLeadContactAction(l.id, e); if (r.ok) setEdit((s) => ({ ...s, [l.id]: undefined })); return r; })} className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white">Save &amp; queue</button>
                              <button onClick={() => setEdit((s) => ({ ...s, [l.id]: undefined }))} className="text-xs text-slate-500">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-1 text-slate-700">{l.contactName ?? "Unknown name"}{l.contactRole ? `, ${l.contactRole}` : ""} · {l.email ?? "no address"} <button onClick={() => setEdit((s) => ({ ...s, [l.id]: { email: l.email ?? "", contactName: l.contactName ?? "", contactRole: l.contactRole ?? "" } }))} className="ml-1 text-xs font-semibold text-teal hover:underline">Edit</button></p>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Emails sent</p>
                      {l.messages.length === 0 ? <p className="mt-1 text-slate-400">None yet.</p> : (
                        <ul className="mt-1 space-y-2">
                          {l.messages.map((mm) => (
                            <li key={`${mm.step}-${mm.sentAt}`} className="rounded-lg bg-slate-50 p-2">
                              <p className="text-xs text-slate-500">Step {mm.step + 1} · {new Date(mm.sentAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {mm.status}</p>
                              <p className="font-medium text-navy">{mm.subject}</p>
                              <details className="text-xs text-slate-600"><summary className="cursor-pointer">Show text</summary><pre className="mt-1 whitespace-pre-wrap font-sans">{mm.bodyText}</pre></details>
                            </li>
                          ))}
                        </ul>
                      )}
                      {pv ? (
                        <div className="mt-2 rounded-lg border border-teal/30 bg-teal/5 p-2">
                          <p className="text-xs text-slate-500">Preview of the next email{pv.usedAi ? " (AI-personalised)" : " (template)"}</p>
                          <p className="font-medium text-navy">{pv.subject}</p>
                          <pre className="mt-1 whitespace-pre-wrap font-sans text-xs text-slate-700">{pv.text}</pre>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button disabled={pending} onClick={() => act(l.id, () => researchLeadAction(l.id))} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">Research again</button>
                    {l.email && l.stepIndex < steps ? <button disabled={pending} onClick={() => start(async () => { const r = await previewLeadEmailAction(l.id); if (r.ok) setPreview((s) => ({ ...s, [l.id]: { subject: r.subject!, text: r.text!, usedAi: !!r.usedAi } })); else setMsg((s) => ({ ...s, [l.id]: { ok: false, error: r.error } })); })} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">Preview next email</button> : null}
                    {canQueue && l.email ? <button disabled={pending} onClick={() => act(l.id, () => setLeadStatusAction(l.id, "queued"))} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">Queue</button> : null}
                    {["new", "no_email", "queued", "in_sequence", "failed"].includes(l.status) ? <button disabled={pending} onClick={() => act(l.id, () => setLeadStatusAction(l.id, "skipped"))} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Skip</button> : null}
                    {l.status !== "replied" && l.status !== "booked" ? <button disabled={pending} onClick={() => act(l.id, () => setLeadStatusAction(l.id, "replied"))} className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">They replied</button> : null}
                    {l.status !== "booked" ? <button disabled={pending} onClick={() => act(l.id, () => setLeadStatusAction(l.id, "booked"))} className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Booked a demo</button> : null}
                    {m ? <span className={`self-center text-xs ${m.ok ? "text-starboard" : "text-port"}`}>{m.ok ? m.message : m.error}</span> : null}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
