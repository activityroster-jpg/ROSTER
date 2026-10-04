"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface FeedbackRow {
  id: string;
  centreName: string;
  centreSlug: string;
  organisationId: string;
  mostUseful: string;
  leastUseful: string;
  wouldChange: string;
  missing: string;
  featureRequest: string;
  userCount: number;
  otherFeedback: string;
  contactOk: boolean;
  contactEmail: string | null;
  contactAnsweredAt: string;
  createdAt: string;
  extraTrialGrantedAt: string | null;
}

type Filter = "all" | "yes" | "no";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "yes", label: "Happy to be contacted" },
  { id: "no", label: "Not to be contacted" },
];
const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

/** Trial-end survey answers: one row per centre, click a row to read it in full; filter and export by the contact answer. */
export function TrialFeedbackTable({ rows }: { rows: FeedbackRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const router = useRouter();
  const shown = filter === "yes" ? rows.filter((r) => r.contactOk) : filter === "no" ? rows.filter((r) => !r.contactOk) : rows;
  const count = (f: Filter) => (f === "yes" ? rows.filter((r) => r.contactOk).length : f === "no" ? rows.filter((r) => !r.contactOk).length : rows.length);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filter by contact answer" className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${filter === f.id ? "border-navy bg-navy text-white" : "border-slate-300 text-slate-600 hover:border-navy"}`}
            >
              {f.label} <span className="opacity-60">{count(f.id)}</span>
            </button>
          ))}
        </div>
        <a href={`/api/admin/trial-feedback/csv${filter === "all" ? "" : `?contact=${filter}`}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-navy hover:bg-slate-50">
          Download CSV{filter === "all" ? "" : " (filtered)"}
        </a>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">{rows.length === 0 ? "No centre has answered the survey yet." : "No answers match this filter."}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Submitted</th>
                <th className="px-3 py-2">Centre</th>
                <th className="px-3 py-2">Users</th>
                <th className="px-3 py-2">Happy to be contacted</th>
                <th className="px-3 py-2">Extra 30-day trial</th>
                <th className="px-3 py-2"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr
                  key={r.id}
                  onClick={(e) => { if (!(e.target as HTMLElement).closest("a")) router.push(`/admin/trial-feedback/${r.id}`); }}
                  className="cursor-pointer border-t border-slate-100 align-top hover:bg-slate-50"
                >
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmt(r.createdAt)}</td>
                  <td className="px-3 py-2"><Link href={`/admin/trial-feedback/${r.id}`} className="font-medium text-navy hover:underline">{r.centreName}</Link><div className="text-xs text-slate-400">{r.centreSlug}</div></td>
                  <td className="px-3 py-2 text-slate-700">{r.userCount}</td>
                  <td className="px-3 py-2">
                    {r.contactOk ? (
                      <><span className="rounded-full bg-starboard/10 px-2 py-0.5 text-xs font-medium text-starboard">Yes</span>{r.contactEmail ? <a href={`mailto:${r.contactEmail}`} className="ml-2 text-xs text-teal hover:underline">{r.contactEmail}</a> : null}</>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">No</span>
                    )}
                    <div className="mt-0.5 text-[11px] text-slate-400">answered {fmt(r.contactAnsweredAt)}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.extraTrialGrantedAt ? <span className="text-starboard">Activated {fmt(r.extraTrialGrantedAt)}</span> : <span className="text-slate-400">Not yet</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-medium text-teal">View →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
