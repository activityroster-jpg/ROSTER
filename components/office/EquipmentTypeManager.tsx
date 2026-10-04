"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteOrRetireEquipmentTypeAction, saveEquipmentTypeAction, setEquipmentTypeActiveAction, type EquipmentTypeInput } from "@/app/(app)/office/equipment/actions";

export interface EquipmentTypeRow { id: string; name: string; quantity: number | null; inventoryTracked: boolean; active: boolean }

const cell = "rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-teal";

function Row({ row, onMsg }: { row: EquipmentTypeRow; onMsg: (m: { ok: boolean; text: string }) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState<EquipmentTypeInput>({ name: row.name, quantity: row.quantity ?? "", inventoryTracked: row.inventoryTracked });
  const dirty = v.name !== row.name || String(v.quantity ?? "") !== String(row.quantity ?? "") || v.inventoryTracked !== row.inventoryTracked;

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn();
      onMsg({ ok: res.ok, text: res.ok ? res.message ?? "Saved" : res.error ?? "Something went wrong" });
      if (res.ok) router.refresh();
    });

  if (!row.active) {
    return (
      <tr className="text-slate-400">
        <td className="px-4 py-2 line-through">{row.name}</td>
        <td className="px-4 py-2">{row.quantity ?? "—"}</td>
        <td className="px-4 py-2">{row.inventoryTracked ? "Tracked" : "Bulk"}</td>
        <td className="px-4 py-2 text-right">
          <span className="mr-2 text-xs">Retired</span>
          <button type="button" disabled={pending} onClick={() => run(() => setEquipmentTypeActiveAction(row.id, true))} className="text-xs font-medium text-teal hover:underline">Reactivate</button>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="px-4 py-2"><input aria-label="Type name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={`${cell} w-full min-w-[10rem] font-medium text-navy`} /></td>
      <td className="px-4 py-2"><input aria-label="Quantity" type="number" min={0} value={v.quantity ?? ""} onChange={(e) => setV({ ...v, quantity: e.target.value })} placeholder="—" className={`${cell} w-24`} /></td>
      <td className="px-4 py-2">
        <label className="flex items-center gap-1.5 text-sm text-slate-600" title="Tracked: each unit is booked individually and clashes are flagged. Bulk: shared kit, no clash checks.">
          <input type="checkbox" checked={v.inventoryTracked} onChange={(e) => setV({ ...v, inventoryTracked: e.target.checked })} /> Tracked
        </label>
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-right">
        {dirty ? <button type="button" disabled={pending} onClick={() => run(() => saveEquipmentTypeAction(row.id, v))} className="mr-3 rounded bg-teal px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "…" : "Save"}</button> : null}
        <button type="button" disabled={pending} onClick={() => { if (confirm(`Delete "${row.name}"? If any unit, course or course type still uses it, it is retired instead.`)) run(() => deleteOrRetireEquipmentTypeAction(row.id)); }} className="text-xs text-slate-400 hover:text-port">Delete</button>
      </td>
    </tr>
  );
}

/** Equipment types live here (moved from Settings): name, quantity, tracked/bulk. */
export function EquipmentTypeManager({ rows }: { rows: EquipmentTypeRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const blank: EquipmentTypeInput = { name: "", quantity: "", inventoryTracked: true };
  const [nv, setNv] = useState<EquipmentTypeInput>(blank);

  const add = () =>
    start(async () => {
      const res = await saveEquipmentTypeAction(null, nv);
      setMsg({ ok: res.ok, text: res.ok ? res.message ?? "Added" : res.error ?? "Could not add" });
      if (res.ok) { setNv(blank); router.refresh(); }
    });

  const activeRows = rows.filter((r) => r.active);
  const retiredRows = rows.filter((r) => !r.active);

  return (
    <div>
      <div className="overflow-x-auto rounded-card border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Type</th><th className="px-4 py-3">Quantity</th><th className="px-4 py-3">Tracking</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeRows.map((r) => <Row key={`${r.id}-${r.active}`} row={r} onMsg={setMsg} />)}
            <tr className="bg-teal/5">
              <td className="px-4 py-2"><input aria-label="New type name" value={nv.name} onChange={(e) => setNv({ ...nv, name: e.target.value })} placeholder="Add a type, e.g. Pico dinghy" className={`${cell} w-full min-w-[10rem]`} /></td>
              <td className="px-4 py-2"><input aria-label="New quantity" type="number" min={0} value={nv.quantity ?? ""} onChange={(e) => setNv({ ...nv, quantity: e.target.value })} placeholder="How many" className={`${cell} w-24`} /></td>
              <td className="px-4 py-2"><label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" checked={nv.inventoryTracked} onChange={(e) => setNv({ ...nv, inventoryTracked: e.target.checked })} /> Tracked</label></td>
              <td className="px-4 py-2 text-right"><button type="button" disabled={pending || !nv.name.trim()} onClick={add} className="rounded bg-teal px-3 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "…" : "Add"}</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      {retiredRows.length > 0 ? (
        <details className="mt-3 rounded-card border border-slate-200 bg-white">
          <summary className="cursor-pointer px-4 py-2 text-sm font-semibold text-navy">Retired types <span className="font-normal text-slate-400">({retiredRows.length})</span></summary>
          <table className="w-full min-w-[560px] text-left text-sm"><tbody className="divide-y divide-slate-100 border-t border-slate-100">{retiredRows.map((r) => <Row key={`${r.id}-${r.active}`} row={r} onMsg={setMsg} />)}</tbody></table>
        </details>
      ) : null}
      {msg ? <p role="status" className={`mt-2 text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</p> : null}
    </div>
  );
}
