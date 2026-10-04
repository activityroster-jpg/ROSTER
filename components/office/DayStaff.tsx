"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clearDayStaffAction, setDayStaffAction } from "@/app/(app)/office/courses/actions";

export interface DayStaffMember { instructorId: string; name: string; role: string; roleTypeId: string; status: string; source: "course" | "day" }
export interface DayStaffOption { id: string; name: string }

/**
 * Who is on one session, with the per-day changes (audit A3-3, option B):
 * "skip this day" beside anyone on the whole course, "undo" beside a change,
 * and "+ add for this day" for one-day cover.
 */
export function DayStaff({ sessionId, members, skipped, instructors, roles, disabled = false }: {
  sessionId: string;
  members: DayStaffMember[];
  /** Course-level people skipped on this day (so the undo is offered). */
  skipped: { instructorId: string; name: string }[];
  instructors: DayStaffOption[];
  roles: DayStaffOption[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [who, setWho] = useState("");
  const [role, setRole] = useState(roles[0]?.id ?? "");
  const [override, setOverride] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => start(async () => {
    const r = await fn();
    setMsg(r.ok ? r.message ?? null : r.error ?? "Failed");
    if (r.ok) { setAdding(false); setWho(""); setOverride(false); router.refresh(); }
  });
  const onSession = new Set(members.map((m) => m.instructorId));
  const candidates = instructors.filter((i) => !onSession.has(i.id));
  const chip = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]";

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {members.length === 0 ? <span className="text-[11px] text-slate-400">Nobody on this day</span> : null}
      {members.map((m) => (
        <span key={m.instructorId} className={`${chip} ${m.status === "declined" ? "bg-port/10 text-port line-through" : m.source === "day" ? "bg-teal/10 text-teal" : "bg-slate-100 text-slate-700"}`} title={m.source === "day" ? "On this day only" : "On the whole course"}>
          {m.name} <span className="opacity-60">· {m.role}</span>
          {m.source === "day" ? <span className="rounded bg-teal/20 px-1 text-[9px] font-semibold uppercase">day</span> : null}
          {!disabled ? (
            m.source === "day"
              ? <button type="button" disabled={pending} onClick={() => run(() => clearDayStaffAction(sessionId, m.instructorId))} className="ml-0.5 text-slate-400 hover:text-port" title="Take them off this day" aria-label={`Remove ${m.name} from this day`}>✕</button>
              : <button type="button" disabled={pending} onClick={() => run(() => setDayStaffAction({ sessionId, instructorId: m.instructorId, roleTypeId: m.roleTypeId, mode: "skip" }))} className="ml-0.5 text-slate-400 hover:text-port" title="Not needed this day (stays on the rest of the course)" aria-label={`Skip ${m.name} on this day`}>skip</button>
          ) : null}
        </span>
      ))}
      {skipped.map((s) => (
        <span key={s.instructorId} className={`${chip} bg-amber/10 text-amber`} title="On the course, but not this day">
          {s.name} <span className="opacity-70">· skipped</span>
          {!disabled ? <button type="button" disabled={pending} onClick={() => run(() => clearDayStaffAction(sessionId, s.instructorId))} className="ml-0.5 underline-offset-2 hover:underline" aria-label={`Put ${s.name} back on this day`}>undo</button> : null}
        </span>
      ))}
      {!disabled && candidates.length ? (
        adding ? (
          <span className="flex flex-wrap items-center gap-1">
            <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Who" className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] outline-none focus:border-teal">
              <option value="">Who…</option>
              {candidates.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role" className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] outline-none focus:border-teal">
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <label className="flex items-center gap-1 text-[11px] text-slate-500" title="Push through a Busy or a clash"><input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} /> override</label>
            <button type="button" disabled={pending || !who || !role} onClick={() => run(() => setDayStaffAction({ sessionId, instructorId: who, roleTypeId: role, mode: "add", override, note: override ? "Day cover override" : null }))} className="rounded bg-teal px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-teal-700 disabled:opacity-50">Add</button>
            <button type="button" onClick={() => setAdding(false)} className="text-[11px] text-slate-400 hover:text-navy">✕</button>
          </span>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="text-[11px] font-medium text-teal hover:underline">+ add for this day</button>
        )
      ) : null}
      {msg ? <span className="text-[11px] text-port">{msg}</span> : null}
    </div>
  );
}
