"use client";

import { useMemo, useState } from "react";
import { CourseEditorModal } from "@/components/office/CourseEditorModal";

interface EventUi { id: string; courseId: string; date: string; slot: string; startAt: number; endAt: number; courseName: string; audience: string }

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function mondayOf(d: Date): string {
  const c = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  c.setUTCDate(c.getUTCDate() - ((c.getUTCDay() + 6) % 7));
  return c.toISOString().slice(0, 10);
}
const addDaysIso = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const tint = (a: string) => a === "youth" ? "border-l-amber bg-amber/10 text-amber" : a === "adult" ? "border-l-teal bg-teal/10 text-teal" : "border-l-slate-400 bg-slate-100 text-slate-600";

/** A big, read-only week calendar with client-side week navigation. */
export function WeekCalendarView({ events, addHref }: { events: EventUi[]; addHref?: string }) {
  const thisMonday = mondayOf(new Date());
  const [monday, setMonday] = useState(thisMonday);
  const [editing, setEditing] = useState<string | null>(null);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i)), [monday]);
  const byDay = useMemo(() => {
    const m = new Map<string, EventUi[]>();
    for (const e of events) { const a = m.get(e.date) ?? []; a.push(e); m.set(e.date, a); }
    for (const a of m.values()) a.sort((x, y) => x.startAt - y.startAt);
    return m;
  }, [events]);
  const isToday = (iso: string) => iso === new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-card border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setMonday((m) => addDaysIso(m, -7))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal" aria-label="Previous week">←</button>
        <span className="rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white" aria-live="polite">{fmtDay(monday)} – {fmtDay(addDaysIso(monday, 6))}{monday === thisMonday ? " · this week" : ""}</span>
        <button type="button" onClick={() => setMonday((m) => addDaysIso(m, 7))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal" aria-label="Next week">→</button>
        {monday !== thisMonday ? <button type="button" onClick={() => setMonday(thisMonday)} className="text-sm font-medium text-teal hover:underline">This week</button> : null}
        {addHref ? <a href={addHref} className="ml-auto rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700"><span aria-hidden="true">＋</span> New course</a> : null}
      </div>
      <div className="overflow-x-auto pb-1">
      <div className="grid min-w-[56rem] grid-cols-7 gap-2">
        {days.map((d, i) => {
          const evs = byDay.get(d) ?? [];
          return (
            <div key={d} className={`min-h-[8rem] rounded-lg border p-1.5 ${isToday(d) ? "border-teal bg-teal/5" : "border-slate-100 bg-slate-50/40"}`}>
              <div className="mb-1.5 text-center">
                <div className="text-[11px] font-semibold uppercase text-slate-400">{DAY_LABELS[i]}</div>
                <div className={`text-sm font-bold ${isToday(d) ? "text-teal" : "text-navy"}`}>{d.slice(8)}</div>
              </div>
              {evs.length === 0 ? <p className="text-center text-[10px] text-slate-300">—</p> : evs.map((e) => (
                <button key={e.id} type="button" onClick={() => setEditing(e.courseId)} aria-label={`Edit ${e.courseName}, ${e.audience} course at ${fmtTime(e.startAt)} on ${fmtDay(e.date)}`} className={`mb-1 block w-full rounded border-l-4 px-1.5 py-1 text-left text-[11px] leading-tight hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal ${tint(e.audience)}`}>
                  <span className="block font-semibold">{fmtTime(e.startAt)}</span>
                  <span className="block truncate">{e.courseName}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      </div>
      {editing ? <CourseEditorModal courseId={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
