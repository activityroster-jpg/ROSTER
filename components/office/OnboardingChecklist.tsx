"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleOnboardingAction } from "@/app/(app)/office/staff/actions";

export interface OnboardingUiItem {
  id: string;
  label: string;
  done: boolean;
}

export function OnboardingChecklist({ items: initial }: { items: OnboardingUiItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();

  const toggle = (id: string, done: boolean) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, done } : x)));
    startTransition(async () => {
      const res = await toggleOnboardingAction(id, done);
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
          <li key={it.id}>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={it.done}
                disabled={pending}
                onChange={(e) => toggle(it.id, e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal focus:ring-teal"
              />
              <span className={it.done ? "text-slate-500 line-through" : "text-navy"}>{it.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
