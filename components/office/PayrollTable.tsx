"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approvePayrollLinesAction, rebuildHoursAction, setPaySourceAction, updatePayrollLineAction } from "@/app/(app)/office/finance/actions";
import type { PayrollLine } from "@/lib/services/finance";

const h = (m: number) => (m / 60).toFixed(2);
const UNIT_SHORT: Record<string, string> = { hour: "/h", session: "/session", day: "/day" };

/**
 * Payroll review: every rostered or clocked session as a line the office can
 * correct before approving and exporting. Roster and clock minutes sit side by
 * side; "Paid on" picks which one each line uses; minutes and pay can be
 * overridden outright; a note explains why.
 */
export function PayrollTable({
  lines, currency, paySource, clockOn, period,
}: { lines: PayrollLine[]; currency: string; paySource: "roster" | "clock"; clockOn: boolean; period: { from?: string; to?: string } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const money = (n: number | null) => (n == null ? "—" : `${currency}${n.toFixed(2)}`);

  const run = (id: string | null, fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => {
    setMsg(null); setBusy(id);
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? r.message ?? null : r.error ?? "Something went wrong");
      setBusy(null);
      router.refresh();
    });
  };
  const edit = (l: PayrollLine, patch: Parameters<typeof updatePayrollLineAction>[1]) => run(l.recordId, () => updatePayrollLineAction(l.recordId, patch));

  const unapproved = useMemo(() => lines.filter((l) => !l.approved).map((l) => l.recordId), [lines]);
  const approvedIds = useMemo(() => lines.filter((l) => l.approved).map((l) => l.recordId), [lines]);
  const unpriced = lines.filter((l) => l.rate == null).length;

  const input = "w-20 rounded border border-slate-300 px-1.5 py-0.5 text-xs outline-none focus:border-teal disabled:bg-slate-50";

  return (
    <div className="rounded-card border border-slate-200 bg-white shadow-sm print:border-0">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pay on</span>
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs">
            {(["roster", "clock"] as const).map((s) => (
              <button key={s} type="button" disabled={pending || (s === "clock" && !clockOn)} title={s === "clock" && !clockOn ? "Turn the time clock on in Settings first" : undefined}
                onClick={() => run(null, () => setPaySourceAction(s, period))}
                className={`rounded-md px-3 py-1 font-semibold disabled:opacity-40 ${paySource === s ? "bg-navy text-white" : "text-slate-500 hover:text-navy"}`}>
                {s === "roster" ? "What was rostered" : "What was clocked"}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-400">Switching applies to every unapproved line in this period; change any single line below.</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={pending} onClick={() => run(null, () => rebuildHoursAction())} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-navy hover:bg-slate-50 disabled:opacity-50" title="Add lines for anything rostered since, without touching approved or edited lines">Refresh from roster</button>
          {unapproved.length ? (
            <button type="button" disabled={pending} onClick={() => { if (confirm(`Approve all ${unapproved.length} unapproved lines shown?`)) run(null, () => approvePayrollLinesAction(unapproved, true)); }} className="rounded-lg bg-starboard px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">Approve all shown ({unapproved.length})</button>
          ) : approvedIds.length ? (
            <button type="button" disabled={pending} onClick={() => run(null, () => approvePayrollLinesAction(approvedIds, false))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Re-open all</button>
          ) : null}
        </div>
      </div>
      {msg ? <p role="status" className="px-4 pt-2 text-xs text-slate-600 print:hidden">{msg}</p> : null}
      {unpriced > 0 ? <p className="px-4 pt-2 text-xs text-amber print:hidden">⚠ {unpriced} line{unpriced === 1 ? " has" : "s have"} no pay rate — set one on the instructor&apos;s page and press “Refresh from roster”.</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Date</th><th className="px-3 py-2">Instructor</th><th className="px-3 py-2">Course</th>
              <th className="px-3 py-2">Times</th>
              <th className="px-3 py-2" title="Minutes on the roster">Rostered</th>
              {clockOn ? <th className="px-3 py-2" title="Minutes the clock recorded">Clocked</th> : null}
              <th className="px-3 py-2">Paid on</th>
              <th className="px-3 py-2" title="Type a number of minutes to correct this line">Minutes</th>
              <th className="px-3 py-2">Lunch</th>
              <th className="px-3 py-2">Rate</th>
              <th className="px-3 py-2" title="Type an amount to set the pay for this line">Pay</th>
              <th className="px-3 py-2">Note</th>
              <th className="px-3 py-2">OK</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.length === 0 ? (
              <tr><td colSpan={13} className="px-4 py-6 text-center text-slate-400">No hours in this period. Roster staff onto courses and lines appear here; “Refresh from roster” brings in anything older.</td></tr>
            ) : lines.map((l) => {
              const locked = l.approved;
              const dim = busy === l.recordId ? "opacity-50" : "";
              return (
                <tr key={l.recordId} className={`break-inside-avoid ${dim} ${locked ? "bg-starboard/5" : ""}`}>
                  <td className="whitespace-nowrap px-3 py-1.5 text-slate-600">{l.date ?? "—"}</td>
                  <td className="px-3 py-1.5 font-medium text-navy">{l.instructorName}</td>
                  <td className="px-3 py-1.5 text-slate-600">{l.courseName}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-slate-600" title={l.clocked ? "From clock-in/out" : "From the roster"}>{l.start ?? "—"}–{l.finish ?? "—"}{l.clocked ? <span className="ml-1 text-[10px] text-teal">⏱</span> : null}</td>
                  <td className="px-3 py-1.5 text-slate-600">{h(l.scheduledMinutes)}h</td>
                  {clockOn ? <td className="px-3 py-1.5 text-slate-600">{l.clockedMinutes != null ? `${h(l.clockedMinutes)}h` : <span className="text-slate-300">—</span>}</td> : null}
                  <td className="px-3 py-1.5">
                    {l.overrideMinutes != null ? (
                      <span className="text-xs text-slate-500">office</span>
                    ) : (
                      <select value={l.source} disabled={locked || pending} onChange={(e) => edit(l, { source: e.target.value as "roster" | "clock" | "manual" })} className="rounded border border-slate-300 px-1 py-0.5 text-xs disabled:bg-slate-50">
                        <option value="roster">roster</option>
                        <option value="clock" disabled={l.clockedMinutes == null}>clock</option>
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="number" min={0} max={1440} step={5} disabled={locked || pending} placeholder={String(l.workedMinutes)} defaultValue={l.overrideMinutes ?? ""} aria-label="Minutes override"
                      onBlur={(e) => { const v = e.target.value === "" ? null : Math.round(Number(e.target.value)); if (v !== (l.overrideMinutes ?? null)) edit(l, { overrideMinutes: v }); }} className={input} />
                    <span className="ml-1 text-[10px] text-slate-400">= {h(l.payableMinutes)}h</span>
                  </td>
                  <td className="px-3 py-1.5 text-slate-600">{l.breakMinutes ? `${l.breakMinutes}m` : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-slate-600">{l.rate != null ? `${money(l.rate)}${UNIT_SHORT[l.payUnit] ?? ""}` : <span className="text-amber">none</span>}</td>
                  <td className="px-3 py-1.5">
                    <input type="number" min={0} step={0.5} disabled={locked || pending} placeholder={l.pay != null ? l.pay.toFixed(2) : "—"} defaultValue={l.overridePay ?? ""} aria-label="Pay override"
                      onBlur={(e) => { const v = e.target.value === "" ? null : Number(e.target.value); if (v !== (l.overridePay ?? null)) edit(l, { overridePay: v }); }} className={`${input} font-medium text-navy`} />
                  </td>
                  <td className="px-3 py-1.5">
                    <input disabled={locked || pending} defaultValue={l.note ?? ""} placeholder="…" maxLength={300} aria-label="Note"
                      onBlur={(e) => { if ((e.target.value.trim() || null) !== (l.note ?? null)) edit(l, { note: e.target.value }); }} className="w-28 rounded border border-slate-300 px-1.5 py-0.5 text-xs outline-none focus:border-teal disabled:bg-slate-50" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="checkbox" checked={l.approved} disabled={pending} onChange={(e) => edit(l, { approved: e.target.checked })} aria-label="Approved" className="h-4 w-4 rounded border-slate-300" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 text-[11px] text-slate-400 print:hidden">Approved lines are locked (untick OK to edit). Type in Minutes or Pay to correct a line; clear the box to go back to the calculated value. Lunch breaks apply to hourly pay only.</p>
    </div>
  );
}
