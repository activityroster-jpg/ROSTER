"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { addSessionAction, cancelSessionAction, removeSessionAction, restoreSessionAction } from "@/app/(app)/office/courses/actions";
import { CancelPanel, type CancelChoice } from "./CancelPanel";

export interface SessionRow { id: string; date: string; slot: string; start: string; end: string; cancelled?: boolean; cancelReason?: string | null }

const SLOT_LABEL: Record<string, string> = { AM: "Morning", PM: "Afternoon", EV: "Evening" };

export function SessionManager({ courseId, slotStyle, sessions, staffCount }: { courseId: string; slotStyle: "slots" | "times"; sessions: SessionRow[]; staffCount: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
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
  const remove = (id: string) => start(async () => { const r = await removeSessionAction(courseId, id); setMsg(r.ok ? null : r.error ?? "Failed"); router.refresh(); });
  const cancel = (id: string, c: CancelChoice) => start(async () => {
    const r = await cancelSessionAction(courseId, id, c);
    setMsg(r.ok ? r.message ?? "Cancelled" : r.error ?? "Failed");
    if (r.ok) setCancelling(null);
    router.refresh();
  });
  const restore = (id: string) => start(async () => { const r = await restoreSessionAction(courseId, id); setMsg(r.ok ? r.message ?? "Restored" : r.error ?? "Failed"); router.refresh(); });

  const field = "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal";
  return (
    <div>
      {sessions.length === 0 ? (
        <p className="mb-3 text-sm text-slate-400">No sessions yet — add the first below.</p>
      ) : (
        <ul className="mb-4 divide-y divide-slate-100">
          {sessions.map((s) => (
            <li key={s.id} className="py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={s.cancelled ? "text-slate-400 line-through" : "text-navy"}>
                  {s.date} · <span className="text-slate-500">{SLOT_LABEL[s.slot] ?? s.slot} {s.start}–{s.end}</span>
                </span>
                {s.cancelled ? (
                  <span className="flex items-center gap-2">
                    <span className="rounded bg-port/10 px-1.5 py-0.5 text-[10px] font-semibold text-port">Cancelled{s.cancelReason ? `: ${s.cancelReason}` : ""}</span>
                    <button onClick={() => restore(s.id)} disabled={pending} className="text-xs font-medium text-teal hover:underline disabled:opacity-50">Restore</button>
                  </span>
                ) : (
                  <span className="flex items-center gap-3">
                    <button onClick={() => setCancelling(cancelling === s.id ? null : s.id)} disabled={pending} className="text-xs font-medium text-port hover:underline disabled:opacity-50">Cancel day</button>
                    {staffCount === 0 ? <button onClick={() => remove(s.id)} disabled={pending} className="text-xs text-slate-400 hover:text-port disabled:opacity-50">Remove</button> : null}
                  </span>
                )}
              </div>
              {cancelling === s.id ? <CancelPanel what={`this day (${s.date})`} people={staffCount} pending={pending} onConfirm={(c) => cancel(s.id, c)} onClose={() => setCancelling(null)} /> : null}
            </li>
          ))}
        </ul>
      )}
      {msg ? <p className="mb-2 text-sm text-slate-600">{msg}</p> : null}

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
      </form>
    </div>
  );
}
