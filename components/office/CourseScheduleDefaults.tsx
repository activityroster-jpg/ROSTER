"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCourseTypeScheduleAction } from "@/app/(app)/office/course-setup/actions";
import { describeDefaultSchedule, MAX_DEFAULT_SESSIONS, type DefaultSession } from "@/lib/domain/schedule-defaults";

interface TypeItem { id: string; name: string; schedule: DefaultSession[] }

function Editor({ item, onDone }: { item: TypeItem; onDone: (m: { ok: boolean; text: string }) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<DefaultSession[]>(item.schedule.length ? item.schedule : [{ day: 1, start: "09:00", end: "12:00" }]);
  const set = (i: number, patch: Partial<DefaultSession>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const add = () => setRows((r) => {
    const last = r[r.length - 1];
    return [...r, last ? { ...last, day: last.day + 1 } : { day: 1, start: "09:00", end: "12:00" }];
  });
  const save = (sessions: DefaultSession[]) => start(async () => {
    const res = await setCourseTypeScheduleAction(item.id, sessions);
    onDone({ ok: res.ok, text: res.ok ? res.message ?? "Saved" : res.error ?? "Could not save" });
    if (res.ok) router.refresh();
  });
  const inp = "rounded border border-slate-300 px-1.5 py-1 text-sm";
  return (
    <div className="mt-2 space-y-1.5 rounded-lg bg-canvas p-2">
      {rows.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Session {i + 1}</span>
          <label className="flex items-center gap-1">Day <input type="number" min={1} max={60} value={r.day} onChange={(e) => set(i, { day: Number(e.target.value) || 1 })} className={`${inp} w-14`} /></label>
          <input type="time" value={r.start} onChange={(e) => set(i, { start: e.target.value })} aria-label="Start" className={inp} />
          <span>–</span>
          <input type="time" value={r.end} onChange={(e) => set(i, { end: e.target.value })} aria-label="End" className={inp} />
          {rows.length > 1 ? <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="text-slate-400 hover:text-port" aria-label={`Remove session ${i + 1}`}>✕</button> : null}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {rows.length < MAX_DEFAULT_SESSIONS ? <button type="button" onClick={add} className="text-xs font-semibold text-teal hover:underline">＋ Add session</button> : null}
        <button type="button" disabled={pending} onClick={() => save(rows)} className="rounded bg-teal px-3 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "…" : "Save"}</button>
        {item.schedule.length ? <button type="button" disabled={pending} onClick={() => save([])} className="text-xs text-slate-400 hover:text-port">Clear default</button> : null}
      </div>
    </div>
  );
}

/**
 * Per course type: how many sessions it has and when each runs. "Add a course"
 * can then fill the sessions in one click from a start date.
 */
export function CourseScheduleDefaults({ items }: { items: TypeItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (items.length === 0) return <p className="text-sm text-slate-400">No course types yet — add them in Course setup.</p>;
  return (
    <div>
      <ul className="divide-y divide-slate-100">
        {items.map((it) => (
          <li key={it.id} className="py-2">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-medium text-navy">{it.name}</span>
              <span className={`text-xs ${it.schedule.length ? "text-slate-500" : "text-slate-400"}`}>{describeDefaultSchedule(it.schedule)}</span>
              <button type="button" onClick={() => setOpen(open === it.id ? null : it.id)} className="ml-auto text-xs font-medium text-teal hover:underline">{open === it.id ? "Close" : it.schedule.length ? "Edit" : "Set"}</button>
            </div>
            {open === it.id ? <Editor item={it} onDone={(m) => { setMsg(m); if (m.ok) setOpen(null); }} /> : null}
          </li>
        ))}
      </ul>
      {msg ? <p role="status" className={`mt-2 text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</p> : null}
    </div>
  );
}
