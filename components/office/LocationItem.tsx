"use client";

import { askConfirm } from "@/lib/ui/ask-confirm";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteOrRetireLocationAction, setLocationActiveAction } from "@/app/(app)/office/locations/actions";

/**
 * One location: delete it when no course has ever used it, otherwise retire it
 * (it keeps rendering on old courses). Retired ones offer Reactivate.
 */
export function LocationItem({ id, name, active, referenced }: { id: string; name: string; active: boolean; referenced: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const remove = async () => {
    const q = referenced ? `Retire "${name}"? Courses that used it keep showing it; it won't be offered for new ones.` : `Delete "${name}"? Nothing has used it, so it goes for good.`;
    if (!await askConfirm(q)) return;
    start(async () => { const r = await deleteOrRetireLocationAction(id); setMsg(r.ok ? r.message ?? null : r.error ?? "Failed"); router.refresh(); });
  };
  const reactivate = () => start(async () => {
    const fd = new FormData(); fd.set("id", id); fd.set("active", "true");
    const r = await setLocationActiveAction({ ok: false }, fd);
    if (!r.ok) setMsg(r.error ?? "Failed");
    router.refresh();
  });
  return (
    <li className="flex items-center justify-between gap-2 py-1">
      <span className={active ? "text-sm text-slate-700" : "text-sm text-slate-400 line-through"}>{name}</span>
      <span className="flex items-center gap-2">
        {msg ? <span className="text-xs text-slate-400">{msg}</span> : null}
        {active ? (
          <button type="button" disabled={pending} onClick={remove} className="text-xs text-slate-400 hover:text-port disabled:opacity-50">{referenced ? "Retire" : "Delete"}</button>
        ) : (
          <button type="button" disabled={pending} onClick={reactivate} className="text-xs font-medium text-teal hover:underline disabled:opacity-50">Reactivate</button>
        )}
      </span>
    </li>
  );
}
