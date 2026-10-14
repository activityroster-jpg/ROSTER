"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { askConfirm } from "@/lib/ui/ask-confirm";
import { confirmDaysAction, undoDayAction } from "@/app/(app)/office/rota/actions";

export interface DayState { date: string; confirmed: boolean; sessions: number; people: number; short: number; /** People on the day with no expiry date on any of their licences. */ noExpiry?: string[] }

// Spelled out by hand: Node and browsers punctuate toLocaleDateString differently, which breaks hydration.
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (iso: string) => { const d = new Date(`${iso}T00:00:00Z`); return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MO[d.getUTCMonth()]}`; };

/**
 * Confirm the roster one day at a time. Staff see their shifts as pending
 * until the day is confirmed; confirming tells everyone on it. A confirmed day
 * stays confirmed through changes (the people affected hear straight away);
 * Undo puts it back to pending with no messages, and confirming again tells
 * only the people whose shifts changed.
 */
export function RosterDays({ days, staffAccept, staffSeePending = true }: { days: DayState[]; staffAccept: boolean; staffSeePending?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const withSessions = days.filter((d) => d.sessions > 0);
  const toConfirm = withSessions.filter((d) => !d.confirmed);

  const confirm = (list: DayState[]) => start(async () => {
    const short = list.filter((d) => d.short > 0);
    const undated = [...new Set(list.flatMap((d) => d.noExpiry ?? []))];
    const warnings = [
      ...short.map((d) => `${fmt(d.date)}: ${d.short} session${d.short === 1 ? "" : "s"} still short of staff`),
      ...(undated.length ? [`No expiry date recorded on any licence for ${undated.join(", ")}, so the app can't warn you if their qualification has lapsed. Add the dates on Instructors`] : []),
    ];
    if (warnings.length && !(await askConfirm(`${warnings.join(". ")}. Confirm anyway?`))) return;
    const r = await confirmDaysAction(list.map((d) => d.date));
    setMsg(r.ok ? r.message ?? "Confirmed" : r.error ?? "Could not confirm");
    router.refresh();
  });
  const undo = (d: DayState) => start(async () => {
    if (!(await askConfirm(`Put ${fmt(d.date)} back to pending? Nobody is told now. When you confirm it again, only the people whose shifts changed hear about it.`))) return;
    const r = await undoDayAction(d.date);
    setMsg(r.ok ? r.message ?? "Back to pending" : r.error ?? "Could not undo");
    router.refresh();
  });

  return (
    <div className="mb-4 rounded-card border border-slate-200 bg-white px-4 py-3 print:hidden">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-navy">Confirm the roster</p>
          <p className="text-xs text-slate-500">{staffSeePending ? "Staff see their shifts as pending until you confirm the day" : "Staff see a shift only once you confirm its day"}; confirming tells them{staffAccept ? " and asks them to accept" : ""}. Changes to a confirmed day reach the people affected straight away.</p>
        </div>
        <div className="flex items-center gap-2">
          {msg ? <span className="text-xs text-slate-600" role="status">{msg}</span> : null}
          <button type="button" disabled={pending || toConfirm.length === 0} onClick={() => confirm(toConfirm)} className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
            {toConfirm.length === 0 ? (withSessions.length ? "Whole week confirmed" : "Nothing to confirm") : `Confirm whole week (${toConfirm.length} day${toConfirm.length === 1 ? "" : "s"})`}
          </button>
        </div>
      </div>
      <ul className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {days.map((d) => (
          <li key={d.date} className={`rounded-lg border px-2 py-1.5 text-xs ${d.sessions === 0 ? "border-slate-100 text-slate-300" : d.confirmed ? "border-starboard/40 bg-starboard/5" : "border-amber/50 bg-amber/10"}`}>
            <p className="font-semibold text-navy">{fmt(d.date)}</p>
            {d.sessions === 0 ? <p>No sessions</p> : (
              <>
                <p className="text-slate-600">{d.sessions} session{d.sessions === 1 ? "" : "s"} · {d.people} {d.people === 1 ? "person" : "people"}{d.short ? <span className="font-semibold text-port"> · {d.short} short</span> : null}</p>
                {d.noExpiry?.length ? <p className="text-amber" title={`No expiry date recorded: ${d.noExpiry.join(", ")}`}>⚠ {d.noExpiry.length} licence{d.noExpiry.length === 1 ? "" : "s"} undated</p> : null}
                {d.confirmed ? (
                  <p className="mt-1 flex items-center justify-between gap-1"><span className="font-semibold text-starboard">✓ Confirmed</span><button type="button" disabled={pending} onClick={() => undo(d)} className="text-slate-500 hover:text-port disabled:opacity-50">Undo</button></p>
                ) : (
                  <p className="mt-1 flex items-center justify-between gap-1"><span className="font-semibold text-amber">Pending</span><button type="button" disabled={pending} onClick={() => confirm([d])} className="rounded bg-teal px-2 py-0.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50">Confirm</button></p>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
