"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { addSessionAction, removeSessionAction } from "@/app/(app)/office/courses/actions";

export interface SessionRow { id: string; date: string; slot: string; start: string; end: string }

const SLOT_LABEL: Record<string, string> = { AM: "Morning", PM: "Afternoon", EV: "Evening" };

export function SessionManager({ courseId, slotStyle, sessions }: { courseId: string; slotStyle: "slots" | "times"; sessions: SessionRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(formRef.current!);
    start(async () => {
      const r = await addSessionAction(courseId, fd);
      if (r.ok) { formRef.current?.reset(); router.refresh(); } else setMsg(r.error ?? "Failed");
    });
  };
  const remove = (id: string) => start(async () => { await removeSessionAction(courseId, id); router.refresh(); });

  const field = "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal";
  return (
    <div>
      {sessions.length === 0 ? (
        <p className="mb-3 text-sm text-slate-400">No sessions yet — add the first below.</p>
      ) : (
        <ul className="mb-4 divide-y divide-slate-100">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-navy">{s.date} · <span className="text-slate-500">{SLOT_LABEL[s.slot] ?? s.slot} {s.start}–{s.end}</span></span>
              <button onClick={() => remove(s.id)} disabled={pending} className="text-xs text-slate-400 hover:text-port disabled:opacity-50">Remove</button>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} onSubmit={add} className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Date</label>
          <input name="date" type="date" required className={field} />
        </div>
        {slotStyle === "times" ? (
          <>
            <div><label className="mb-1 block text-xs font-medium text-slate-500">Start</label><input name="startTime" type="time" required className={field} /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-500">End</label><input name="endTime" type="time" className={field} /></div>
          </>
        ) : (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Slot</label>
            <select name="slot" className={field}><option value="AM">Morning</option><option value="PM">Afternoon</option><option value="EV">Evening</option></select>
          </div>
        )}
        <button disabled={pending} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Adding…" : "+ Add session"}</button>
        {msg ? <span className="w-full text-sm text-port">{msg}</span> : null}
      </form>
    </div>
  );
}
