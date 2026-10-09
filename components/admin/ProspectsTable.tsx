"use client";

import { askConfirm } from "@/lib/ui/ask-confirm";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PIPELINE_META,
  PIPELINE_STAGES,
  VIBE_META,
  addressComplete,
  draftProspectEmail,
  stageRank,
  vibeOf,
  type PipelineStage,
} from "@/lib/marketing";
import { deleteProspectAction, prepareNextLettersAction, setProspectStageAction, setProspectBasisAction } from "@/app/admin/marketing/actions";
import type { ProspectStatus } from "@/lib/db/schema";

export interface ProspectRow {
  id: string;
  name: string;
  region: string;
  addressLine1: string;
  city: string;
  postcode: string;
  email: string;
  website: string;
  linkedinUrl: string;
  contactName: string;
  contactRole: string;
  statuses: ProspectStatus[];
  /** One of the five pipeline stages, worked out from `statuses` (lib/marketing stageOf). */
  stage: PipelineStage;
  /** They replied, met us or asked for more: the orange vibe. */
  engaged: boolean;
  source: string;
  soleTrader: boolean;
  lawfulBasis: string;
  /** Epoch ms — "Added" sort. */
  createdAt: number;
}

type Filters = { name: string; region: string; email: string; contact: string; status: string };
const EMPTY: Filters = { name: "", region: "", email: "", contact: "", status: "" };

type SortKey = "name" | "region" | "email" | "addr" | "vibe" | "status" | "added";
type Sort = { key: SortKey; dir: "asc" | "desc" };
/** First click on a column: text columns A→Z, the rest "most useful first". */
const DEFAULT_DIR: Record<SortKey, Sort["dir"]> = { name: "asc", region: "asc", email: "asc", addr: "desc", vibe: "desc", status: "desc", added: "desc" };
/** Vibe order for sorting: signed up, then engaged, then quiet, then rejected. */
const VIBE_RANK = { green: 3, orange: 2, none: 1, red: 0 } as const;

const PAGE_SIZE = 200;

const mailtoHref = (r: ProspectRow) => {
  const { subject, body } = draftProspectEmail(r);
  return `mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};
/**
 * Opens the same draft in Gmail in a new tab. A plain mailto link does nothing
 * useful in browsers with no mail app set up (Arc just copies the address), and
 * Conor's outreach mail goes out through Gmail ("send as" the domain). The text
 * signature is left off: a compose link can only carry plain text, so the logo
 * signature comes from Gmail's own signature setting (see the prospect page).
 */
const gmailHref = (r: ProspectRow) => {
  const { subject, body } = draftProspectEmail(r, { signature: false });
  const q = new URLSearchParams({ view: "cm", fs: "1", to: r.email, su: subject, body });
  return `https://mail.google.com/mail/?${q.toString()}`;
};
const linkedinHref = (url: string) => (url.startsWith("http") ? url : `https://${url}`);
const cmp = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });

/** Order rows by a column. Pure, so it can be unit-tested. */
export function sortProspects(rows: ProspectRow[], sort: Sort | null): ProspectRow[] {
  if (!sort) return rows;
  const sign = sort.dir === "asc" ? 1 : -1;
  const by: Record<SortKey, (a: ProspectRow, b: ProspectRow) => number> = {
    name: (a, b) => cmp(a.name, b.name),
    region: (a, b) => cmp(a.region, b.region) || cmp(a.name, b.name),
    email: (a, b) => cmp(a.email, b.email) || cmp(a.name, b.name),
    addr: (a, b) => Number(addressComplete(a)) - Number(addressComplete(b)) || cmp(a.name, b.name),
    vibe: (a, b) => VIBE_RANK[vibeOf(a.stage, a.engaged) ?? "none"] - VIBE_RANK[vibeOf(b.stage, b.engaged) ?? "none"] || cmp(a.name, b.name),
    status: (a, b) => stageRank(a.stage) - stageRank(b.stage) || cmp(a.name, b.name),
    added: (a, b) => a.createdAt - b.createdAt || cmp(a.name, b.name),
  };
  const f = by[sort.key];
  return [...rows].sort((a, b) => sign * f(a, b));
}

