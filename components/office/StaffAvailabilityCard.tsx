"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAvailabilityBulkAction } from "@/app/(app)/office/availability/actions";
import { setManagedByAction } from "@/app/(app)/office/staff/actions";

type Status = "available" | "tentative" | "unavailable";
type Brush = Status | "clear";
export interface DayCell { status: string; source: string; setBy?: string }

const SLOTS = ["AM", "PM", "EV"] as const;
/** Monday first, as the centre's week runs; values are JavaScript weekdays (0 = Sunday). */
const WEEK = [{ wd: 1, label: "Mon" }, { wd: 2, label: "Tue" }, { wd: 3, label: "Wed" }, { wd: 4, label: "Thu" }, { wd: 5, label: "Fri" }, { wd: 6, label: "Sat" }, { wd: 0, label: "Sun" }];
const BRUSHES: { value: Brush; label: string; cls: string }[] = [
  { value: "unavailable", label: "✕ Busy", cls: "bg-port/15 text-port" },
  { value: "available", label: "✓ Free", cls: "bg-starboard/15 text-starboard" },
  { value: "tentative", label: "~ Maybe", cls: "bg-amber/15 text-amber" },
  { value: "clear", label: "Clear", cls: "bg-slate-100 text-slate-600" },
];
const CELL: Record<string, string> = {
  available: "bg-starboard/20 text-starboard",
  tentative: "bg-amber/20 text-amber",
  unavailable: "bg-port/20 text-port",
  assumed: "bg-starboard/[0.06] text-starboard/50",
  default: "bg-slate-100 text-slate-400",
  unasked: "bg-white text-slate-300 ring-1 ring-inset ring-slate-100",
  none: "bg-white text-slate-300 ring-1 ring-inset ring-slate-200",
};
const MARK: Record<string, string> = { available: "✓", tentative: "~", unavailable: "✕", assumed: "✓", default: "·", unasked: "?", none: "" };

/**
 * The office's view of one person's availability, on their staff page: who
 * keeps it (the person in the app, or the office with no sign-up needed), their
 * usual week, and the next four weeks, painted with a brush like the grid.
 */
