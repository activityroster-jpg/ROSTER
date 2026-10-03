"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { extendTrialAction, setTrialEndsAtAction } from "@/app/admin/actions";

/** Free-trial controls for one centre: where it is, extend it, or set an exact end date. */
export function TrialControls({ id, state, endsIso }: { id: string; state: string; endsIso: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [date, setDate] = useState(endsIso);
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => {
    const r = await fn();
    setMsg(r.ok ? "Saved" : r.error ?? "Failed");
    router.refresh();
  });
  const field = "rounded-lg border border-slate-300 px-3 py-2 text-sm";
  return (
    <div className="flex flex-wrap items-end gap-2">
      <p className="mr-2 text-sm text-slate-600">{state}</p>
      {[7, 30, 90].map((d) => (
        <button key={d} type="button" disabled={pending} onClick={() => run(() => extendTrialAction(id, d))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-navy hover:bg-slate-50 disabled:opacity-50">+{d} days</button>
      ))}
      <label className="text-xs font-semibold text-slate-500">Ends on
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`mt-1 block ${field}`} />
      </label>
      <button type="button" disabled={pending || !date} onClick={() => run(() => setTrialEndsAtAction(id, date))} className="rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50">Set</button>
      <button type="button" disabled={pending} onClick={() => run(() => setTrialEndsAtAction(id, null))} className="text-xs text-slate-400 hover:text-navy">Reset to default</button>
      {msg ? <span className="text-xs text-slate-500">{msg}</span> : null}
    </div>
  );
}