/**
 * Compact prospect list: one line per centre. Every column filters and sorts
 * across the WHOLE list (the server hands over every prospect); the table pages
 * on the client. The centre name opens its own page (details and the contact
 * log) in a new tab; Status is the five pipeline stages, the same ones the
 * board uses; Vibe is the red/orange/green dot. "Download next 10 letters"
 * reserves the next unsent centres with a full address, marks them Letter
 * sent, and opens them as one printable batch.
 */
export function ProspectsTable({ rows: serverRows }: { rows: ProspectRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // A stage change shows at once; the server copy replaces it after the refresh.
  const [stageOverride, setStageOverride] = useState<Record<string, PipelineStage>>({});
  useEffect(() => { setStageOverride({}); }, [serverRows]);
  const rows = useMemo(() => serverRows.map((r) => (stageOverride[r.id] && stageOverride[r.id] !== r.stage ? { ...r, stage: stageOverride[r.id]! } : r)), [serverRows, stageOverride]);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [sort, setSort] = useState<Sort | null>(null);
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [batchMsg, setBatchMsg] = useState<string | null>(null);

  const set = (k: keyof Filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const toggleSort = (key: SortKey) =>
    setSort((s) => (s?.key === key ? (s.dir === DEFAULT_DIR[key] ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : null) : { key, dir: DEFAULT_DIR[key] }));

  const filtered = useMemo(() => {
    const has = (val: string, q: string) => val.toLowerCase().includes(q.trim().toLowerCase());
    const kept = rows.filter((r) =>
      (!filters.name || has(`${r.name} ${r.website} ${r.city} ${r.postcode}`, filters.name)) &&
      (!filters.region || has(r.region, filters.region)) &&
      (!filters.email || has(r.email, filters.email)) &&
      (!filters.contact || has(`${r.contactName} ${r.contactRole}`, filters.contact)) &&
      (!filters.status || (filters.status === "unsent" ? !r.statuses.includes("letter_sent") && addressComplete(r) : filters.status === "engaged" ? r.engaged : r.stage === filters.status)),
    );
    return sortProspects(kept, sort);
  }, [rows, filters, sort]);

  // Back to page 1 whenever the view changes, and never past the last page.
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { setPage(1); }, [filters, sort]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);
  const start = (page - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  const setStage = (r: ProspectRow, stage: PipelineStage) => {
    if (stage === r.stage) return;
    setStageOverride((m) => ({ ...m, [r.id]: stage }));
    setBusyId(r.id);
    startTransition(async () => {
      const res = await setProspectStageAction(r.id, stage);
      if (!res.ok) { setStageOverride((m) => { const { [r.id]: _dropped, ...rest } = m; return rest; }); setBatchMsg(res.error ?? "Couldn't change the stage"); }
      router.refresh();
      setBusyId(null);
    });
  };

  const remove = async (id: string, name: string) => {
    if (!await askConfirm(`Remove ${name} from your prospect list?`)) return;
    setBusyId(id);
    startTransition(async () => { await deleteProspectAction(id); router.refresh(); setBusyId(null); });
  };

  const nextLetters = async () => {
    if (!await askConfirm("Prepare the next 10 letters? Those centres will be marked “Letter sent” and the batch opens in a new tab to print or save as PDF.")) return;
    setBatchMsg(null);
    startTransition(async () => {
      const r = await prepareNextLettersAction(10);
      if (!r.ok || !r.ids?.length) { setBatchMsg(r.error ?? "Nothing to prepare"); return; }
      window.open(`/admin/marketing/letters?ids=${r.ids.join(",")}`, "_blank", "noopener");
      setBatchMsg(`${r.ids.length} letter${r.ids.length === 1 ? "" : "s"} prepared and marked as sent.`);
      router.refresh();
    });
  };

  const anyFilter = Object.values(filters).some(Boolean);
  const filterInput = (k: keyof Filters, placeholder: string) => (
    <input value={filters[k]} onChange={(e) => set(k, e.target.value)} placeholder={placeholder}
      className="w-full rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] outline-none focus:border-teal" />
  );
  const menuItem = "block w-full rounded px-2.5 py-1.5 text-left text-xs font-medium text-navy hover:bg-slate-50";
  const Th = ({ k, children, title, align = "left" }: { k: SortKey; children: React.ReactNode; title?: string; align?: "left" | "right" }) => {
    const active = sort?.key === k;
    return (
      <th className={`px-2 py-1.5 ${align === "right" ? "text-right" : ""}`} title={title ?? "Click to sort"} aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" onClick={() => toggleSort(k)} className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-navy ${active ? "text-navy" : ""}`}>
          {children}
          <span aria-hidden="true" className={active ? "text-teal" : "text-slate-300"}>{active ? (sort!.dir === "asc" ? "▲" : "▼") : "⇅"}</span>
        </button>
      </th>
    );
  };
  const pager = pages > 1 ? (
    <span className="flex items-center gap-1.5 text-xs text-slate-500">
      <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded border border-slate-300 px-2 py-0.5 font-medium text-navy hover:bg-slate-50 disabled:opacity-40">←</button>
      <span>Page {page} of {pages}</span>
      <button type="button" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="rounded border border-slate-300 px-2 py-0.5 font-medium text-navy hover:bg-slate-50 disabled:opacity-40">→</button>
    </span>
  ) : null;

  return (
    <div className="rounded-card border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
          <span>
            Showing <span className="font-semibold text-navy">{filtered.length === 0 ? 0 : start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)}</span> of {filtered.length}
            {filtered.length !== rows.length ? <> (filtered from {rows.length})</> : null}
          </span>
          {anyFilter ? <button onClick={() => setFilters(EMPTY)} className="text-xs text-teal hover:underline">Clear filters</button> : null}
          {sort ? <button onClick={() => setSort(null)} className="text-xs text-teal hover:underline">Clear sort</button> : null}
          {pending ? <span className="text-slate-400">Saving…</span> : null}
        </p>
        <div className="flex items-center gap-3">
          {pager}
          {batchMsg ? <span className="text-xs text-slate-500">{batchMsg}</span> : null}
          <button type="button" onClick={nextLetters} disabled={pending} className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
            ✉ Download next 10 letters
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left text-xs">
          <colgroup>
            <col style={{ width: "30%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "25%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "9%" }} />
          </colgroup>
          <thead className="bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <Th k="name" title="Also matches town and postcode. Click to sort">Centre / club</Th>
              <Th k="region">Region</Th>
              <Th k="email">Email · contact</Th>
              <Th k="addr" title="Postal address complete? Click to sort">Addr</Th>
              <Th k="vibe" title="Red: rejected · Orange: engaged · Green: signed up. Click to sort">Vibe</Th>
              <Th k="status" title="Click to sort by how far along they are">Status</Th>
              <Th k="added" title="Click to sort by when they were added" align="right">Actions</Th>
            </tr>
            <tr className="bg-white">
              <th className="px-2 pb-1.5">{filterInput("name", "Name, town or postcode…")}</th>
              <th className="px-2 pb-1.5">{filterInput("region", "Filter…")}</th>
              <th className="px-2 pb-1.5">{filterInput("email", "Filter…")}</th>
              <th className="px-2 pb-1.5"></th>
              <th className="px-2 pb-1.5"></th>
              <th className="px-2 pb-1.5">
                <select value={filters.status} onChange={(e) => set("status", e.target.value)} className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] outline-none focus:border-teal">
                  <option value="">All</option>
                  <option value="unsent">No letter yet (address ok)</option>
                  <option value="engaged">Engaged (orange)</option>
                  {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{PIPELINE_META[s].label}</option>)}
                </select>
              </th>
              <th className="px-2 pb-1.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No prospects match these filters.</td></tr>
            ) : visible.map((r) => {
              const complete = addressComplete(r);
              const vibe = VIBE_META[vibeOf(r.stage, r.engaged) ?? "none"];
              const place = [r.city, r.postcode].filter(Boolean).join(" · ");
              return (
                <tr key={r.id} className={`hover:bg-slate-50/60 ${busyId === r.id ? "opacity-50" : ""}`}>
                  <td className="truncate px-2 py-1">
                    <a href={`/admin/marketing/${r.id}`} target="_blank" rel="noreferrer" className="font-medium text-navy hover:text-teal hover:underline" title={`${r.name}${place ? ` — ${place}` : ""}. Opens their page in a new tab`}>{r.name}</a>
                    {r.source === "sample" ? <span className="ml-1 rounded bg-amber/15 px-1 py-px text-[9px] font-semibold text-amber">sample</span> : null}
                    {r.soleTrader ? <span className="ml-1 rounded bg-port/10 px-1 py-px text-[9px] font-semibold text-port" title={r.lawfulBasis === "consent" ? "Sole trader with consent: may be emailed" : "Sole trader: no marketing email without consent (PECR)"}>sole trader{r.lawfulBasis === "consent" ? " · consent" : ""}</span> : r.lawfulBasis === "consent" ? <span className="ml-1 rounded bg-starboard/10 px-1 py-px text-[9px] font-semibold text-starboard">consent</span> : null}
                    {r.website ? <a href={r.website.startsWith("http") ? r.website : `https://${r.website}`} target="_blank" rel="noreferrer" className="ml-1.5 text-[10px] text-slate-400 hover:text-teal" title={r.website}>↗</a> : null}
                  </td>
                  <td className="truncate px-2 py-1 text-slate-600">{r.region || "—"}</td>
                  <td className="truncate px-2 py-1 text-slate-600">
                    {r.email ? <a href={gmailHref(r)} target="_blank" rel="noreferrer" className="hover:text-teal" title={`Draft an email to ${r.email} in Gmail`}>{r.email}</a> : <span className="text-slate-300">no email</span>}
                    {r.contactName ? <span className="text-slate-400" title={`${r.contactName}${r.contactRole ? ` · ${r.contactRole}` : ""}`}> · {r.contactName}</span> : null}
                  </td>
                  <td className="px-2 py-1">
                    {complete ? <span title="Complete postal address" className="text-starboard">✓</span> : <span title="Missing street, town or postcode" className="text-amber">⚠</span>}
                  </td>
                  <td className="px-2 py-1">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full align-middle ${vibe.dot}`} title={vibe.label} aria-label={`Vibe: ${vibe.label}`} />
                  </td>
                  <td className="px-2 py-1">
                    <select
                      value={r.stage}
                      disabled={pending && busyId === r.id}
                      onChange={(e) => setStage(r, e.target.value as PipelineStage)}
                      aria-label={`Stage for ${r.name}`}
                      className={`w-full cursor-pointer rounded border border-transparent px-1 py-0.5 text-[11px] font-semibold outline-none hover:border-slate-300 focus:border-teal ${PIPELINE_META[r.stage].chip}`}
                    >
                      {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{PIPELINE_META[s].label}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1 text-right">
                    <details className="relative inline-block text-left">
                      <summary className="cursor-pointer list-none rounded border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-navy hover:bg-slate-50">Actions ▾</summary>
                      <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                        {complete
                          ? <a href={`/admin/marketing/${r.id}/letter`} target="_blank" rel="noreferrer" className={menuItem}>✉ Letter</a>
                          : <span className={`${menuItem} cursor-not-allowed text-slate-300`} title="Add a complete address first">✉ Letter (no address)</span>}
                        <a href={`/admin/marketing/${r.id}/mockup`} target="_blank" rel="noreferrer" className={menuItem}>📄 Mock-up PDF</a>
                        {r.email ? <a href={gmailHref(r)} target="_blank" rel="noreferrer" className={menuItem}>📧 Draft in Gmail</a> : <span className={`${menuItem} cursor-not-allowed text-slate-300`}>📧 Email (none)</span>}
                        {r.email ? <a href={mailtoHref(r)} className={menuItem}>✉️ Draft in mail app</a> : null}
                        {r.linkedinUrl ? <a href={linkedinHref(r.linkedinUrl)} target="_blank" rel="noreferrer" className={menuItem}>in LinkedIn ↗</a> : null}
                        <button type="button" onClick={() => startTransition(async () => { await setProspectBasisAction(r.id, { soleTrader: !r.soleTrader, lawfulBasis: r.lawfulBasis }); router.refresh(); })} className={menuItem}>{r.soleTrader ? "☑ Sole trader" : "☐ Sole trader"}</button>
                        <button type="button" onClick={() => startTransition(async () => { await setProspectBasisAction(r.id, { soleTrader: r.soleTrader, lawfulBasis: r.lawfulBasis === "consent" ? "legitimate_interests" : "consent" }); router.refresh(); })} className={menuItem}>{r.lawfulBasis === "consent" ? "Basis: consent → legitimate interests" : "Basis: legitimate interests → consent"}</button>
                        <button type="button" onClick={() => remove(r.id, r.name)} className={`${menuItem} text-port hover:bg-port/5`}>Remove</button>
                      </div>
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 ? <div className="flex justify-center border-t border-slate-100 px-3 py-2">{pager}</div> : null}
    </div>
  );
}
