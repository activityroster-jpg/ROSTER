"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PROSPECT_STATUS_META,
  PROSPECT_STATUS_ORDER,
  addressComplete,
  draftProspectEmail,
} from "@/lib/marketing";
import { deleteProspectAction, setProspectStatusesAction } from "@/app/admin/marketing/actions";
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

type Filters = { name: string; region: string; city: string; postcode: string; email: string; contact: string; status: string };
const EMPTY: Filters = { name: "", region: "", city: "", postcode: "", email: "", contact: "", status: "" };

const mailtoHref = (r: ProspectRow) => {
  const { subject, body } = draftProspectEmail(r);
  return `mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};
const linkedinHref = (url: string) => (url.startsWith("http") ? url : `https://${url}`);

export function ProspectsTable({ rows }: { rows: ProspectRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [busyId, setBusyId] = useState<string | null>(null);

  const set = (k: keyof Filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));

  const filtered = useMemo(() => {
    const has = (val: string, q: string) => val.toLowerCase().includes(q.trim().toLowerCase());
    return rows.filter((r) =>
      (!filters.name || has(r.name, filters.name)) &&
      (!filters.region || has(r.region, filters.region)) &&
      (!filters.city || has(r.city, filters.city)) &&
      (!filters.postcode || has(r.postcode, filters.postcode)) &&
      (!filters.email || has(r.email, filters.email)) &&
      (!filters.contact || has(`${r.contactName} ${r.contactRole}`, filters.contact)) &&
      (!filters.status || r.statuses.includes(filters.status as ProspectStatus)),
    );
  }, [rows, filters]);

  const toggleStatus = (r: ProspectRow, status: ProspectStatus, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...r.statuses, status]))
      : r.statuses.filter((s) => s !== status);
    setBusyId(r.id);
    startTransition(async () => {
      await setProspectStatusesAction(r.id, next);
      router.refresh();
      setBusyId(null);
    });
  };

  const remove = (id: string, name: string) => {
    if (!confirm(`Remove ${name} from your prospect list?`)) return;
    setBusyId(id);
    startTransition(async () => {
      await deleteProspectAction(id);
      router.refresh();
      setBusyId(null);
    });
  };

  const anyFilter = Object.values(filters).some(Boolean);

  const filterInput = (k: keyof Filters, placeholder: string) => (
    <input value={filters[k]} onChange={(e) => set(k, e.target.value)} placeholder={placeholder}
      className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-teal" />
  );

  return (
    <div className="rounded-card border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <p className="text-sm text-slate-500">
          Showing <span className="font-semibold text-navy">{filtered.length}</span> of {rows.length}
          {anyFilter ? <button onClick={() => setFilters(EMPTY)} className="ml-2 text-xs text-teal hover:underline">Clear filters</button> : null}
        </p>
        {pending ? <span className="text-xs text-slate-400">Saving…</span> : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col style={{ width: "18%" }} />{/* Centre / club */}
            <col style={{ width: "8%" }} />{/* Region */}
            <col style={{ width: "9%" }} />{/* City */}
            <col style={{ width: "7%" }} />{/* Postcode */}
            <col style={{ width: "16%" }} />{/* Email */}
            <col style={{ width: "11%" }} />{/* Contact */}
            <col style={{ width: "6%" }} />{/* Address */}
            <col style={{ width: "13%" }} />{/* Status */}
            <col style={{ width: "12%" }} />{/* Actions */}
          </colgroup>
          <thead className="bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2 py-2">Centre / club</th>
              <th className="px-2 py-2">Region</th>
              <th className="px-2 py-2">City</th>
              <th className="px-2 py-2">Postcode</th>
              <th className="px-2 py-2">Email</th>
              <th className="px-2 py-2">Contact</th>
              <th className="px-2 py-2">Address</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2 text-right">Actions</th>
            </tr>
            <tr className="bg-white">
              <th className="px-2 pb-2">{filterInput("name", "Filter…")}</th>
              <th className="px-2 pb-2">{filterInput("region", "Filter…")}</th>
              <th className="px-2 pb-2">{filterInput("city", "Filter…")}</th>
              <th className="px-2 pb-2">{filterInput("postcode", "Filter…")}</th>
              <th className="px-2 pb-2">{filterInput("email", "Filter…")}</th>
              <th className="px-2 pb-2">{filterInput("contact", "Filter…")}</th>
              <th className="px-2 pb-2"></th>
              <th className="px-2 pb-2">
                <select value={filters.status} onChange={(e) => set("status", e.target.value)} className="w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs outline-none focus:border-teal">
                  <option value="">All</option>
                  {PROSPECT_STATUS_ORDER.map((s) => <option key={s} value={s}>{PROSPECT_STATUS_META[s].label}</option>)}
                </select>
              </th>
              <th className="px-2 pb-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">No prospects match these filters.</td></tr>
            ) : filtered.map((r) => {
              const complete = addressComplete(r);
              return (
              <tr key={r.id} className={`hover:bg-slate-50/60 ${busyId === r.id ? "opacity-50" : ""}`}>
                <td className="px-2 py-2 align-top break-words">
                  <span className="font-medium text-navy">{r.name}</span>
                  {r.source === "sample" ? <span className="ml-1.5 rounded bg-amber/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber">sample</span> : null}
                  {r.website ? <a href={r.website.startsWith("http") ? r.website : `https://${r.website}`} target="_blank" rel="noreferrer" className="block break-all text-xs text-slate-400 hover:text-teal">{r.website}</a> : null}
                </td>
                <td className="px-2 py-2 align-top break-words text-slate-600">{r.region || "—"}</td>
                <td className="px-2 py-2 align-top break-words text-slate-600">{r.city || "—"}</td>
                <td className="px-2 py-2 align-top break-words text-slate-600">{r.postcode || "—"}</td>
                <td className="px-2 py-2 align-top text-slate-600">{r.email ? <a href={`mailto:${r.email}`} className="break-all hover:text-teal">{r.email}</a> : "—"}</td>
                <td className="px-2 py-2 align-top break-words text-slate-600">{r.contactName || "—"}{r.contactRole ? <span className="block text-xs text-slate-400">{r.contactRole}</span> : null}</td>
                <td className="px-2 py-2 align-top">
                  {complete
                    ? <span title="Complete postal address" className="inline-flex items-center gap-1 rounded bg-starboard/15 px-1.5 py-0.5 text-[11px] font-semibold text-starboard">✓</span>
                    : <span title="Missing street, town or postcode — can't post a letter" className="inline-flex items-center gap-1 rounded bg-amber/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber">⚠ Incomplete</span>}
                </td>
                <td className="px-2 py-2 align-top">
                  <div className="flex flex-col gap-0.5">
                    {PROSPECT_STATUS_ORDER.map((s) => {
                      const on = r.statuses.includes(s);
                      return (
                        <label key={s} className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                          <input type="checkbox" checked={on} disabled={pending}
                            onChange={(e) => toggleStatus(r, s, e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-teal focus:ring-teal" />
                          <span className={on ? "font-semibold text-navy" : ""}>{PROSPECT_STATUS_META[s].short}</span>
                        </label>
                      );
                    })}
                  </div>
                </td>
                <td className="px-2 py-2 align-top text-right">
                  <div className="flex flex-col items-stretch gap-1">
                    <a href={complete ? `/admin/marketing/${r.id}/letter` : undefined}
                      target="_blank" rel="noreferrer"
                      aria-disabled={!complete}
                      title={complete ? "Open the printable letter" : "Add a complete address first"}
                      className={`rounded-lg px-2.5 py-1 text-center text-xs font-semibold ${complete ? "bg-teal text-white hover:bg-teal-700" : "cursor-not-allowed bg-slate-100 text-slate-400"}`}
                      onClick={(e) => { if (!complete) e.preventDefault(); }}>
                      Letter
                    </a>
                    <a href={`/admin/marketing/${r.id}/mockup`} target="_blank" rel="noreferrer" title="A personalised mock-up of their platform — print or save as PDF"
                      className="rounded-lg bg-violet-700 px-2.5 py-1 text-center text-xs font-semibold text-white hover:bg-violet-800">
                      Mock-up PDF
                    </a>
                    {r.email
                      ? <a href={mailtoHref(r)} title="Draft an email in your mail app" className="rounded-lg border border-slate-300 px-2.5 py-1 text-center text-xs font-semibold text-navy hover:border-teal hover:text-teal">Email</a>
                      : <span title="No email on file" className="cursor-not-allowed rounded-lg border border-slate-200 px-2.5 py-1 text-center text-xs font-semibold text-slate-300">Email</span>}
                    {r.linkedinUrl
                      ? <a href={linkedinHref(r.linkedinUrl)} target="_blank" rel="noreferrer" title="Open LinkedIn to message them" className="rounded-lg border border-slate-300 px-2.5 py-1 text-center text-xs font-semibold text-[#0a66c2] hover:border-[#0a66c2]">LinkedIn ↗</a>
                      : <span title="No LinkedIn on file" className="cursor-not-allowed rounded-lg border border-slate-200 px-2.5 py-1 text-center text-xs font-semibold text-slate-300">LinkedIn</span>}
                    <button onClick={() => remove(r.id, r.name)} title="Remove" className="rounded-lg border border-slate-200 px-2.5 py-1 text-center text-xs text-slate-400 hover:border-port hover:text-port">Remove</button>
                  </div>
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
