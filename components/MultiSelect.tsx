"use client";

import { useMemo, useState } from "react";

export interface MSOption { id: string; name: string }

/**
 * A dropdown multi-select with tick boxes and a search filter. Shows "N selected"
 * on the trigger; the panel closes when you click away.
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
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => o.name.toLowerCase().includes(t)) : options;
  }, [options, q]);
  const count = selected.size;
  const label = count === 0 ? placeholder : `${count} selected`;

  return (
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

      {open ? (
        <>
          <button type="button" aria-label="Close" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full min-w-[16rem] rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="mb-2 w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-teal" />
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
        </>
      ) : null}
    </div>
  );
}
