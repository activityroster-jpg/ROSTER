"use client";

import { useEffect, useRef } from "react";

/**
 * A confirmation that names the consequences (audit C-level: "replace confirm()
 * on destructive actions with a proper dialog"). Pass what will happen as
 * `consequences`, one plain line each; the primary button says the verb.
 */
export function ConfirmDialog({ open, title, consequences, confirmLabel = "Confirm", tone = "port", busy = false, onConfirm, onCancel, children }: {
  open: boolean;
  title: string;
  consequences: string[];
  confirmLabel?: string;
  tone?: "port" | "teal" | "navy";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Optional extra controls (a reason box, a choice). */
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const btn = tone === "port" ? "bg-port hover:opacity-90" : tone === "teal" ? "bg-teal hover:bg-teal-700" : "bg-navy hover:opacity-90";
  return (
    <dialog ref={ref} onClose={onCancel} onCancel={(e) => { e.preventDefault(); onCancel(); }} className="w-full max-w-md rounded-card border border-slate-200 bg-white p-0 text-left shadow-xl backdrop:bg-navy/40">
      <div className="p-5">
        <h2 className="font-display text-lg font-semibold text-navy">{title}</h2>
        {consequences.length ? (
          <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
            {consequences.map((c, i) => <li key={i} className="flex gap-2"><span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-slate-400" /><span>{c}</span></li>)}
          </ul>
        ) : null}
        {children ? <div className="mt-3">{children}</div> : null}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy hover:bg-slate-50 disabled:opacity-50">Keep as it is</button>
          <button type="button" onClick={onConfirm} disabled={busy} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${btn}`}>{busy ? "Working…" : confirmLabel}</button>
        </div>
      </div>
    </dialog>
  );
}
