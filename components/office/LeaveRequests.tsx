"use client";

import { useState, useTransition } from "react";
import { decideLeaveAction } from "@/app/(app)/office/leave/actions";
import { StatusPill } from "@/components/ui";
import type { LeaveRow } from "@/lib/services/leave";

const TONE = { pending: "attention", approved: "covered", declined: "conflict", cancelled: "neutral" } as const;

export function LeaveRequests({ rows: initial }: { rows: LeaveRow[] }) {
  const [rows, setRows] = useState(initial);
  const [pending, startTransition] = useTransition();

  const decide = (id: string, decision: "approved" | "declined") => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: decision } : r)));
    startTransition(async () => {
      const res = await decideLeaveAction(id, decision);
      if (!res.ok) setRows(initial);
    });
  };

  if (rows.length === 0) return <p className="px-4 py-8 text-center text-sm text-slate-400">No leave requests.</p>;

  return (
    <table className="w-full text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr><th className="px-4 py-3">Staff</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Dates</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="px-4 py-3 font-medium text-navy">{r.instructorName}</td>
            <td className="px-4 py-3 capitalize text-slate-600">{r.type}</td>
            <td className="px-4 py-3 text-slate-600">{r.startDate}{r.endDate !== r.startDate ? ` – ${r.endDate}` : ""} <span className="text-xs text-slate-400">· {r.days}d</span></td>
            <td className="px-4 py-3"><StatusPill tone={TONE[r.status]}>{r.status[0]!.toUpperCase() + r.status.slice(1)}</StatusPill></td>
            <td className="px-4 py-3 text-right">
              {r.status === "pending" ? (
                <span className="flex justify-end gap-2">
                  <button disabled={pending} onClick={() => decide(r.id, "approved")} className="rounded-lg bg-starboard px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60">Approve</button>
                  <button disabled={pending} onClick={() => decide(r.id, "declined")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50 disabled:opacity-60">Decline</button>
                </span>
              ) : <span className="text-xs text-slate-400">actioned</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
