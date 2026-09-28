"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/ui";
import { PROSPECT_STATUS_META, PROSPECT_STATUS_ORDER } from "@/lib/marketing";
import { deleteProspectAction, setProspectStatusAction } from "@/app/admin/marketing/actions";
import type { ProspectStatus } from "@/lib/db/schema";

export interface ProspectRow {
  id: string;
  name: string;
  region: string;
  city: string;
  postcode: string;
  email: string;
  website: string;
  linkedinUrl: string;
  contactName: string;
  contactRole: string;
  status: ProspectStatus;
  source: string;
}

type Filters = { name: string; region: string; city: string; postcode: string; email: string; contact: string; status: string };
const EMPTY: Filters = { name: "", region: "", city: "", postcode: "", email: "", contact: "", status: "" };

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
      (!filters.status || r.status === filters.status),
    );
  }, [rows, filters]);

  const changeStatus = (id: string, status: string) => {
    setBusyId(id);
    startTransition(async () => {
      await setProspectStatusAction(id, status);
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
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Centre / club</th>
              <th className="px-3 py-2">Region</th>
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2">Postcode</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">LinkedIn</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
            <tr className="bg-white">
              <th className="px-3 pb-2">{filterInput("name", "Filter…")}</th>
              <th className="px-3 pb-2">{filterInput("region", "Filter…")}</th>
              <th className="px-3 pb-2">{filterInput("city", "Filter…")}</th>
              <th className="px-3 pb-2">{filterInput("postcode", "Filter…")}</th>
              <th className="px-3 pb-2">{filterInput("email", "Filter…")}</th>
              <th className="px-3 pb-2">{filterInput("contact", "Filter…")}</th>
              <th className="px-3 pb-2"></th>
              <th className="px-3 pb-2">
                <select value={filters.status} onChange={(e) => set("status", e.target.value)} className="w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs outline-none focus:border-teal">
                  <option value="">All</option>
                  {PROSPECT_STATUS_ORDER.map((s) => <option key={s} value={s}>{PROSPECT_STATUS_META[s].label}</option>)}
                </select>
              </th>
              <th className="px-3 pb-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">No prospects match these filters.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className={`hover:bg-slate-50/60 ${busyId === r.id ? "opacity-50" : ""}`}>
                <td className="px-3 py-2">
                  <span className="font-medium text-navy">{r.name}</span>
                  {r.source === "sample" ? <span className="ml-1.5 rounded bg-amber/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber">sample</span> : null}
                  {r.website ? <a href={r.website.startsWith("http") ? r.website : `https://${r.website}`} target="_blank" rel="noreferrer" className="block text-xs text-slate-400 hover:text-teal">{r.website}</a> : null}
                </td>
                <td className="px-3 py-2 text-slate-600">{r.region || "—"}</td>
                <td className="px-3 py-2 text-slate-600">{r.city || "—"}</td>
                <td className="px-3 py-2 text-slate-600">{r.postcode || "—"}</td>
                <td className="px-3 py-2 text-slate-600">{r.email ? <a href={`mailto:${r.email}`} className="hover:text-teal">{r.email}</a> : "—"}</td>
                <td className="px-3 py-2 text-slate-600">{r.contactName || "—"}{r.contactRole ? <span className="block text-xs text-slate-400">{r.contactRole}</span> : null}</td>
                <td className="px-3 py-2">{r.linkedinUrl ? <a href={r.linkedinUrl.startsWith("http") ? r.linkedinUrl : `https://${r.linkedinUrl}`} target="_blank" rel="noreferrer" className="text-xs text-teal hover:underline">Profile ↗</a> : <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1">
                    <StatusPill tone={PROSPECT_STATUS_META[r.status].tone === "teal" ? "covered" : PROSPECT_STATUS_META[r.status].tone as "neutral" | "attention" | "covered" | "conflict"}>{PROSPECT_STATUS_META[r.status].label}</StatusPill>
                    <select value={r.status} onChange={(e) => changeStatus(r.id, e.target.value)} className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs outline-none focus:border-teal">
                      {PROSPECT_STATUS_ORDER.map((s) => <option key={s} value={s}>{PROSPECT_STATUS_META[s].label}</option>)}
                    </select>
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <a href={`/admin/marketing/${r.id}/letter`} target="_blank" rel="noreferrer" className="rounded-lg bg-teal px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-700">Letter</a>
                    <button onClick={() => remove(r.id, r.name)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-400 hover:border-port hover:text-port">✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
