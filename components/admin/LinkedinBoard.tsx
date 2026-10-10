"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LINKEDIN_META, linkedinSearchUrls, type LinkedinContact } from "@/lib/marketing";
import { LINKEDIN_STATUSES, type LinkedinStatus } from "@/lib/db/schema";
import { addLinkedinContactAction, findLinkedinNowAction, removeLinkedinContactAction, setLinkedinPageAction, setLinkedinStatusAction } from "@/app/admin/marketing/actions";

export interface LinkedinRow {
  id: string;
  name: string;
  region: string;
  city: string;
  website: string;
  topRank: number | null;
  pageUrl: string;
  contacts: LinkedinContact[];
  status: LinkedinStatus;
  /** The finder has read their website. */
  checked: boolean;
}

const PAGE_SIZE = 150;
const ext = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
const field = "rounded border border-slate-300 px-1.5 py-0.5 text-[11px] outline-none focus:border-teal";

function ContactAdder({ id, onDone }: { id: string; onDone: (msg: string | null) => void }) {
  const [c, setC] = useState({ name: "", role: "", url: "" });
  const [pending, start] = useTransition();
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="Name" aria-label="Contact name" className={`${field} w-24`} />
      <input value={c.role} onChange={(e) => setC({ ...c, role: e.target.value })} placeholder="Role" aria-label="Contact role" className={`${field} w-24`} />
      <input value={c.url} onChange={(e) => setC({ ...c, url: e.target.value })} placeholder="linkedin.com/in/…" aria-label="LinkedIn profile link" className={`${field} w-36`} />
      <button type="button" disabled={pending || (!c.name.trim() && !c.url.trim())} onClick={() => start(async () => { const r = await addLinkedinContactAction(id, c); onDone(r.ok ? null : r.error ?? "Couldn't add"); if (r.ok) setC({ name: "", role: "", url: "" }); })}
        className="rounded bg-teal px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-teal-700 disabled:opacity-50">Add</button>
      <button type="button" onClick={() => onDone(null)} className="text-[11px] text-slate-400 hover:text-port">Cancel</button>
    </div>
  );
}

/**
 * The LinkedIn tab's table: one row per centre with its company page, contacts,
 * the tracker and search links. Filters and paging run over the whole list.
 */
