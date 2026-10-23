"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const KEYS: [string, string][] = [
  ["← / [", "Previous week"],
  ["→ / ]", "Next week"],
  ["T", "This week"],
  ["P", "Board / print view"],
  ["E", "Emergency sheet"],
  ["?", "This list"],
];

const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Keyboard shortcuts for the roster week, for the office that lives on this page; "?" shows the list. */
export function BoardShortcuts({ monday, thisMonday, view }: { monday: string; thisMonday: string; view: "board" | "print" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      const go = (week: string, v: "board" | "print" = view) => router.push(`/office/rota?week=${week}${v === "print" ? "&view=print" : ""}`);
      switch (e.key) {
        case "ArrowLeft": case "[": go(addDays(monday, -7)); break;
        case "ArrowRight": case "]": go(addDays(monday, 7)); break;
        case "t": case "T": go(thisMonday); break;
        case "p": case "P": go(monday, view === "print" ? "board" : "print"); break;
        case "e": case "E": router.push("/office/rota/emergency"); break;
        case "?": setOpen((o) => !o); break;
        case "Escape": setOpen(false); break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [monday, thisMonday, view, router]);
  return (
    <span className="relative hidden lg:inline-block print:hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} title="Keyboard shortcuts (?)" className="text-xs text-slate-400 hover:text-navy">⌨ Shortcuts</button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs shadow-lg">
          <p className="mb-2 font-semibold text-navy">Keyboard shortcuts</p>
          <ul className="space-y-1">{KEYS.map(([k, what]) => <li key={k} className="flex justify-between gap-3"><span className="font-mono text-slate-500">{k}</span><span className="text-slate-700">{what}</span></li>)}</ul>
        </div>
      ) : null}
    </span>
  );
}
