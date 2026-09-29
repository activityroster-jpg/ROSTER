"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCourseFlexibleAction, type FlexSession } from "@/app/(app)/office/courses/actions";

interface EventUi { id: string; date: string; slot: string; startAt: number; endAt: number; courseName: string; audience: string }
interface CourseTypeUi { id: string; name: string; audience: "youth" | "adult" | "all" }
interface Row { key: string; date: string; startTime: string; endTime: string; slot: string }

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SLOT_LABEL: Record<string, string> = { AM: "Morning", PM: "Afternoon", EV: "Evening" };

function mondayOf(d: Date): string {
  const c = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  c.setUTCDate(c.getUTCDate() - ((c.getUTCDay() + 6) % 7));
  return c.toISOString().slice(0, 10);
}
function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
let seq = 0;

export function CoursePlanner({ courseTypes, events, slotStyle }: { courseTypes: CourseTypeUi[]; events: EventUi[]; slotStyle: "slots" | "times" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const thisMonday = mondayOf(new Date());
  const [monday, setMonday] = useState(thisMonday);
  const [courseTypeId, setCourseTypeId] = useState("");
  const [name, setName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i)), [monday]);
  const eventsByDay = useMemo(() => {
    const m = new Map<string, EventUi[]>();
    for (const e of events) { const a = m.get(e.date) ?? []; a.push(e); m.set(e.date, a); }
    return m;
  }, [events]);
  const draftByDay = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of rows) { const a = m.get(r.date) ?? []; a.push(r); m.set(r.date, a); }
    return m;
  }, [rows]);

  const addRow = (date: string) => setRows((r) => [...r, { key: `r${seq++}`, date, startTime: slotStyle === "times" ? "09:00" : "", endTime: slotStyle === "times" ? "12:00" : "", slot: "AM" }]);
  const updateRow = (key: string, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const removeRow = (key: string) => setRows((r) => r.filter((x) => x.key !== key));

  const create = () => {
    setMsg(null);
    if (!courseTypeId) { setMsg({ ok: false, text: "Pick a course type first." }); return; }
    if (rows.length === 0) { setMsg({ ok: false, text: "Add at least one session (click a day in the calendar or ‘Add session’)." }); return; }
    const sessions: FlexSession[] = rows.map((r) => ({ date: r.date, startTime: r.startTime || undefined, endTime: r.endTime || undefined, slot: r.slot }));
    start(async () => {
      const res = await createCourseFlexibleAction({ courseTypeId, name, sessions });
      if (res.ok) { setRows([]); setName(""); setMsg({ ok: true, text: res.message ?? "Created" }); router.refresh(); }
      else setMsg({ ok: false, text: res.error ?? "Could not create" });
    });
  };

  const audTint = (a: string) => a === "youth" ? "bg-amber/15 text-amber" : a === "adult" ? "bg-teal/15 text-teal" : "bg-slate-100 text-slate-600";

  return (
    <div className="mb-6 space-y-4">
      {/* Calendar */}
      <div className="rounded-card border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button onClick={() => setMonday((m) => addDaysIso(m, -7))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50">←</button>
          <span className="rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white">{fmtDay(monday)} – {fmtDay(addDaysIso(monday, 6))}{monday === thisMonday ? " · this week" : ""}</span>
          <button onClick={() => setMonday((m) => addDaysIso(m, 7))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50">→</button>
          {monday !== thisMonday ? <button onClick={() => setMonday(thisMonday)} className="text-sm font-medium text-teal hover:underline">This week</button> : null}
          <span className="ml-auto text-xs text-slate-400">Click a day to add a session to the course you&apos;re building.</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {days.map((d, i) => {
            const evs = (eventsByDay.get(d) ?? []).sort((a, b) => a.startAt - b.startAt);
            const drafts = draftByDay.get(d) ?? [];
            return (
              <div key={d} className="min-h-[7rem] rounded-lg border border-slate-100 bg-slate-50/50 p-1.5">
                <button onClick={() => addRow(d)} className="mb-1 flex w-full items-center justify-between rounded px-1 text-left text-[11px] font-semibold text-slate-500 hover:text-teal" title="Add a session on this day">
                  <span>{DAY_LABELS[i]} {d.slice(8)}</span><span className="text-teal">＋</span>
                </button>
                {evs.map((e) => (
                  <div key={e.id} className={`mb-1 rounded px-1.5 py-1 text-[11px] ${audTint(e.audience)}`}>
                    <span className="block font-medium leading-tight">{e.courseName}</span>
                    <span className="opacity-80">{fmtTime(e.startAt)}</span>
                  </div>
                ))}
                {drafts.map((r) => (
                  <div key={r.key} className="mb-1 rounded border border-dashed border-teal bg-teal/5 px-1.5 py-1 text-[11px] text-teal">
                    new · {slotStyle === "times" ? (r.startTime || "—") : SLOT_LABEL[r.slot]}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Builder */}
      <div className="rounded-card border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-navy">Build a course</h2>
        <p className="mb-3 text-xs text-slate-500">Give it a name, pick the type, then add each session — any days and times you like (e.g. two on Saturday, one Monday evening, one Wednesday).</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Course type</label>
            <select value={courseTypeId} onChange={(e) => setCourseTypeId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal">
              <option value="">Select…</option>
              {courseTypes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Course name <span className="text-slate-400">(optional — a unique label)</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aug Half-Term Kids Camp" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sessions ({rows.length})</p>
            <button onClick={() => addRow(monday)} className="text-xs font-semibold text-teal hover:underline">＋ Add session</button>
          </div>
          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-400">No sessions yet — click a day above or “Add session”.</p>
          ) : (
            <ul className="space-y-2">
              {rows.sort((a, b) => a.date.localeCompare(b.date)).map((r) => (
                <li key={r.key} className="flex flex-wrap items-end gap-2 rounded-lg bg-canvas p-2">
                  <div>
                    <label className="mb-0.5 block text-[11px] text-slate-500">Date</label>
                    <input type="date" value={r.date} onChange={(e) => updateRow(r.key, { date: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
                  </div>
                  {slotStyle === "times" ? (
                    <>
                      <div><label className="mb-0.5 block text-[11px] text-slate-500">Start</label><input type="time" value={r.startTime} onChange={(e) => updateRow(r.key, { startTime: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" /></div>
                      <div><label className="mb-0.5 block text-[11px] text-slate-500">End</label><input type="time" value={r.endTime} onChange={(e) => updateRow(r.key, { endTime: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" /></div>
                    </>
                  ) : (
                    <div>
                      <label className="mb-0.5 block text-[11px] text-slate-500">Slot</label>
                      <select value={r.slot} onChange={(e) => updateRow(r.key, { slot: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm">
                        <option value="AM">Morning</option><option value="PM">Afternoon</option><option value="EV">Evening</option>
                      </select>
                    </div>
                  )}
                  <button onClick={() => removeRow(r.key)} className="ml-auto text-xs text-slate-400 hover:text-port">Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button onClick={create} disabled={pending} className="rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
            {pending ? "Creating…" : `Create course${rows.length ? ` (${rows.length} session${rows.length === 1 ? "" : "s"})` : ""}`}
          </button>
          {msg ? <span className={`text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</span> : null}
        </div>
      </div>
    </div>
  );
}
