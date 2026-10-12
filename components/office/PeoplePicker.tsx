"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TIER_LABEL, type CandidateTier } from "@/lib/domain/assign-order";

export interface PickerItem { id: string; label: string; note?: string }
export interface PickerGroup { tier: CandidateTier; items: PickerItem[] }

const SECTION: Record<CandidateTier, { head: string; row: string; dot: string }> = {
  ready: { head: "bg-starboard/15 text-starboard", row: "bg-starboard/5 hover:bg-starboard/15", dot: "bg-starboard" },
  busy: { head: "bg-amber/15 text-amber", row: "bg-amber/5 hover:bg-amber/15", dot: "bg-amber" },
  blocked: { head: "bg-port/10 text-port", row: "bg-port/5 hover:bg-port/10", dot: "bg-port" },
};

/**
 * The one people picker: three shaded sections in the platform's order
 * (green: qualified and free; orange: qualified but not free; red: not
 * qualified or not cleared), with a type-to-filter box. A native dropdown
 * can't be coloured, so this is a button that opens a list.
 */
export function PeoplePicker({ value, onChange, groups, placeholder = "Choose someone…", ariaLabel, className = "", disabled = false }: {
  value: string; onChange: (id: string) => void; groups: PickerGroup[]; placeholder?: string; ariaLabel: string; className?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const chosen = useMemo(() => groups.flatMap((g) => g.items).find((i) => i.id === value), [groups, value]);
  const chosenTier = useMemo(() => groups.find((g) => g.items.some((i) => i.id === value))?.tier, [groups, value]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", key); };
  }, [open]);

  const needle = q.trim().toLowerCase();
  const shown = groups.map((g) => ({ ...g, items: needle ? g.items.filter((i) => i.label.toLowerCase().includes(needle)) : g.items })).filter((g) => g.items.length > 0);
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div ref={root} className={`relative min-w-0 ${className}`}>
      <button type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} onClick={() => { setOpen((o) => !o); setQ(""); }}
        className="flex w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-left text-sm outline-none focus:border-teal disabled:opacity-50">
        {chosen ? <><span aria-hidden className={`h-2.5 w-2.5 flex-none rounded-full ${SECTION[chosenTier ?? "ready"].dot}`} /><span className="truncate text-navy">{chosen.label}</span></> : <span className="truncate text-slate-400">{placeholder}</span>}
        <span aria-hidden className="ml-auto text-slate-400">▾</span>
      </button>
      {open ? (
        <div className="absolute left-0 z-30 mt-1 w-full min-w-[20rem] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {total > 8 ? <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a name…" aria-label="Filter people" className="w-full border-b border-slate-100 px-3 py-2 text-sm outline-none" /> : null}
          <ul role="listbox" aria-label={ariaLabel} className="max-h-72 overflow-y-auto">
            {shown.length === 0 ? <li className="px-3 py-2 text-xs text-slate-400">Nobody matches.</li> : null}
            {shown.map((g) => (
              <li key={g.tier}>
                <p className={`sticky top-0 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${SECTION[g.tier].head}`}>{TIER_LABEL[g.tier]} · {g.items.length}</p>
                <ul>
                  {g.items.map((i) => (
                    <li key={i.id} role="option" aria-selected={i.id === value}>
                      <button type="button" onClick={() => { onChange(i.id); setOpen(false); }} className={`flex w-full items-start gap-2 px-3 py-1.5 text-left text-sm ${SECTION[g.tier].row} ${i.id === value ? "font-semibold" : ""}`}>
                        <span aria-hidden className={`mt-1.5 h-2 w-2 flex-none rounded-full ${SECTION[g.tier].dot}`} />
                        <span className="min-w-0"><span className="text-navy">{i.label}</span>{i.note ? <span className="block text-xs text-slate-500">{i.note}</span> : null}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