export function LinkedinBoard({ rows: serverRows }: { rows: LinkedinRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState(serverRows);
  useEffect(() => setRows(serverRows), [serverRows]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [top, setTop] = useState("");
  const [has, setHas] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState<string | null>(null);
  const [editingPage, setEditingPage] = useState<string | null>(null);
  const [pageDraft, setPageDraft] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const kept = rows.filter((r) =>
      (!needle || `${r.name} ${r.region} ${r.city}`.toLowerCase().includes(needle)) &&
      (!status || r.status === status) &&
      (!top || r.topRank !== null) &&
      (!has || (has === "found" ? Boolean(r.pageUrl || r.contacts.length) : has === "none" ? !r.pageUrl && r.contacts.length === 0 : !r.checked && Boolean(r.website))));
    return [...kept].sort((a, b) => (top ? (a.topRank ?? 1e6) - (b.topRank ?? 1e6) : 0) || a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  }, [rows, q, status, top, has]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { setPage(1); }, [q, status, top, has]);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const save = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, optimistic?: () => void) => {
    optimistic?.();
    setMsg(null);
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? r.message ?? null : r.error ?? "Couldn't save");
      router.refresh();
    });
  };

  const setTracker = (r: LinkedinRow, s: LinkedinStatus) => save(() => setLinkedinStatusAction(r.id, s), () => setRows((list) => list.map((x) => (x.id === r.id ? { ...x, status: s } : x))));

  return (
    <div className="rounded-card border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a centre, region or town…" aria-label="Find a centre" className="w-60 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-teal" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Tracker filter" className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
          <option value="">Any status</option>
          {LINKEDIN_STATUSES.map((s) => <option key={s} value={s}>{LINKEDIN_META[s].label}</option>)}
        </select>
        <select value={top} onChange={(e) => setTop(e.target.value)} aria-label="Top 250 filter" className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
          <option value="">All centres</option>
          <option value="top">Top 250 (biggest)</option>
        </select>
        <select value={has} onChange={(e) => setHas(e.target.value)} aria-label="LinkedIn found filter" className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
          <option value="">Found or not</option>
          <option value="found">LinkedIn found</option>
          <option value="none">Nothing found yet</option>
          <option value="unchecked">Website not read yet</option>
        </select>
        <span className="text-xs text-slate-500">{filtered.length} of {rows.length}</span>
        <span className="ml-auto flex items-center gap-2">
          {msg ? <span className="text-xs text-slate-500">{msg}</span> : null}
          {pending ? <span className="text-xs text-slate-400">Saving…</span> : null}
          <button type="button" disabled={pending} onClick={() => save(() => findLinkedinNowAction())} className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50" title="Read the next 15 centres' websites now (the finder also runs by itself every hour)">
            🔎 Find on websites now
          </button>
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-xs">
          <thead className="bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-[24%] px-2 py-1.5">Centre / club</th>
              <th className="w-[16%] px-2 py-1.5">LinkedIn page</th>
              <th className="w-[30%] px-2 py-1.5">Contacts on LinkedIn</th>
              <th className="w-[16%] px-2 py-1.5">Status</th>
              <th className="w-[14%] px-2 py-1.5">Search LinkedIn</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No centres match.</td></tr> : visible.map((r) => {
              const search = linkedinSearchUrls(r.name);
              return (
                <tr key={r.id} className="align-top hover:bg-slate-50/60">
                  <td className="px-2 py-1.5">
                    {r.topRank !== null ? <span className="mr-1 rounded bg-navy/10 px-1 py-px text-[9px] font-bold text-navy" title="Top 250 by estimated size">#{r.topRank}</span> : null}
                    <a href={`/admin/marketing/${r.id}`} target="_blank" rel="noreferrer" className="font-medium text-navy hover:text-teal hover:underline">{r.name}</a>
                    <p className="text-[10px] text-slate-400">{[r.region, r.city].filter(Boolean).join(" · ")}{r.website ? <> · <span title={r.checked ? "The finder has read their website" : "The finder hasn't read their website yet"}>{r.checked ? "website read" : "website not read yet"}</span></> : " · no website"}</p>
                  </td>
                  <td className="px-2 py-1.5">
                    {editingPage === r.id ? (
                      <span className="flex items-center gap-1">
                        <input autoFocus value={pageDraft} onChange={(e) => setPageDraft(e.target.value)} placeholder="linkedin.com/company/…" aria-label="LinkedIn page" className={`${field} w-36`}
                          onKeyDown={(e) => { if (e.key === "Enter") { setEditingPage(null); save(() => setLinkedinPageAction(r.id, pageDraft)); } if (e.key === "Escape") setEditingPage(null); }} />
                        <button type="button" onClick={() => { setEditingPage(null); save(() => setLinkedinPageAction(r.id, pageDraft)); }} className="text-[11px] font-semibold text-teal">Save</button>
                      </span>
                    ) : r.pageUrl ? (
                      <span className="flex items-center gap-1.5">
                        <a href={ext(r.pageUrl)} target="_blank" rel="noreferrer" className="truncate text-teal hover:underline" title={r.pageUrl}>Company page ↗</a>
                        <button type="button" onClick={() => { setEditingPage(r.id); setPageDraft(r.pageUrl); }} className="text-[10px] text-slate-400 hover:text-teal">edit</button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => { setEditingPage(r.id); setPageDraft(""); }} className="rounded border border-dashed border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-400 hover:border-teal hover:text-teal">+ page</button>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {r.contacts.length ? (
                      <ul className="space-y-0.5">
                        {r.contacts.map((c, i) => (
                          <li key={`${c.url}-${i}`} className="flex items-center gap-1">
                            {c.url ? <a href={ext(c.url)} target="_blank" rel="noreferrer" className="font-medium text-navy hover:text-teal hover:underline">{c.name || "Profile"}</a> : <span className="font-medium text-navy">{c.name}</span>}
                            {c.role ? <span className="text-slate-400">· {c.role}</span> : null}
                            <button type="button" aria-label={`Remove ${c.name || "contact"}`} onClick={() => save(() => removeLinkedinContactAction(r.id, i))} className="ml-0.5 text-slate-300 hover:text-port">✕</button>
                          </li>
                        ))}
                      </ul>
                    ) : <span className="text-slate-300">None yet</span>}
                    {adding === r.id
                      ? <ContactAdder id={r.id} onDone={(m) => { setAdding(null); setMsg(m); router.refresh(); }} />
                      : <button type="button" onClick={() => setAdding(r.id)} className="mt-0.5 block text-[10px] font-medium text-teal hover:underline">+ add contact</button>}
                  </td>
                  <td className="px-2 py-1.5">
                    <select value={r.status} onChange={(e) => setTracker(r, e.target.value as LinkedinStatus)} aria-label={`LinkedIn status for ${r.name}`}
                      className={`w-full cursor-pointer rounded border border-transparent px-1 py-0.5 text-[11px] font-semibold outline-none hover:border-slate-300 focus:border-teal ${LINKEDIN_META[r.status].chip}`}>
                      {LINKEDIN_STATUSES.map((s) => <option key={s} value={s}>{LINKEDIN_META[s].label}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <a href={search.people} target="_blank" rel="noreferrer" className="block text-teal hover:underline">People ↗</a>
                    <a href={search.companies} target="_blank" rel="noreferrer" className="block text-teal hover:underline">Company ↗</a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <div className="flex items-center justify-center gap-2 border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded border border-slate-300 px-2 py-0.5 font-medium text-navy disabled:opacity-40">←</button>
          Page {page} of {pages}
          <button type="button" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="rounded border border-slate-300 px-2 py-0.5 font-medium text-navy disabled:opacity-40">→</button>
        </div>
      ) : null}
    </div>
  );
}
