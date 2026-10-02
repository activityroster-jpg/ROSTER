"use client";

import { useState, useTransition } from "react";
import { updateBreakPolicyAction } from "@/app/(app)/office/settings/actions";

/** Lunch/rest break rule — applied to worked hours in Payroll and its exports. */
export function BreakPolicyForm({ afterMinutes, breakMinutes, paid }: { afterMinutes: number; breakMinutes: number; paid: boolean }) {
  const [pending, start] = useTransition();
  const [after, setAfter] = useState(String(afterMinutes / 60));
  const [len, setLen] = useState(String(breakMinutes));
  const [isPaid, setIsPaid] = useState(paid);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = () => start(async () => {
    const res = await updateBreakPolicyAction({ afterMinutes: Math.round(Number(after) * 60), breakMinutes: Number(len), paid: isPaid });
    setMsg({ ok: res.ok, text: res.ok ? res.message ?? "Saved" : res.error ?? "Could not save" });
  });

  const field = "rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal";
  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 text-sm text-slate-600">
        <label className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-500">Break length (minutes)</span>
          <select value={len} onChange={(e) => setLen(e.target.value)} className={field}>
            {[0, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m === 0 ? "No breaks" : `${m} min`}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-500">For anyone working over (hours)</span>
          <input type="number" min={0} max={24} step={0.5} value={after} onChange={(e) => setAfter(e.target.value)} disabled={len === "0"} className={`${field} w-24`} />
        </label>
        <label className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-500">Break is</span>
          <select value={isPaid ? "paid" : "unpaid"} onChange={(e) => setIsPaid(e.target.value === "paid")} disabled={len === "0"} className={field}>
            <option value="unpaid">Unpaid (deducted)</option>
            <option value="paid">Paid</option>
          </select>
        </label>
        <button type="button" onClick={save} disabled={pending} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
      </div>
      {msg ? <p role="status" className={`mt-2 text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</p> : null}
    </div>
  );
}
