"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { claimOpenShiftAction, requestLeaveAction } from "@/app/(app)/portal/leave/actions";
import { StatusPill } from "@/components/ui";
import { LEAVE_TYPES } from "@/lib/db/schema";
import type { LeaveRow } from "@/lib/services/leave";
import type { OpenShiftRow } from "@/lib/services/openshifts";

const TONE = { pending: "attention", approved: "covered", declined: "conflict", cancelled: "neutral" } as const;

export function PortalLeave({ myLeave, shifts }: { myLeave: LeaveRow[]; shifts: OpenShiftRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<string>("annual");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [days, setDays] = useState("1");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await requestLeaveAction({ type: type as never, startDate: start, endDate: end || start, days: Number(days), reason });
      if (!res.ok) setMsg(res.error ?? "Could not submit");
      else { setMsg("Request submitted"); setStart(""); setEnd(""); setDays("1"); setReason(""); router.refresh(); }
    });
  };

  const claim = (id: string) => startTransition(async () => {
    const res = await claimOpenShiftAction(id);
    if (res.ok) router.refresh();
  });

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="rounded-card border border-slate-200 bg-white p-4">
        <p className="font-semibold text-navy">Request leave</p>
        <div className="mt-3 grid gap-2">
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {LEAVE_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-500">From<input type="date" required value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="text-xs text-slate-500">To<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
          </div>
          <label className="text-xs text-slate-500">Days<input type="number" min="0.5" step="0.5" value={days} onChange={(e) => setDays(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button disabled={pending} className="mt-3 w-full rounded-lg bg-teal px-4 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-60">Submit request</button>
        {msg ? <p className="mt-2 text-center text-xs text-slate-500">{msg}</p> : null}
      </form>

      <div>
        <p className="mb-2 font-semibold text-navy">My requests</p>
        {myLeave.length === 0 ? (
          <p className="text-sm text-slate-400">No requests yet.</p>
        ) : (
          <ul className="space-y-2">
            {myLeave.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span><span className="block text-sm font-medium capitalize text-navy">{r.type}</span><span className="text-xs text-slate-400">{r.startDate}{r.endDate !== r.startDate ? ` – ${r.endDate}` : ""} · {r.days}d</span></span>
                <StatusPill tone={TONE[r.status]}>{r.status[0]!.toUpperCase() + r.status.slice(1)}</StatusPill>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-2 font-semibold text-navy">Open shifts you can claim</p>
        {shifts.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing open right now.</p>
        ) : (
          <ul className="space-y-2">
            {shifts.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span><span className="block text-sm font-medium text-navy">{s.roleName} · {s.courseName}</span><span className="text-xs text-slate-400">{s.date} {s.slot}</span></span>
                {s.status === "open" ? (
                  <button disabled={pending} onClick={() => claim(s.id)} className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-60">Claim</button>
                ) : (
                  <StatusPill tone="attention">{s.claimedByName ? "Offered" : "Pending"}</StatusPill>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
