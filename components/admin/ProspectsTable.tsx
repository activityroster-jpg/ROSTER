"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PROSPECT_STATUS_META,
  PROSPECT_STATUS_ORDER,
  addressComplete,
  draftProspectEmail,
} from "@/lib/marketing";
import { deleteProspectAction, prepareNextLettersAction, setProspectStatusesAction } from "@/app/admin/marketing/actions";
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
  source: string;
}

type Filters = { name: string; region: string; place: string; email: string; contact: string; status: string };
const EMPTY: Filters = { name: "", region: "", place: "", email: "", contact: "", status: "" };

const mailtoHref = (r: ProspectRow) => {
  const { subject, body } = draftProspectEmail(r);
  return `mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};
const linkedinHref = (url: string) => (url.startsWith("http") ? url : `https://${url}`);
const TONE_CHIP: Record<string, string> = {
  neutral: "bg-slate-100 text-slate-600",
  attention: "bg-amber/15 text-amber",
  teal: "bg-teal/15 text-teal",
  covered: "bg-starboard/15 text-starboard",
  conflict: "bg-port/15 text-port",
};

/**
 * Compact prospect list: one line per centre. Status is a dropdown of
 * tickboxes (a centre can be lettered AND emailed), Actions is a dropdown menu.
 * "Download next 10 letters" reserves the next unsent centres with a full
 * address, marks them Letter sent, and opens them as one printable batch.
 */
export function ProspectsTable({ rows }: { rows: ProspectRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [batchMsg, setBatchMsg] = useState<string | null>(null);

  const set = (k: keyof Filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));

  const filtered = useMemo(() => {
    const has = (val: string, q: string) => val.toLowerCase().includes(q.trim().toLowerCase());
    return rows.filter((r) =>
      (!filters.name || has(`${r.name} ${r.website}`, filters.name)) &&
      (!filters.region || has(r.region, filters.region)) &&
      (!filters.place || has(`${r.city} ${r.postcode} ${r.addressLine1}`, filters.place)) &&
      (!filters.email || has(r.email, filters.email)) &&
      (!filters.contact || has(`${r.contactName} ${r.contactRole}`, filters.contact)) &&
      (!filters.status || (filters.status === "unsent" ? !r.statuses.includes("letter_sent") && addressComplete(r) : r.statuses.includes(filters.status as ProspectStatus))),
    );
  }, [rows, filters]);

  const toggleStatus = (r: ProspectRow, status: ProspectStatus, checked: boolean) => {
    const next = checked ? Array.from(new Set([...r.statuses, status])) : r.statuses.filter((s) => s !== status);
    setBusyId(r.id);
    startTransition(async () => { await setProspectStatusesAction(r.id, next); router.refresh(); setBusyId(null); });
  };

  const remove = (id: string, name: string) => {
    if (!confirm(`Remove ${name} from your prospect list?`)) return;
    setBusyId(id);
    startTransition(async () => { await deleteProspectAction(id); router.refresh(); setBusyId(null); });
  };

  const nextLetters = () => {
    if (!confirm("Prepare the next 10 letters? Those centres will be marked “Letter sent” and the batch opens in a new tab to print or save as PDF.")) return;
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

  return (
    <div className="rounded-card border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <p className="text-xs text-slate-500">
          Showing <span className="font-semibold text-navy">{filtered.length}</span> of {rows.length} on this page
          {anyFilter ? <button onClick={() => setFilters(EMPTY)} className="ml-2 text-xs text-teal hover:underline">Clear filters</button> : null}
          {pending ? <span className="ml-2 text-slate-400">Saving…</span> : null}
        </p>
        <div className="flex items-center gap-2">
          {batchMsg ? <span className="text-xs text-slate-500">{batchMsg}</span> : null}
          <button type="button" onClick={nextLetters} disabled={pending} className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
            ✉ Download next 10 letters
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left text-xs">
          <colgroup>
            <col style={{ width: "26%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "17%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "10%" }} />
          </colgroup>
          <thead className="bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2 py-1.5">Centre / club</th>
              <th className="px-2 py-1.5">Region</th>
              <th className="px-2 py-1.5">Town · postcode</th>
              <th className="px-2 py-1.5">Email · contact</th>
              <th className="px-2 py-1.5" title="Postal address complete?">Addr</th>
              <th className="px-2 py-1.5">Status</th>
              <th className="px-2 py-1.5 text-right">Actions</th>
            </tr>
            <tr className="bg-white">
              <th className="px-2 pb-1.5">{filterInput("name", "Filter…")}</th>
              <th className="px-2 pb-1.5">{filterInput("region", "Filter…")}</th>
              <th className="px-2 pb-1.5">{filterInput("place", "Filter…")}</th>
              <th className="px-2 pb-1.5">{filterInput("email", "Filter…")}</th>
              <th className="px-2 pb-1.5"></th>
              <th className="px-2 pb-1.5">
                <select value={filters.status} onChange={(e) => set("status", e.target.value)} className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] outline-none focus:border-teal">
                  <option value="">All</option>
                  <option value="unsent">No letter yet (address ok)</option>
                  {PROSPECT_STATUS_ORDER.map((s) => <option key={s} value={s}>{PROSPECT_STATUS_META[s].label}</option>)}
                </select>
              </th>
              <th className="px-2 pb-1.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No prospects match these filters.</td></tr>
            ) : filtered.map((r) => {
              const complete = addressComplete(r);
              const shown = r.statuses.filter((s) => s !== "new");
              return (
                <tr key={r.id} className={`hover:bg-slate-50/60 ${busyId === r.id ? "opacity-50" : ""}`}>
                  <td className="truncate px-2 py-1">
                    <span className="font-medium text-navy" title={r.name}>{r.name}</span>
                    {r.source === "sample" ? <span className="ml-1 rounded bg-amber/15 px-1 py-px text-[9px] font-semibold text-amber">sample</span> : null}
                    {r.website ? <a href={r.website.startsWith("http") ? r.website : `https://${r.website}`} target="_blank" rel="noreferrer" className="ml-1.5 text-[10px] text-slate-400 hover:text-teal" title={r.website}>↗</a> : null}
                  </td>
                  <td className="truncate px-2 py-1 text-slate-600">{r.region || "—"}</td>
                  <td className="truncate px-2 py-1 text-slate-600" title={[r.addressLine1, r.city, r.postcode].filter(Boolean).join(", ")}>{r.city || "—"}{r.postcode ? <span className="text-slate-400"> · {r.postcode}</span> : null}</td>
                  <td className="truncate px-2 py-1 text-slate-600">
                    {r.email ? <a href={`mailto:${r.email}`} className="hover:text-teal" title={r.email}>{r.email}</a> : <span className="text-slate-300">no email</span>}
                    {r.contactName ? <span className="text-slate-400" title={`${r.contactName}${r.contactRole ? ` · ${r.contactRole}` : ""}`}> · {r.contactName}</span> : null}
                  </td>
                  <td className="px-2 py-1">
                    {complete ? <span title="Complete postal address" className="text-starboard">✓</span> : <span title="Missing street, town or postcode" className="text-amber">⚠</span>}
                  </td>
                  <td className="px-2 py-1">
                    <details className="relative">
                      <summary className="flex cursor-pointer list-none items-center gap-1 rounded border border-slate-200 px-1.5 py-0.5 hover:bg-slate-50">
                        {shown.length === 0 ? <span className="text-slate-400">New</span> : shown.slice(0, 2).map((s) => <span key={s} className={`rounded px-1 py-px text-[10px] font-semibold ${TONE_CHIP[PROSPECT_STATUS_META[s].tone]}`}>{PROSPECT_STATUS_META[s].short}</span>)}
                        {shown.length > 2 ? <span className="text-[10px] text-slate-400">+{shown.length - 2}</span> : null}
                        <span className="ml-auto text-slate-400">▾</span>
                      </summary>
                      <div className="absolute left-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
                        {PROSPECT_STATUS_ORDER.map((s) => (
                          <label key={s} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-slate-700 hover:bg-slate-50">
                            <input type="checkbox" checked={r.statuses.includes(s)} disabled={pending} onChange={(e) => toggleStatus(r, s, e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-teal" />
                            {PROSPECT_STATUS_META[s].label}
                          </label>
                        ))}
                      </div>
                    </details>
                  </td>
                  <td className="px-2 py-1 text-right">
                    <details className="relative inline-block text-left">
                      <summary className="cursor-pointer list-none rounded border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-navy hover:bg-slate-50">Actions ▾</summary>
                      <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                        {complete
                          ? <a href={`/admin/marketing/${r.id}/letter`} target="_blank" rel="noreferrer" className={menuItem}>✉ Letter</a>
                          : <span className={`${menuItem} cursor-not-allowed text-slate-300`} title="Add a complete address first">✉ Letter (no address)</span>}
                        <a href={`/admin/marketing/${r.id}/mockup`} target="_blank" rel="noreferrer" className={menuItem}>📄 Mock-up PDF</a>
                        {r.email ? <a href={mailtoHref(r)} className={menuItem}>📧 Email</a> : <span className={`${menuItem} cursor-not-allowed text-slate-300`}>📧 Email (none)</span>}
                        {r.linkedinUrl ? <a href={linkedinHref(r.linkedinUrl)} target="_blank" rel="noreferrer" className={menuItem}>in LinkedIn ↗</a> : null}
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
    </div>
  );
}
