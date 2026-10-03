"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePayRateAction, setPayRateAction } from "@/app/(app)/office/staff/actions";

export interface PayRateRow { id: string; roleTypeId: string | null; unit: "hour" | "day" | "session"; rate: number }

const UNITS: { value: PayRateRow["unit"]; label: string }[] = [
  { value: "hour", label: "per hour" },
  { value: "session", label: "per session" },
  { value: "day", label: "per day" },
];

/**
 * How this instructor is paid: a default (per hour, per session or per day)
 * plus optional different rates for particular roles. Volunteers simply have
 * no rate — their hours still show, their pay stays blank.
 */
export function PayRateForm({ instructorId, rates, roles, currency }: { instructorId: string; rates: PayRateRow[]; roles: { id: string; name: string }[]; currency: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const base = rates.find((r) => !r.roleTypeId) ?? null;
  const [unit, setUnit] = useState<PayRateRow["unit"]>(base?.unit ?? "hour");
  const [amount, setAmount] = useState(base ? String(base.rate) : "");
  const [roleId, setRoleId] = useState("");
  const [roleUnit, setRoleUnit] = useState<PayRateRow["unit"]>("hour");
  const [roleAmount, setRoleAmount] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => {
    setMsg(null);
    start(async () => { const r = await fn(); setMsg(r.ok ? r.message ?? "Saved" : r.error ?? "Could not save"); router.refresh(); });
  };
  const roleName = (id: string | null) => roles.find((r) => r.id === id)?.name ?? "role";
  const field = "rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal";

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">Amount ({currency})
          <input type="number" min={0} step={0.5} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 14.50" className={`${field} w-28`} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">Paid
          <select value={unit} onChange={(e) => setUnit(e.target.value as PayRateRow["unit"])} className={field}>
            {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </label>
        <button type="button" disabled={pending || amount === ""} onClick={() => run(() => setPayRateAction(instructorId, { roleTypeId: null, unit, rate: Number(amount) }))} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{base ? "Update" : "Set rate"}</button>
        {base ? <button type="button" disabled={pending} onClick={() => { if (confirm("Remove this rate? Their pay will show as blank until a new one is set.")) run(() => deletePayRateAction(base.id)); }} className="text-xs text-slate-400 hover:text-port">Remove</button> : null}
      </div>
      {!base ? <p className="mt-2 text-xs text-slate-400">No rate yet — hours will show on Payroll with pay left blank (fine for volunteers).</p> : null}

      {roles.length ? (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Different rate in a role <span className="font-normal normal-case">(optional)</span></p>
          {rates.filter((r) => r.roleTypeId).length ? (
            <ul className="mt-2 space-y-1 text-sm">
              {rates.filter((r) => r.roleTypeId).map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
                  <span className="text-navy">{roleName(r.roleTypeId)}: <span className="font-medium">{currency}{r.rate}</span> {UNITS.find((u) => u.value === r.unit)?.label}</span>
                  <button type="button" disabled={pending} onClick={() => run(() => deletePayRateAction(r.id))} className="text-xs text-slate-400 hover:text-port">Remove</button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <select value={roleId} onChange={(e) => setRoleId(e.target.value)} aria-label="Role" className={field}>
              <option value="">Role…</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <input type="number" min={0} step={0.5} value={roleAmount} onChange={(e) => setRoleAmount(e.target.value)} placeholder="Amount" aria-label="Amount" className={`${field} w-24`} />
            <select value={roleUnit} onChange={(e) => setRoleUnit(e.target.value as PayRateRow["unit"])} aria-label="Paid" className={field}>
              {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
            <button type="button" disabled={pending || !roleId || roleAmount === ""} onClick={() => run(() => setPayRateAction(instructorId, { roleTypeId: roleId, unit: roleUnit, rate: Number(roleAmount) }))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">Add</button>
          </div>
        </div>
      ) : null}
      {msg ? <p role="status" className="mt-2 text-xs text-slate-500">{msg}</p> : null}
    </div>
  );
}
