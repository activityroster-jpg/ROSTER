"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Open on laptops, folded on phones (audit A1-4, option B): the calendar is
 * useful at a desk and a long scroll at the slipway.
 */
export function Collapsible({ title, children, openAbove = 768 }: { title: string; children: ReactNode; openAbove?: number }) {
  const [open, setOpen] = useState(true);
  const [decided, setDecided] = useState(false);
  useEffect(() => {
    try { setOpen(window.matchMedia(`(min-width: ${openAbove}px)`).matches); } catch { setOpen(true); }
    setDecided(true);
  }, [openAbove]);
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mb-2 flex w-full items-center justify-between text-left md:pointer-events-none">
        <span className="font-display text-lg font-semibold text-navy">{title}</span>
        <span className="text-xs text-slate-400 md:hidden">{open ? "Hide" : "Show"}</span>
      </button>
      <div hidden={decided && !open}>{children}</div>
    </div>
  );
}
