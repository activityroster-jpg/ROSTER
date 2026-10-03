"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCourseFlexibleAction, type FlexSession } from "@/app/(app)/office/courses/actions";
import { CourseEditorModal } from "@/components/office/CourseEditorModal";
import { describeDefaultSchedule, expandDefaultSchedule, type DefaultSession } from "@/lib/domain/schedule-defaults";

interface EventUi { id: string; courseId: string; date: string; slot: string; startAt: number; endAt: number; courseName: string; audience: string }
interface CourseTypeUi { id: string; name: string; audience: "youth" | "adult" | "all"; schedule?: DefaultSession[] }
interface Row { key: string; date: string; startTime: string; endTime: string; slot: string; useTimes?: boolean }
interface Option { id: string; name: string }
interface RoleNeed { key: string; roleTypeId: string; count: number }

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
const OTHER = "__other";

export function CoursePlanner({ courseTypes, events, slotStyle, roles = [], locations = [], equipment = [] }: {
  courseTypes: CourseTypeUi[]; events: EventUi[]; slotStyle: "slots" | "times";
  roles?: Option[]; locations?: Option[]; equipment?: Option[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const thisMonday = mondayOf(new Date());
  const [monday, setMonday] = useState(thisMonday);
  const [courseTypeId, setCourseTypeId] = useState("");
  // "Other" — a manually-typed type, kept off the regular list unless ticked.
  const [otherType, setOtherType] = useState("");
  const [addToList, setAddToList] = useState(false);
  const isOther = courseTypeId === OTHER;
  const typeSchedule = courseTypes.find((c) => c.id === courseTypeId)?.schedule ?? [];
  const [scheduleStart, setScheduleStart] = useState(() => new Date().toISOString().slice(0, 10));
  // Replace the draft sessions with the type's default schedule from a start date.
  const fillFromDefault = () => setRows(expandDefaultSchedule(scheduleStart, typeSchedule).map((x) => ({
    key: `r${seq++}`, date: x.date, startTime: x.start, endTime: x.end, slot: x.start < "12:00" ? "AM" : x.start < "17:00" ? "PM" : "EV", useTimes: true,
  })));
  const [name, setName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [needs, setNeeds] = useState<RoleNeed[]>([]);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [equipmentIds, setEquipmentIds] = useState<string[]>([]);
  const [showMore, setShowMore] = useState(false);
  const toggle = (set: (f: (v: string[]) => string[]) => void, id: string) => set((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  const addNeed = () => setNeeds((n) => [...n, { key: `n${seq++}`, roleTypeId: roles.find((r) => !n.some((x) => x.roleTypeId === r.id))?.id ?? roles[0]?.id ?? "", count: 1 }]);
  const updateNeed = (key: string, patch: Partial<RoleNeed>) => setNeeds((n) => n.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const removeNeed = (key: string) => setNeeds((n) => n.filter((x) => x.key !== key));
  const staffTotal = needs.reduce((a, n) => a + (n.roleTypeId ? n.count : 0), 0);

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
  // "Add session" (no specific day): continue the run — day after the last
  // session, carrying its times/slot forward. Falls back to the current week.
  const addNextRow = () => setRows((r) => {
    const last = r[r.length - 1];
    const date = last ? addDaysIso(last.date, 1) : monday;
    const startTime = last ? last.startTime : slotStyle === "times" ? "09:00" : "";
    const endTime = last ? last.endTime : slotStyle === "times" ? "12:00" : "";
    const slot = last ? last.slot : "AM";
    return [...r, { key: `r${seq++}`, date, startTime, endTime, slot, useTimes: last?.useTimes }];
  });
  const updateRow = (key: string, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const removeRow = (key: string) => setRows((r) => r.filter((x) => x.key !== key));

  const create = () => {
    setMsg(null);
    if (!courseTypeId) { setMsg({ ok: false, text: "Pick a course type first." }); return; }
    if (isOther && !otherType.trim()) { setMsg({ ok: false, text: "Type the course type name." }); return; }
    if (rows.length === 0) { setMsg({ ok: false, text: "Add at least one session (click a day in the calendar or ‘Add session’)." }); return; }
    // Exact times apply in "set times" mode, or per row when ticked in slot mode.
    const timed = (r: Row) => slotStyle === "times" || r.useTimes;
    const sessions: FlexSession[] = rows.map((r) => ({ date: r.date, startTime: timed(r) ? r.startTime || undefined : undefined, endTime: timed(r) ? r.endTime || undefined : undefined, slot: r.slot }));
    const roleReqs = needs.filter((n) => n.roleTypeId).map((n) => ({ roleTypeId: n.roleTypeId, count: n.count }));
    start(async () => {
      const res = await createCourseFlexibleAction({
        courseTypeId: isOther ? "" : courseTypeId, name, sessions, roles: roleReqs, locationIds, equipmentIds,
        newType: isOther ? { name: otherType.trim(), addToList } : undefined,
      });
      if (res.ok) { setRows([]); setName(""); if (isOther) { setCourseTypeId(""); setOtherType(""); setAddToList(false); } setNeeds([]); setLocationIds([]); setEquipmentIds([]); setMsg({ ok: true, text: res.message ?? "Created" }); router.refresh(); }
      else setMsg({ ok: false, text: res.error ?? "Could not create" });
    });
  };

  const audTint = (a: string) => a === "youth" ? "bg-amber/15 text-amber" : a === "adult" ? "bg-teal/15 text-teal" : "bg-slate-100 text-slate-600";

  const isToday = (iso: string) => iso === new Date().toISOString().slice(0, 10);

  return (
    <div className="mb-6 space-y-4">
      {/* Calendar */}
      <div className="rounded-card border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-1 font-display text-lg font-semibold text-navy">Calendar</h2>
          <button type="button" onClick={() => setMonday((m) => addDaysIso(m, -7))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal" aria-label="Previous week">←</button>
          <span className="rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white" aria-live="polite">{fmtDay(monday)} – {fmtDay(addDaysIso(monday, 6))}{monday === thisMonday ? " · this week" : ""}</span>
          <button type="button" onClick={() => setMonday((m) => addDaysIso(m, 7))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal" aria-label="Next week">→</button>
          {monday !== thisMonday ? <button type="button" onClick={() => setMonday(thisMonday)} className="text-sm font-medium text-teal hover:underline">This week</button> : null}
          <span className="ml-auto text-xs text-slate-400">Tap any day to add a session to the course you&apos;re building below.</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {days.map((d, i) => {
            const evs = (eventsByDay.get(d) ?? []).sort((a, b) => a.startAt - b.startAt);
            const drafts = draftByDay.get(d) ?? [];
            return (
              <div key={d} className={`flex min-h-[11rem] flex-col rounded-lg border p-1.5 ${isToday(d) ? "border-teal bg-teal/5" : "border-slate-100 bg-slate-50/50"}`}>
                <div className="mb-1.5 text-center">
                  <div className="text-[11px] font-semibold uppercase text-slate-400">{DAY_LABELS[i]}</div>
                  <div className={`text-sm font-bold ${isToday(d) ? "text-teal" : "text-navy"}`}>{d.slice(8)}</div>
                </div>
                <div className="flex-1 space-y-1">
                  {evs.map((e) => (
                    <button key={e.id} type="button" onClick={() => setEditing(e.courseId)} aria-label={`Edit ${e.courseName}`} className={`block w-full rounded border-l-4 px-1.5 py-1 text-left text-[11px] leading-tight hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal ${e.audience === "youth" ? "border-l-amber " : e.audience === "adult" ? "border-l-teal " : "border-l-slate-400 "}${audTint(e.audience)}`}>
                      <span className="block font-semibold">{fmtTime(e.startAt)}</span>
                      <span className="block truncate">{e.courseName}</span>
                    </button>
                  ))}
                  {drafts.map((r) => (
                    <div key={r.key} className="rounded border border-dashed border-teal bg-teal/5 px-1.5 py-1 text-[11px] font-medium text-teal">
                      new · {slotStyle === "times" || r.useTimes ? (r.startTime || "—") : SLOT_LABEL[r.slot]}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => addRow(d)} className="mt-1 flex w-full items-center justify-center gap-1 rounded-md border border-teal/40 bg-teal/5 py-1 text-[11px] font-semibold text-teal hover:bg-teal hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal" aria-label={`Add a session on ${fmtDay(d)}`}>
                  <span aria-hidden="true">＋</span> Add
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Builder */}
      <div className="rounded-card border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-navy">Add a course</h2>
        <p className="mb-3 text-xs text-slate-500">Pick the type and add each session (any days, exact times if you need them). Staff, locations and equipment are optional under “More options”.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Course type</label>
            <select value={courseTypeId} onChange={(e) => setCourseTypeId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal">
              <option value="">Select…</option>
              {courseTypes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value={OTHER}>＋ Other (type it in)…</option>
            </select>
            {typeSchedule.length ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-teal/5 px-2 py-1.5 text-xs text-slate-600">
                <span>Default: {describeDefaultSchedule(typeSchedule)}</span>
                <input type="date" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)} aria-label="Default schedule start date" className="rounded border border-slate-300 px-1.5 py-0.5 text-xs" />
                <button type="button" onClick={fillFromDefault} className="font-semibold text-teal hover:underline">Fill sessions</button>
              </div>
            ) : null}
            {isOther ? (
              <div className="mt-2 space-y-1.5">
                <input value={otherType} onChange={(e) => setOtherType(e.target.value)} placeholder="e.g. Corporate team day" aria-label="Course type name" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={addToList} onChange={(e) => setAddToList(e.target.checked)} />
                  Add to my regular course list
                </label>
                {!addToList ? <p className="text-[11px] text-slate-400">Left unticked, it&apos;s a one-off and won&apos;t clutter your list. You can add it later in Course setup.</p> : null}
              </div>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Course name <span className="text-slate-400">(optional — a unique label)</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aug Half-Term Kids Camp" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sessions ({rows.length})</p>
            <button type="button" onClick={addNextRow} className="text-xs font-semibold text-teal hover:underline">＋ Add session</button>
          </div>
          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-400">No sessions yet — click a day above or “Add session”.</p>
          ) : (
            <ul className="space-y-2">
              {[...rows].sort((a, b) => a.date.localeCompare(b.date)).map((r) => (
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
                  ) : r.useTimes ? (
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
                  {slotStyle !== "times" ? (
                    <label className="flex items-center gap-1 pb-1 text-[11px] text-slate-500">
                      <input type="checkbox" checked={Boolean(r.useTimes)} onChange={(e) => updateRow(r.key, { useTimes: e.target.checked, startTime: r.startTime || "09:00", endTime: r.endTime || "12:00" })} />
                      Exact times
                    </label>
                  ) : null}
                  <button type="button" onClick={() => removeRow(r.key)} className="ml-auto text-xs text-slate-400 hover:text-port" aria-label={`Remove session on ${r.date}`}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button type="button" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore} className="mt-4 text-sm font-semibold text-teal hover:underline">
          {showMore ? "▾ Fewer options" : "▸ More options"}{!showMore && (needs.length || locationIds.length || equipmentIds.length) ? ` (${[needs.length ? `${staffTotal || needs.length} staff` : "", locationIds.length ? `${locationIds.length} location${locationIds.length === 1 ? "" : "s"}` : "", equipmentIds.length ? `${equipmentIds.length} equipment` : ""].filter(Boolean).join(", ")})` : " — staff needed, locations, equipment"}
        </button>
        <div className={`mt-3 grid gap-4 lg:grid-cols-3 ${showMore ? "" : "hidden"}`}>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Staff needed{staffTotal ? ` (${staffTotal})` : ""}</p>
              {roles.length ? <button type="button" onClick={addNeed} className="text-xs font-semibold text-teal hover:underline">＋ Add role</button> : null}
            </div>
            {needs.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-400">{roles.length ? "Optional — e.g. 2× Instructor, 1× Safety Boat." : "Add roles in Settings first."}</p>
            ) : (
              <ul className="space-y-1.5">
                {needs.map((n) => (
                  <li key={n.key} className="flex items-center gap-2">
                    <input type="number" min={1} max={50} value={n.count} onChange={(e) => updateNeed(n.key, { count: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })} aria-label="How many" className="w-14 rounded border border-slate-300 px-2 py-1 text-sm" />
                    <span className="text-xs text-slate-400">×</span>
                    <select value={n.roleTypeId} onChange={(e) => updateNeed(n.key, { roleTypeId: e.target.value })} aria-label="Role" className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm">
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <button type="button" onClick={() => removeNeed(n.key)} className="text-xs text-slate-400 hover:text-port" aria-label="Remove role">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <PickList title="Locations" empty="No locations yet — add them on the Locations tab." options={locations} selected={locationIds} onToggle={(id) => toggle(setLocationIds, id)} />
          <PickList title="Equipment" empty="No equipment yet — add it on the Equipment tab." options={equipment} selected={equipmentIds} onToggle={(id) => toggle(setEquipmentIds, id)} />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={create} disabled={pending} className="rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
            {pending ? "Creating…" : `Create course${rows.length ? ` (${rows.length} session${rows.length === 1 ? "" : "s"})` : ""}`}
          </button>
          {msg ? <span className={`text-sm ${msg.ok ? "text-starboard" : "text-port"}`} role="status">{msg.text}</span> : null}
        </div>
      </div>
      {editing ? <CourseEditorModal courseId={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function PickList({ title, empty, options, selected, onToggle }: { title: string; empty: string; options: Option[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}{selected.length ? ` (${selected.length})` : ""}</p>
      {options.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-400">{empty}</p>
      ) : (
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {options.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={selected.includes(o.id)} onChange={() => onToggle(o.id)} />
              <span className="truncate">{o.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
