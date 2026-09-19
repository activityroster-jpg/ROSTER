"use client";

import { useState, useTransition } from "react";
import { setAvailabilityAction } from "@/app/(app)/portal/availability/actions";
import type { SlotCode } from "@/lib/db/schema";

type Status = "available" | "tentative" | "unavailable";
const SLOTS: SlotCode[] = ["AM", "PM", "EV"];

// Tap cycles: (none) → available → tentative → unavailable → (none)
const NEXT: Record<string, Status | null> = {
  none: "available",
  available: "tentative",
  tentative: "unavailable",
  unavailable: null,
};

const STYLES: Record<string, string> = {
  none: "bg-slate-100 text-slate-400",
  available: "bg-starboard/15 text-starboard",
  tentative: "bg-amber/15 text-amber",
  unavailable: "bg-port/15 text-port",
};
const LABEL: Record<string, string> = {
  none: "—",
  available: "Free",
  tentative: "Maybe",
  unavailable: "Busy",
};

export function AvailabilityGrid({
  days,
  initial,
}: {
  days: { iso: string; label: string }[];
  initial: Record<string, Status>;
}) {
  const [state, setState] = useState<Record<string, Status | undefined>>(initial);
  const [pending, startTransition] = useTransition();

  const cycle = (date: string, slot: SlotCode) => {
    const key = `${date}|${slot}`;
    const current = state[key] ?? "none";
    const next = NEXT[current] ?? null;
    setState((s) => ({ ...s, [key]: next ?? undefined }));
    startTransition(async () => {
      const res = await setAvailabilityAction({ date, slot, status: next });
      if (!res.ok) setState((s) => ({ ...s, [key]: current === "none" ? undefined : (current as Status) }));
    });
  };

  return (
    <div className="space-y-2">
      {days.map((d) => (
        <div key={d.iso} className="flex items-center gap-2">
          <div className="w-16 flex-none text-sm font-medium text-navy">{d.label}</div>
          <div className="grid flex-1 grid-cols-3 gap-2">
            {SLOTS.map((slot) => {
              const status = state[`${d.iso}|${slot}`] ?? "none";
              return (
                <button
                  key={slot}
                  onClick={() => cycle(d.iso, slot)}
                  disabled={pending}
                  className={`rounded-lg px-2 py-3 text-xs font-medium transition ${STYLES[status]} disabled:opacity-60`}
                >
                  <span className="block text-[10px] uppercase opacity-70">{slot}</span>
                  {LABEL[status]}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="pt-2 text-center text-xs text-slate-400">Tap to cycle: Free → Maybe → Busy → clear</p>
    </div>
  );
}
