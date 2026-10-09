"use client";

import { askConfirm } from "@/lib/ui/ask-confirm";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renameLocationCategoryAction, setLocationCategoryActiveAction } from "@/app/(app)/office/locations/actions";

/** Category box header: name with inline rename + retire (moved from Settings). */
export function LocationCategoryHeader({ id, name, count }: { id: string; name: string; count: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);
  const [err, setErr] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) setErr(res.error ?? "Something went wrong");
      else { setErr(null); after?.(); router.refresh(); }
    });

  if (editing) {
    return (
      <div className="mb-2">
        <div className="flex items-center gap-1.5">
          <input value={val} onChange={(e) => setVal(e.target.value)} autoFocus aria-label="Category name" className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-teal" />
          <button type="button" disabled={pending} onClick={() => run(() => renameLocationCategoryAction(id, val), () => setEditing(false))} className="rounded bg-teal px-2 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">Save</button>
          <button type="button" onClick={() => { setVal(name); setEditing(false); }} className="text-xs text-slate-400 hover:text-navy">✕</button>
        </div>
        {err ? <p className="mt-1 text-xs text-port">{err}</p> : null}
      </div>
    );
  }

  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="font-semibold text-navy">{name} <span className="ml-1 text-xs font-normal text-slate-400">{count}</span></h3>
      <span className="flex flex-none items-center gap-2">
        <button type="button" onClick={() => setEditing(true)} className="text-xs text-slate-400 hover:text-navy">Edit</button>
        <button type="button" disabled={pending} onClick={async () => { if (await askConfirm(`Retire the "${name}" category? Its locations stay, under "Uncategorised".`)) run(() => setLocationCategoryActiveAction(id, false)); }} className="text-xs text-slate-400 hover:text-navy">Retire</button>
      </span>
    </div>
  );
}

/** A retired category with a Reactivate control. */
export function RetiredLocationCategory({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <li className="flex items-center justify-between gap-2 py-1 text-sm">
      <span className="text-slate-400 line-through">{name}</span>
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await setLocationCategoryActiveAction(id, true); if (r.ok) router.refresh(); })} className="text-xs font-medium text-teal hover:underline">Reactivate</button>
    </li>
  );
}