export function StaffAvailabilityCard({
  instructorId, name, managedBy, centreMode, officeManaged, hasLogin, pattern, days, cells, canEditStaff,
}: {
  instructorId: string;
  name: string;
  managedBy: "staff" | "office" | null;
  centreMode: "staff" | "office";
  officeManaged: boolean;
  hasLogin: boolean;
  /** Usual week: `${weekday}|${slot}` → status. */
  pattern: Record<string, Status>;
  /** 28 ISO dates from this week's Monday. */
  days: string[];
  /** `${date}|${slot}` → effective status and where it came from. */
  cells: Record<string, DayCell>;
  canEditStaff: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [brush, setBrush] = useState<Brush>("unavailable");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [paintedDays, setPaintedDays] = useState<Record<string, Brush>>({});
  const [paintedWeek, setPaintedWeek] = useState<Record<string, Brush>>({});
  useEffect(() => { setPaintedDays({}); setPaintedWeek({}); }, [cells, pattern]);

  const status = brush === "clear" ? null : brush;
  const save = (input: Record<string, unknown>) => {
    setMsg(null);
    start(async () => {
      const r = await setAvailabilityBulkAction(input);
      setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Saved" : r.error ?? "That didn't save" });
      if (r.ok) router.refresh(); else { setPaintedDays({}); setPaintedWeek({}); }
    });
  };
  const paintDay = (date: string, slot: string) => {
    setPaintedDays((p) => ({ ...p, [`${date}|${slot}`]: brush }));
    save({ cells: [{ instructorId, date, slot }], status });
  };
  const paintWholeDay = (date: string) => {
    setPaintedDays((p) => ({ ...p, ...Object.fromEntries(SLOTS.map((s) => [`${date}|${s}`, brush])) }));
    save({ instructorIds: [instructorId], dates: [date], slots: [...SLOTS], status });
  };
  const paintUsual = (wd: number, slot: string) => {
    setPaintedWeek((p) => ({ ...p, [`${wd}|${slot}`]: brush }));
    save({ instructorIds: [instructorId], weekdays: [wd], slots: [slot], status });
  };
  const setWho = (value: "staff" | "office" | null) => {
    setMsg(null);
    start(async () => {
      const r = await setManagedByAction({ instructorId, managedBy: value });
      setMsg({ ok: r.ok, text: r.ok ? "Saved" : r.error ?? "That didn't save" });
      if (r.ok) router.refresh();
    });
  };

  const usualOf = (wd: number, slot: string): string => {
    const p = paintedWeek[`${wd}|${slot}`];
    if (p) return p === "clear" ? "none" : p;
    return pattern[`${wd}|${slot}`] ?? "none";
  };
  const dayOf = (date: string, slot: string): string => {
    const p = paintedDays[`${date}|${slot}`];
    if (p) return p === "clear" ? (officeManaged ? "assumed" : "default") : p;
    const c = cells[`${date}|${slot}`];
    if (!c) return "none";
    if (c.source === "assumed" || c.source === "default" || c.source === "unasked") return c.source;
    return c.status;
  };
  const weeks = [0, 1, 2, 3].map((w) => days.slice(w * 7, w * 7 + 7));
  const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <div>
      <fieldset className="rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-xs font-medium text-slate-500">Who sets {name}&rsquo;s availability?</legend>
        {([
          ["staff", `${name} sets it in the app`],
          ["office", `The office sets it, so ${name} doesn't need to sign up`],
        ] as const).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 py-0.5 text-sm text-navy">
            {/* Choosing the centre's default stores nothing, so a later change to the default applies. */}
            <input type="radio" name={`managed-${instructorId}`} checked={(managedBy ?? centreMode) === value} disabled={!canEditStaff || pending} onChange={() => setWho(value === centreMode ? null : value)} />
            <span>{label}{value === centreMode ? <span className="ml-1 text-xs text-slate-400">(your centre&rsquo;s default)</span> : null}</span>
          </label>
        ))}
        <p className="mt-1.5 text-xs text-slate-500">
          {officeManaged
            ? `${name} counts as free unless you mark the days they can't work below, and isn't asked to confirm sessions.`
            : hasLogin
              ? `${name} marks when they're free in the app. Until they do, a slot counts as busy.`
              : `${name} hasn't signed up yet, so counts as busy until they do. Invite them, or switch to "The office sets it".`}
        </p>
      </fieldset>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-slate-500">Brush:</span>
        {BRUSHES.map((b) => (
          <button key={b.value} type="button" aria-pressed={brush === b.value} onClick={() => setBrush(b.value)} className={`rounded-full px-2.5 py-1 font-semibold ${b.cls} ${brush === b.value ? "ring-2 ring-navy" : "opacity-75 hover:opacity-100"}`}>{b.label}</button>
        ))}
      </div>

      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Usual week</p>
      <p className="text-[11px] text-slate-400">Fills in any day without its own answer. For example, Busy every Monday.</p>
      <table className="mt-1 border-separate border-spacing-0.5 text-center text-[11px]">
        <thead><tr><th />{WEEK.map((d) => <th key={d.wd} className="px-1 font-semibold text-slate-500">{d.label}</th>)}</tr></thead>
        <tbody>
          {SLOTS.map((slot) => (
            <tr key={slot}>
              <th className="pr-1 text-right font-semibold text-slate-400">{slot}</th>
              {WEEK.map((d) => {
                const v = usualOf(d.wd, slot);
                return (
                  <td key={d.wd} className="p-0">
                    <button type="button" disabled={pending} onClick={() => paintUsual(d.wd, slot)} aria-label={`Usual ${d.label} ${slot}: ${v === "none" ? "no usual answer" : v}`} className={`h-7 w-9 rounded font-semibold disabled:opacity-60 ${CELL[v] ?? CELL.none}`}>{MARK[v]}</button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Next four weeks</p>
      <p className="text-[11px] text-slate-400">Click a slot to paint it, or a date to paint the whole day. Approved leave stays busy.</p>
      <div className="mt-1 space-y-1.5 overflow-x-auto">
        {weeks.map((week) => (
          <div key={week[0]} className="flex gap-1">
            {week.map((date) => (
              <div key={date} className="w-11 flex-none text-center">
                <button type="button" disabled={pending} onClick={() => paintWholeDay(date)} className="w-full rounded text-[10px] font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-60" title={`Paint all of ${fmt(date)}`}>{fmt(date)}</button>
                <div className="mt-0.5 grid grid-cols-3 gap-px">
                  {SLOTS.map((slot) => {
                    const v = dayOf(date, slot);
                    const leave = cells[`${date}|${slot}`]?.setBy === "leave";
                    return (
                      <button key={slot} type="button" disabled={pending} onClick={() => paintDay(date, slot)} title={`${fmt(date)} ${slot}: ${leave ? "approved leave" : v}`} aria-label={`${fmt(date)} ${slot}: ${leave ? "approved leave" : v}`} className={`h-6 rounded-sm text-[10px] font-bold disabled:opacity-60 ${CELL[v] ?? CELL.none} ${leave ? "outline outline-1 outline-port/50" : ""}`}>{MARK[v]}</button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      {msg ? <p className={`mt-2 text-xs ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</p> : null}
      <a href="/learn?topic=office-managed" target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-medium text-teal hover:underline">📖 Read the guide</a>
    </div>
  );
}
