"use client";

import { useMemo, useState, useTransition } from "react";
import { setAvailabilityAction, setAvailabilityBulkAction, setAvailabilityNoteAction, setAvailabilityPatternAction } from "@/app/(app)/portal/availability/actions";
import type { SlotCode } from "@/lib/db/schema";
import { addDaysIso, keyOf, patternKeyOf, weekdayOf, type AvailabilityAnswer, type AvailabilityHorizon } from "@/lib/domain/availability";

type Status = AvailabilityAnswer;
const SLOTS: SlotCode[] = ["AM", "PM", "EV"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Mon…Sun rows → JavaScript weekday (0 = Sunday). */
const ROW_WEEKDAY = [1, 2, 3, 4, 5, 6, 0];

/** Tap order: Busy → Free → Maybe → Busy. There is no blank. */
const NEXT: Record<Status, Status> = { unavailable: "available", available: "tentative", tentative: "unavailable" };
const LABEL: Record<Status, string> = { available: "Free", tentative: "Maybe", unavailable: "Busy" };
const STYLE: Record<Status, string> = {
  available: "bg-starboard/15 text-starboard",
  tentative: "bg-amber/15 text-amber",
  unavailable: "bg-port/15 text-port",
};
/** Busy nobody chose (the default) is quieter than a Busy someone tapped. */
const DEFAULT_STYLE = "bg-slate-100 text-slate-400";
/** Office-managed: free nobody chose is quieter than a Free someone tapped. */
const ASSUMED_STYLE = "bg-starboard/[0.06] text-starboard/60";

const fmtDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtRange = (iso: string) => `${fmtDate(iso)} – ${fmtDate(addDaysIso(iso, 6))}`;

export function AvailabilityWeeks({ horizon, dated: initialDated, pattern: initialPattern, notes: initialNotes, assumeFree = false }: {
  horizon: AvailabilityHorizon;
  dated: Record<string, Status>;
  pattern: Record<string, Status>;
  notes: Record<string, string>;
  /** The office keeps this person's availability: an unanswered slot counts as Free. */
  assumeFree?: boolean;
}) {
  const fallback: Status = assumeFree ? "available" : "unavailable";
  const mondays = useMemo(() => Array.from({ length: horizon.weeksAhead }, (_, i) => addDaysIso(horizon.from, i * 7)), [horizon]);
  const [tab, setTab] = useState<"weeks" | "usual">("weeks");
  const [idx, setIdx] = useState(0);
  const [dated, setDated] = useState<Record<string, Status | undefined>>(initialDated);
  const [pattern, setPattern] = useState<Record<string, Status | undefined>>(initialPattern);
  const [notes, setNotes] = useState<Record<string, string>>(initialNotes);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const monday = mondays[idx]!;
  const days = DAY_LABELS.map((label, i) => ({ iso: addDaysIso(monday, i), label }));

  /** What applies to a date and slot right now, and whether anyone chose it. */
  const effective = (date: string, slot: SlotCode): { status: Status; source: "set" | "pattern" | "default" } => {
    const set = dated[keyOf(date, slot)];
    if (set) return { status: set, source: "set" };
    const usual = pattern[patternKeyOf(weekdayOf(date), slot)];
    if (usual) return { status: usual, source: "pattern" };
    return { status: fallback, source: "default" };
  };

  const run = (work: () => Promise<{ ok: boolean; error?: string }>, rollback: () => void) => {
    setError(null);
    startTransition(async () => {
      const res = await work();
      if (!res.ok) { rollback(); setError(res.error ?? "Couldn't save, try again"); }
    });
  };

  const cycle = (date: string, slot: SlotCode) => {
    const key = keyOf(date, slot);
    const before = dated[key];
    const now = effective(date, slot);
    // Office-managed: the first tap on an unanswered (free) slot marks it Busy.
    const next = assumeFree && now.source === "default" ? "unavailable" : NEXT[now.status];
    setDated((s) => ({ ...s, [key]: next }));
    run(() => setAvailabilityAction({ date, slot, status: next }), () => setDated((s) => ({ ...s, [key]: before })));
  };

  /** Set every slot of the visible week in one go (optimistic, with rollback). `null` removes the dated answer so the usual week applies. */
  const setWeek = (statusFor: (date: string, slot: SlotCode) => Status | null) => {
    const entries = days.flatMap((d) => SLOTS.map((slot) => ({ date: d.iso, slot, status: statusFor(d.iso, slot) })));
    const before = { ...dated };
    setDated((s) => {
      const next = { ...s };
      for (const e of entries) { if (e.status) next[keyOf(e.date, e.slot)] = e.status; else delete next[keyOf(e.date, e.slot)]; }
      return next;
    });
    run(() => setAvailabilityBulkAction(entries), () => setDated(before));
  };
  const copyLastWeek = () => setWeek((date, slot) => effective(addDaysIso(date, -7), slot).status);
  const allFree = () => setWeek(() => "available");
  const resetToUsual = () => setWeek(() => null);
  const weekHasAnswers = days.some((d) => SLOTS.some((slot) => dated[keyOf(d.iso, slot)]));

  const cyclePattern = (weekday: number, slot: SlotCode) => {
    const key = patternKeyOf(weekday, slot);
    const before = pattern[key];
    const next = before ? NEXT[before] : assumeFree ? "unavailable" : NEXT.unavailable;
    setPattern((s) => ({ ...s, [key]: next }));
    run(() => setAvailabilityPatternAction({ weekday, slot, status: next }), () => setPattern((s) => ({ ...s, [key]: before })));
  };

  const saveNote = (date: string, text: string) => {
    const before = notes[date] ?? "";
    const next = text.trim().slice(0, 140);
    setNotes((n) => { const c = { ...n }; if (next) c[date] = next; else delete c[date]; return c; });
    setEditingNote(null);
    if (next === before) return;
    run(() => setAvailabilityNoteAction({ date, note: next }), () => setNotes((n) => ({ ...n, [date]: before })));
  };

  const cellButton = (status: Status, source: "set" | "pattern" | "default", slot: SlotCode, onClick: () => void, title: string) => (
    <button type="button" onClick={onClick} disabled={pending} title={title} aria-label={title}
      className={`relative rounded-lg px-2 py-3 text-xs font-medium transition disabled:opacity-60 ${source === "default" ? (assumeFree ? ASSUMED_STYLE : DEFAULT_STYLE) : STYLE[status]}`}>
      <span className="block text-[10px] uppercase opacity-70">{slot}</span>
      {LABEL[status]}
      {source === "pattern" ? <span className="absolute right-1 top-1 text-[9px] font-semibold uppercase tracking-wide opacity-60">usual</span> : null}
    </button>
  );

  return (
    <div>
      {/* Weeks / usual week */}
      <div className="mb-3 grid grid-cols-2 rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
        <button type="button" onClick={() => setTab("weeks")} className={`rounded-md py-1.5 ${tab === "weeks" ? "bg-white text-navy shadow-sm" : "text-slate-500"}`}>Week by week</button>
        <button type="button" onClick={() => setTab("usual")} className={`rounded-md py-1.5 ${tab === "usual" ? "bg-white text-navy shadow-sm" : "text-slate-500"}`}>My usual week</button>
      </div>

      {tab === "usual" ? (
        <div>
          <p className="mb-3 text-xs text-slate-500">Your usual week fills in any day you haven&apos;t answered. Tap to cycle Busy → Free → Maybe. Change a single day under &ldquo;Week by week&rdquo;.</p>
          <div className="space-y-2">
            {DAY_LABELS.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-20 flex-none text-sm font-semibold text-navy">{label}s</div>
                <div className="grid flex-1 grid-cols-3 gap-2">
                  {SLOTS.map((slot) => {
                    const st = pattern[patternKeyOf(ROW_WEEKDAY[i]!, slot)];
                    return <span key={slot}>{cellButton(st ?? fallback, st ? "set" : "default", slot, () => cyclePattern(ROW_WEEKDAY[i]!, slot), `Usual ${label} ${slot}: ${LABEL[st ?? fallback]}`)}</span>;
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
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

          {/* Dots for the window */}
          <div className="mb-4 flex items-center justify-center gap-1.5">
            {mondays.map((m, i) => (
              <button key={m} type="button" onClick={() => setIdx(i)} aria-label={`Week of ${fmtRange(m)}`}
                className={`h-2 rounded-full transition-all ${i === idx ? "w-5 bg-teal" : "w-2 bg-slate-300 hover:bg-slate-400"}`} />
            ))}
          </div>

          {/* Quick fills */}
          <div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-xs">
            <button type="button" onClick={copyLastWeek} disabled={pending || idx === 0} title={idx === 0 ? "There is no earlier week in the window" : "Same answers as the week before"} className="rounded-full border border-slate-300 px-3 py-1 font-medium text-navy hover:bg-slate-50 disabled:opacity-40">Same as last week</button>
            <button type="button" onClick={allFree} disabled={pending} className="rounded-full border border-slate-300 px-3 py-1 font-medium text-navy hover:bg-slate-50 disabled:opacity-40">All free</button>
            <button type="button" onClick={resetToUsual} disabled={pending || !weekHasAnswers} title="Remove this week's answers so your usual week applies" className="rounded-full border border-slate-300 px-3 py-1 font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-40">Back to usual</button>
          </div>

          {/* Grid */}
          <div className="space-y-2">
            {days.map((d) => (
              <div key={d.iso}>
                <div className="flex items-center gap-2">
                  <div className="w-20 flex-none">
                    <div className="text-sm font-semibold text-navy">{d.label}</div>
                    <div className="text-[11px] text-slate-400">{fmtDate(d.iso)}</div>
                    <button type="button" onClick={() => setEditingNote(editingNote === d.iso ? null : d.iso)} className="mt-0.5 text-[11px] font-medium text-teal hover:underline" aria-label={`${notes[d.iso] ? "Edit" : "Add"} note for ${d.label} ${fmtDate(d.iso)}`}>
                      {notes[d.iso] ? "✎ note" : "+ note"}
                    </button>
                  </div>
                  <div className="grid flex-1 grid-cols-3 gap-2">
                    {SLOTS.map((slot) => {
                      const e = effective(d.iso, slot);
                      return <span key={slot}>{cellButton(e.status, e.source, slot, () => cycle(d.iso, slot), `${d.label} ${slot}: ${LABEL[e.status]}${e.source === "pattern" ? " (usual week)" : e.source === "default" ? " (not answered yet)" : ""}. Tap to change`)}</span>;
                    })}
                  </div>
                </div>
                {editingNote === d.iso ? (
                  <input
                    autoFocus
                    type="text"
                    maxLength={140}
                    defaultValue={notes[d.iso] ?? ""}
                    placeholder="A note for the office, e.g. “back by 2pm”"
                    aria-label={`Note for ${d.label} ${fmtDate(d.iso)}`}
                    onBlur={(ev) => saveNote(d.iso, ev.currentTarget.value)}
                    onKeyDown={(ev) => { if (ev.key === "Enter") ev.currentTarget.blur(); if (ev.key === "Escape") setEditingNote(null); }}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-teal"
                  />
                ) : notes[d.iso] ? (
                  <p className="mt-1 text-xs text-slate-500" style={{ paddingLeft: "5.5rem" }}>“{notes[d.iso]}”</p>
                ) : null}
              </div>
            ))}
          </div>
          <p className="pt-3 text-center text-xs text-slate-400">{assumeFree
            ? "Tap a slot to mark it Busy · faint Free means your centre counts you as free there"
            : <>Tap to cycle: Busy → Free → Maybe · grey Busy means you haven&apos;t answered yet · your centre asks {horizon.weeksAhead} week{horizon.weeksAhead === 1 ? "" : "s"} ahead</>}</p>
        </>
      )}
      {error ? <p className="mt-2 text-center text-xs text-port">{error}</p> : null}
    </div>
  );
}
