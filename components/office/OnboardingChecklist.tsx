"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleOnboardingAction } from "@/app/(app)/office/staff/actions";

export interface OnboardingUiItem {
  key: string;
  label: string;
  done: boolean;
  /** Ticks itself from the person's record; shown, not clickable. */
  auto: boolean;
  hint?: string;
  /** Where to sort an automatic step out (a section on this page). */
  href?: string;
  /** The row a manual tick saves to. */
  rowId?: string;
}

export function OnboardingChecklist({ items: initial }: { items: OnboardingUiItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();

  const toggle = (rowId: string, done: boolean) => {
    setItems((xs) => xs.map((x) => (x.rowId === rowId ? { ...x, done } : x)));
    startTransition(async () => {
      const res = await toggleOnboardingAction(rowId, done);
      if (!res.ok) setItems(initial);
      else router.refresh();
    });
  };

  const done = items.filter((i) => i.done).length;

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-starboard" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
        </div>
        <span className="text-xs font-semibold text-slate-500">{done}/{items.length}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.key}>
            {it.auto ? (
              <div className="flex items-start gap-2 text-sm" title={it.hint}>
                <span aria-hidden className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] font-bold ${it.done ? "bg-starboard text-white" : "border-2 border-dashed border-slate-300 bg-white"}`}>{it.done ? "✓" : ""}</span>
                <span className="min-w-0">
                  <span className={it.done ? "text-slate-500 line-through" : "text-navy"}>{it.label}</span>
                  <span className="sr-only">{it.done ? " (done)" : " (not yet)"}</span>
                  {!it.done ? (
                    <span className="block text-[11px] text-slate-400">
                      {it.hint}{it.href ? <> <a href={it.href} className="font-medium text-teal hover:underline">Go there</a></> : null}
                    </span>
                  ) : null}
                </span>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={it.done}
                  disabled={pending || !it.rowId}
                  onChange={(e) => it.rowId && toggle(it.rowId, e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal focus:ring-teal"
                />
                <span className={it.done ? "text-slate-500 line-through" : "text-navy"}>{it.label}</span>
              </label>
            )}
          </li>
        ))}
      </ul>
      {items.some((i) => i.auto) ? <p className="mt-3 text-[11px] text-slate-400">Steps with a round tick follow their record and tick themselves.</p> : null}
    </div>
  );
}
