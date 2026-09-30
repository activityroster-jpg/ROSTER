"use client";

import { useMemo, useState, useTransition } from "react";
import { setAvailabilityAction } from "@/app/(app)/portal/availability/actions";
import type { SlotCode } from "@/lib/db/schema";

type Status = "available" | "tentative" | "unavailable";
const SLOTS: SlotCode[] = ["AM", "PM", "EV"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
const LABEL: Record<string, string> = { none: "—", available: "Free", tentative: "Maybe", unavailable: "Busy" };

function mondayOf(d: Date): string {
  const c = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  c.setUTCDate(c.getUTCDate() - ((c.getUTCDay() + 6) % 7));
  return c.toISOString().slice(0, 10);
}
const addDaysIso = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const fmtRange = (iso: string) => {
  const f = (x: string) => new Date(`${x}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${f(iso)} – ${f(addDaysIso(iso, 6))}`;
};
const fmtDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function AvailabilityWeeks({ weeksAhead, initial }: { weeksAhead: number; initial: Record<string, Status> }) {
  const thisMonday = mondayOf(new Date());
  const mondays = useMemo(() => Array.from({ length: Math.max(1, weeksAhead) }, (_, i) => addDaysIso(thisMonday, i * 7)), [thisMonday, weeksAhead]);
  const [idx, setIdx] = useState(0);
  const [state, setState] = useState<Record<string, Status | undefined>>(initial);
  const [pending, startTransition] = useTransition();

  const monday = mondays[idx]!;
  const days = DAY_LABELS.map((label, i) => ({ iso: addDaysIso(monday, i), label }));

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
    <div>
      {/* Week navigation */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-navy hover:bg-slate-50 disabled:opacity-40" aria-label="Previous week">←</button>
        <div className="text-center">
          <p className="text-sm font-semibold text-navy" aria-live="polite">{fmtRange(monday)}</p>
          <p className="text-xs text-slate-400">{idx === 0 ? "This week" : idx === 1 ? "Next week" : `In ${idx} weeks`}</p>
        </div>
        <button type="button" onClick={() => setIdx((i) => Math.min(mondays.length - 1, i + 1))} disabled={idx >= mondays.length - 1}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-navy hover:bg-slate-50 disabled:opacity-40" aria-label="Next week">→</button>
      </div>

      {/* Dots for the horizon */}
      <div className="mb-4 flex items-center justify-center gap-1.5">
        {mondays.map((m, i) => (
          <button key={m} type="button" onClick={() => setIdx(i)} aria-label={`Week of ${fmtRange(m)}`}
            className={`h-2 rounded-full transition-all ${i === idx ? "w-5 bg-teal" : "w-2 bg-slate-300 hover:bg-slate-400"}`} />
        ))}
      </div>

      {/* Grid */}
      <div className="space-y-2">
        {days.map((d) => (
          <div key={d.iso} className="flex items-center gap-2">
            <div className="w-20 flex-none">
              <div className="text-sm font-semibold text-navy">{d.label}</div>
              <div className="text-[11px] text-slate-400">{fmtDate(d.iso)}</div>
            </div>
            <div className="grid flex-1 grid-cols-3 gap-2">
              {SLOTS.map((slot) => {
                const status = state[`${d.iso}|${slot}`] ?? "none";
                return (
                  <button key={slot} onClick={() => cycle(d.iso, slot)} disabled={pending}
                    className={`rounded-lg px-2 py-3 text-xs font-medium transition ${STYLES[status]} disabled:opacity-60`}>
                    <span className="block text-[10px] uppercase opacity-70">{slot}</span>
                    {LABEL[status]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="pt-3 text-center text-xs text-slate-400">Tap to cycle: Free → Maybe → Busy → clear · you can set up to {mondays.length} weeks ahead</p>
    </div>
  );
}
