"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronsUpDown } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { InviteInstructorButton } from "@/components/office/InviteInstructorButton";

export interface StaffRow {
  id: string;
  name: string;
  email: string | null;
  employment: string;
  fit: boolean;
  warnings: number;
  blockText: string;
  linked: boolean;
  /** Portal access: none yet, invite sent but not accepted, or accepted. */
  inviteStatus: "none" | "pending" | "accepted";
  hasEmail: boolean;
  teaches: string[];
  teachesYouth: boolean;
  teachesAdult: boolean;
  /** "inactive" = has left; kept for history, hidden from pickers. */
  status: string;
  under18?: boolean;
  hasDob?: boolean;
}

type Tab = "all" | "fit" | "blocked" | "expiring" | "left";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Current" },
  { key: "fit", label: "Fit to roster" },
  { key: "blocked", label: "Blocked" },
  { key: "expiring", label: "Expiring soon" },
  { key: "left", label: "Left" },
];

export function StaffTable({ rows }: { rows: StaffRow[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");

  const current = useMemo(() => rows.filter((r) => r.status !== "inactive"), [rows]);
  const counts = useMemo(
    () => ({
      all: current.length,
      fit: current.filter((r) => r.fit).length,
      blocked: current.filter((r) => !r.fit).length,
      expiring: current.filter((r) => r.warnings > 0).length,
      left: rows.length - current.length,
    }),
    [rows, current],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      const gone = r.status === "inactive";
      if (tab === "left") { if (!gone) return false; }
      else if (gone) return false;
      if (tab === "fit" && !r.fit) return false;
      if (tab === "blocked" && r.fit) return false;
      if (tab === "expiring" && r.warnings === 0) return false;
      if (term && !`${r.name} ${r.email ?? ""}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [rows, tab, q]);

  return (
    <div className="rounded-card border border-slate-200 bg-white shadow-sm">
      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {TABS.filter((t) => t.key !== "left" || counts.left > 0).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                tab === t.key ? "bg-teal text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {t.label}
              <span className={`ml-1.5 text-xs ${tab === t.key ? "text-white/80" : "text-slate-400"}`}>{counts[t.key]}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search staff by name or email"
            className="w-64 max-w-[70vw] rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal focus:bg-white"
            aria-label="Search staff"
          />
        </div>
      </div>

      {/* table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Employment</Th>
              <Th>Can teach</Th>
              <Th>Fit to roster</Th>
              <Th>App access</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">{tab === "left" ? "Nobody has left." : "No instructors match this view."}</td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="transition hover:bg-navy-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-teal/10 text-xs font-semibold text-teal">
                        {r.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                      </span>
                      <Link href={`/office/staff/${r.id}`} className="font-medium text-navy hover:text-teal hover:underline">{r.name}</Link>{r.under18 ? <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">Under 18</span> : null}{r.hasDob === false ? <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500" title="Add their date of birth so the right protections and hours rules apply">No DOB</span> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{r.email ?? "—"}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{r.employment}</td>
                  <td className="px-4 py-3">
                    {r.teaches.length === 0 ? (
                      <span className="text-xs text-slate-400">Add a cert</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap gap-1">
                          {r.teachesYouth ? <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[11px] font-semibold text-amber">Youth</span> : null}
                          {r.teachesAdult ? <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[11px] font-semibold text-teal">Adult</span> : null}
                        </div>
                        <span className="text-xs text-slate-500" title={r.teaches.join(", ")}>
                          {r.teaches.slice(0, 2).join(", ")}{r.teaches.length > 2 ? ` +${r.teaches.length - 2} more` : ""}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "inactive" ? <StatusPill tone="neutral">Left</StatusPill> : r.fit ? <StatusPill tone="covered">Fit</StatusPill> : <StatusPill tone="conflict">{r.blockText || "Not cleared"}</StatusPill>}
                    {r.warnings > 0 ? (
                      <span className="ml-2"><StatusPill tone="attention">{r.warnings} expiring</StatusPill></span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "inactive" ? (
                      <span className="text-xs text-slate-400">Access ended</span>
                    ) : r.hasEmail ? (
                      <InviteInstructorButton instructorId={r.id} status={r.inviteStatus} />
                    ) : (
                      <span className="text-xs text-slate-400">Add email to invite</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3">
      <span className="inline-flex items-center gap-1">
        {children}
        <ChevronsUpDown className="h-3 w-3 text-slate-300" />
      </span>
    </th>
  );
}
