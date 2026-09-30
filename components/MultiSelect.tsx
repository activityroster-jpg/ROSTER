"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface MSOption { id: string; name: string }

/**
 * A dropdown multi-select with tick boxes and a search filter. Shows "N selected"
 * on the trigger. The panel stays open while you tick several options and only
 * closes when you click away (or press Escape). The panel is anchored to the
 * trigger, so adding selected chips below never shifts or collapses it.
 */
export function MultiSelect({
  placeholder, options, selected, onToggle, onSelectAll, onClear,
}: {
  placeholder: string;
  options: MSOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll?: () => void;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside the whole control, or on Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => o.name.toLowerCase().includes(t)) : options;
  }, [options, q]);
  const count = selected.size;
  const label = count === 0 ? placeholder : `${count} selected`;

  return (
    <div ref={rootRef}>
      {/* Trigger + panel share this relative wrapper, so the panel anchors to the
          trigger and the chips below don't move it. */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm outline-none focus:border-teal"
        >
          <span className={count ? "text-navy" : "text-slate-400"}>{label}</span>
          <span className="text-slate-400">▾</span>
        </button>

        {open ? (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 min-w-[16rem] rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="mb-2 w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-teal" />
            <div className="mb-2 flex justify-between text-xs">
              {onSelectAll ? <button type="button" onClick={onSelectAll} className="font-semibold text-teal hover:underline">Select all</button> : <span />}
              {onClear ? <button type="button" onClick={onClear} className="font-semibold text-slate-400 hover:text-navy">Clear</button> : <span />}
            </div>
            <ul className="max-h-64 space-y-0.5 overflow-y-auto">
              {filtered.length === 0 ? <li className="px-2 py-1 text-sm text-slate-400">No matches</li> : filtered.map((o) => {
                const on = selected.has(o.id);
                return (
                  <li key={o.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                      <input type="checkbox" checked={on} onChange={() => onToggle(o.id)} className="h-4 w-4 rounded border-slate-300 text-teal focus:ring-teal" />
                      <span className="text-slate-700">{o.name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>

      {count > 0 ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {options.filter((o) => selected.has(o.id)).map((o) => (
            <span key={o.id} className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-2 py-0.5 text-xs text-teal">
              {o.name}
              <button type="button" onClick={() => onToggle(o.id)} className="text-teal/70 hover:text-teal" aria-label={`Remove ${o.name}`}>×</button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
