"use client";

import { useState, useTransition } from "react";
import { setRetentionAction } from "@/app/(app)/office/settings/actions";
import type { RetentionPolicy } from "@/lib/services/retention";

type CountKey = "staff" | "leave" | "clock" | "availability" | "notifications" | "audit";
const COUNT_KEY: Record<keyof RetentionPolicy, CountKey> = { staffMonths: "staff", leaveMonths: "leave", clockMonths: "clock", availabilityMonths: "availability", notificationsMonths: "notifications", auditMonths: "audit" };
const ROWS: { key: keyof RetentionPolicy; label: string; help: string; min: number }[] = [
  { key: "staffMonths", label: "Former staff profiles", help: "Months after someone leaves before their name, contact details, certificates and files are removed. Roster and payroll history stays.", min: 1 },
  { key: "leaveMonths", label: "Leave requests", help: "Months after the leave ended.", min: 1 },
  { key: "availabilityMonths", label: "Availability entries", help: "Months after the date they refer to.", min: 1 },
  { key: "notificationsMonths", label: "Notifications", help: "In-app messages to your team.", min: 1 },
  { key: "clockMonths", label: "Clock and payroll records", help: "Statutory minimum 6 years for payroll (HMRC / Revenue).", min: 72 },
  { key: "auditMonths", label: "Change log", help: "Minimum 3 years; the database refuses earlier deletion.", min: 36 },
];
const OPTIONS = [1, 3, 6, 12, 18, 24, 36, 48, 60, 72, 84, 96, 120];

export function RetentionForm({ initial, pending: counts }: { initial: RetentionPolicy; pending: Record<CountKey, number> }) {
  const [p, setP] = useState<RetentionPolicy>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-3 text-sm">
      {ROWS.map((r) => (
        <div key={r.key} className="grid gap-1 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="font-medium text-navy">{r.label}{counts[COUNT_KEY[r.key]] ? <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{counts[COUNT_KEY[r.key]]} due in the next 14 days</span> : null}</p>
            <p className="text-xs text-slate-500">{r.help}</p>
          </div>
          <select value={p[r.key]} onChange={(e) => setP((x) => ({ ...x, [r.key]: Number(e.target.value) }))} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
            {OPTIONS.filter((m) => m >= r.min).map((m) => <option key={m} value={m}>{m < 12 ? `${m} month${m === 1 ? "" : "s"}` : `${m / 12} year${m === 12 ? "" : "s"}`}</option>)}
          </select>
        </div>
      ))}
      <p className="text-xs text-slate-400">Anything past its period enters a 14-day window: every admin is emailed what will go, and it is removed when the window ends. Each run is recorded in the change log, and re-applied automatically if the database is ever restored from a backup.</p>
      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={() => start(async () => { const r = await setRetentionAction(p as unknown as Record<string, number>); setMsg(r.ok ? r.message ?? "Saved" : r.error ?? "Failed"); })} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : "Save retention periods"}</button>
        {msg ? <span className="text-sm text-slate-600">{msg}</span> : null}
      </div>
    </div>
  );
}
