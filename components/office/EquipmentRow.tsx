"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteOrRetireEquipmentAction, setEquipmentUnitStatusAction } from "@/app/(app)/office/equipment/actions";

export interface EquipmentUnitRow { id: string; name: string; type: string; identifier: string | null; status: string; referenced: boolean }

/** One unit: available ↔ in maintenance, and Delete (never used) or Retire (used by a course). */
export function EquipmentRow({ row }: { row: EquipmentUnitRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const retired = row.status === "retired";
  const setStatus = (status: "available" | "maintenance") => start(async () => {
    const r = await setEquipmentUnitStatusAction(row.id, status);
    setMsg(r.ok ? null : r.error ?? "Failed");
    router.refresh();
  });
  const remove = () => {
    const q = row.referenced ? `Retire "${row.name}"? Courses that used it keep showing it; it won't be offered for new ones.` : `Delete "${row.name}"? No course has used it, so it goes for good.`;
    if (!confirm(q)) return;
    start(async () => { const r = await deleteOrRetireEquipmentAction(row.id); setMsg(r.ok ? r.message ?? null : r.error ?? "Failed"); router.refresh(); });
  };
  return (
    <tr className={retired ? "text-slate-400" : ""}>
      <td className={`px-4 py-2.5 font-medium ${retired ? "line-through" : "text-navy"}`}>{row.name}</td>
      <td className="px-4 py-2.5 text-slate-600">{row.type}</td>
      <td className="px-4 py-2.5 text-slate-600">{row.identifier ?? "—"}</td>
      <td className="px-4 py-2.5">
        {retired ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Retired</span>
        ) : (
          <select aria-label={`${row.name} status`} value={row.status} disabled={pending} onChange={(e) => setStatus(e.target.value as "available" | "maintenance")} className={`rounded-lg border px-2 py-1 text-xs font-medium outline-none focus:border-teal ${row.status === "maintenance" ? "border-amber/50 bg-amber/10 text-amber" : "border-starboard/40 bg-starboard/10 text-starboard"}`}>
            <option value="available">Available</option>
            <option value="maintenance">In maintenance</option>
          </select>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right">
        {msg ? <span className="mr-2 text-xs text-slate-400">{msg}</span> : null}
        {retired ? (
          <button type="button" disabled={pending} onClick={() => setStatus("available")} className="text-xs font-medium text-teal hover:underline disabled:opacity-50">Bring back</button>
        ) : (
          <button type="button" disabled={pending} onClick={remove} className="text-xs text-slate-400 hover:text-port disabled:opacity-50">{row.referenced ? "Retire" : "Delete"}</button>
        )}
      </td>
    </tr>
  );
}
