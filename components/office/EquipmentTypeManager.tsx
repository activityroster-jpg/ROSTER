"use client";

import { askConfirm } from "@/lib/ui/ask-confirm";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteOrRetireEquipmentTypeAction, saveEquipmentTypeAction, setEquipmentTypeActiveAction, type EquipmentTypeInput } from "@/app/(app)/office/equipment/actions";

export interface EquipmentTypeRow { id: string; name: string; quantity: number | null; inventoryTracked: boolean; active: boolean; /** Units of this type listed below (not retired). */ listed: number }

const cell = "rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-teal";

const BY_NAME = "Each one by name";
const BY_NUMBER = "Just a number";
const COUNT_HELP = "Each one by name: list every boat or board below; courses book them one by one and clashes are flagged. Just a number: a shared pool (wetsuits, buoyancy aids); courses ask for how many they need.";

/** Named types are counted from the list below, so they carry no number of their own. */
function payload(v: EquipmentTypeInput): EquipmentTypeInput {
  return v.inventoryTracked ? { ...v, quantity: "" } : v;
}

function CountChoice({ value, onChange, label }: { value: boolean; onChange: (named: boolean) => void; label: string }) {
  return (
    <select aria-label={label} title={COUNT_HELP} value={value ? "named" : "number"} onChange={(e) => onChange(e.target.value === "named")} className={`${cell} bg-white`}>
      <option value="named">{BY_NAME}</option>
      <option value="number">{BY_NUMBER}</option>
    </select>
  );
}

function Listed({ n }: { n: number }) {
  return n > 0
    ? <a href="#equipment-list" className="text-sm text-teal hover:underline">{n} listed</a>
    : <a href="#add-equipment" className="text-sm text-slate-500 hover:text-teal hover:underline">None listed yet · add below</a>;
}

function Row({ row, onMsg }: { row: EquipmentTypeRow; onMsg: (m: { ok: boolean; text: string }) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState<EquipmentTypeInput>({ name: row.name, quantity: row.quantity ?? "", inventoryTracked: row.inventoryTracked });
  const dirty = v.name !== row.name || v.inventoryTracked !== row.inventoryTracked || (!v.inventoryTracked && String(v.quantity ?? "") !== String(row.quantity ?? ""));

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
        <td className="px-4 py-2">{row.inventoryTracked ? BY_NAME : BY_NUMBER}</td>
        <td className="px-4 py-2">{row.inventoryTracked ? `${row.listed} listed` : row.quantity ?? "Not set"}</td>
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
      <td className="px-4 py-2"><CountChoice label={`How you count ${row.name}`} value={v.inventoryTracked} onChange={(named) => setV({ ...v, inventoryTracked: named })} /></td>
      <td className="px-4 py-2">
        {v.inventoryTracked
          ? <Listed n={row.listed} />
          : <input aria-label="How many you have" type="number" min={0} value={v.quantity ?? ""} onChange={(e) => setV({ ...v, quantity: e.target.value })} placeholder="How many" className={`${cell} w-24`} />}
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-right">
        {dirty ? <button type="button" disabled={pending} onClick={() => run(() => saveEquipmentTypeAction(row.id, payload(v)))} className="mr-3 rounded bg-teal px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "…" : "Save"}</button> : null}
        <button type="button" disabled={pending} onClick={async () => { if (await askConfirm(`Delete "${row.name}"? If any unit, course or course type still uses it, it is retired instead.`)) run(() => deleteOrRetireEquipmentTypeAction(row.id)); }} className="text-xs text-slate-400 hover:text-port">Delete</button>
      </td>
    </tr>
  );
}

/** Equipment types live here (moved from Settings): name, and whether each one is listed by name or kept as just a number. */
export function EquipmentTypeManager({ rows }: { rows: EquipmentTypeRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const blank: EquipmentTypeInput = { name: "", quantity: "", inventoryTracked: true };
  const [nv, setNv] = useState<EquipmentTypeInput>(blank);

  const add = () =>
    start(async () => {
      const res = await saveEquipmentTypeAction(null, payload(nv));
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
            <tr><th className="px-4 py-3">Type</th><th className="px-4 py-3" title={COUNT_HELP}>How you count them</th><th className="px-4 py-3">How many</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeRows.map((r) => <Row key={`${r.id}-${r.active}`} row={r} onMsg={setMsg} />)}
            <tr className="bg-teal/5">
              <td className="px-4 py-2"><input aria-label="New type name" value={nv.name} onChange={(e) => setNv({ ...nv, name: e.target.value })} placeholder="Add a type, e.g. Pico dinghy" className={`${cell} w-full min-w-[10rem]`} /></td>
              <td className="px-4 py-2"><CountChoice label="How you count the new type" value={nv.inventoryTracked} onChange={(named) => setNv({ ...nv, inventoryTracked: named })} /></td>
              <td className="px-4 py-2">
                {nv.inventoryTracked
                  ? <span className="text-xs text-slate-500">List each one below once it&apos;s added</span>
                  : <input aria-label="How many of the new type" type="number" min={0} value={nv.quantity ?? ""} onChange={(e) => setNv({ ...nv, quantity: e.target.value })} placeholder="How many" className={`${cell} w-24`} />}
              </td>
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
