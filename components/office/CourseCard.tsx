"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  renameCourseAction,
  setStaffRequiredAction,
  updateSessionTimesAction,
  removeStaffAction,
  assignStaffAction,
} from "@/app/(app)/office/courses/actions";

export interface CardSession { id: string; date: string; startMs: number; endMs: number }
export interface CardAssigned { id: string; instructorName: string; roleName: string; isOverride: boolean }
export interface CardInstructor { id: string; name: string; fit: boolean; reason?: string; avail?: string }
export interface CardRole { id: string; name: string }
export interface CardRatio { ok: boolean; understaffed: boolean; missingSafetyCover: boolean }

const AUD: Record<string, { label: string; cls: string }> = {
  youth: { label: "Youth", cls: "bg-amber/15 text-amber" },
  adult: { label: "Adult", cls: "bg-teal/15 text-teal" },
  all: { label: "All", cls: "bg-slate-100 text-slate-500" },
};

const hhmm = (ms: number) => new Date(ms).toISOString().slice(11, 16);
const fmtDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

export function CourseCard({
  course, audience, sessions, assigned, instructors, roles, ratioOn, ratio,
}: {
  course: { id: string; name: string; courseTypeName: string; status: string; staffRequired: number | null };
  audience: string;
  sessions: CardSession[];
  assigned: CardAssigned[];
  instructors: CardInstructor[];
  roles: CardRole[];
  ratioOn: boolean;
  ratio?: CardRatio;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(course.name);
  const [editingWhen, setEditingWhen] = useState(false);

  const single = sessions.length === 1 ? sessions[0]! : null;
  const [d, setD] = useState(single?.date ?? "");
  const [s, setS] = useState(single ? hhmm(single.startMs) : "");
  const [e, setE] = useState(single ? hhmm(single.endMs) : "");

  const [instr, setInstr] = useState("");
  const [role, setRole] = useState("");
  const [override, setOverride] = useState(false);

  const aud = AUD[audience] ?? AUD.all!;
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setErr(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setErr(res.error ?? "Something went wrong");
      else router.refresh();
    });
  };

  const saveName = () => {
    setEditingName(false);
    if (name.trim() && name.trim() !== course.name) run(() => renameCourseAction(course.id, name.trim()));
  };
  const saveWhen = () => {
    if (!single) { setEditingWhen(false); return; }
    setEditingWhen(false);
    run(() => updateSessionTimesAction(course.id, single.id, { date: d, startTime: s, endTime: e }));
  };
  const assign = () => {
    if (!instr || !role) { setErr("Pick an instructor and a role"); return; }
    const fd = new FormData();
    fd.set("courseId", course.id); fd.set("instructorId", instr); fd.set("roleTypeId", role);
    if (override) fd.set("override", "on");
    run(async () => {
      const res = await assignStaffAction({ ok: false }, fd);
      if (res.ok) { setInstr(""); setRole(""); setOverride(false); }
      return res;
    });
  };

  const inputCls = "rounded border border-slate-300 px-1.5 py-1 text-sm outline-none focus:border-teal";

  return (
    <div className="rounded-card border border-slate-200 bg-white px-3 py-2.5">
      {/* Top row — name · date/time · staff required · status, all editable */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${aud.cls}`}>{aud.label}</span>

        {editingName ? (
          <input autoFocus value={name} onChange={(ev) => setName(ev.target.value)} onBlur={saveName}
            onKeyDown={(ev) => { if (ev.key === "Enter") saveName(); if (ev.key === "Escape") { setName(course.name); setEditingName(false); } }}
            className={`${inputCls} font-semibold text-navy`} />
        ) : (
          <button type="button" onClick={() => setEditingName(true)} title="Click to rename"
            className="font-semibold text-navy hover:underline decoration-dotted underline-offset-2">{course.name || course.courseTypeName}</button>
        )}

        {editingWhen && single ? (
          <span className="flex items-center gap-1">
            <input type="date" value={d} onChange={(ev) => setD(ev.target.value)} className={inputCls} />
            <input type="time" value={s} onChange={(ev) => setS(ev.target.value)} className={inputCls} />
            <span className="text-slate-400">–</span>
            <input type="time" value={e} onChange={(ev) => setE(ev.target.value)} className={inputCls} />
            <button type="button" onClick={saveWhen} disabled={pending} className="rounded bg-teal px-2 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">Save</button>
            <button type="button" onClick={() => setEditingWhen(false)} className="text-xs text-slate-400 hover:underline">✕</button>
          </span>
        ) : single ? (
          <button type="button" onClick={() => setEditingWhen(true)} title="Click to change date & time"
            className="text-sm text-slate-600 hover:text-navy hover:underline decoration-dotted underline-offset-2">
            📅 {fmtDate(single.date)}, {fmtTime(single.startMs)}–{fmtTime(single.endMs)}
          </button>
        ) : sessions.length === 0 ? (
          <a href={`/office/courses/${course.id}`} className="text-sm text-slate-400 hover:underline">No sessions — add →</a>
        ) : (
          <a href={`/office/courses/${course.id}`} className="text-sm text-slate-600 hover:underline">📅 {sessions.length} sessions · manage →</a>
        )}

        <label className="flex items-center gap-1 text-xs text-slate-500" title="How many staff this course needs">
          👥
          <select value={course.staffRequired ?? ""} onChange={(ev) => run(() => setStaffRequiredAction(course.id, ev.target.value === "" ? null : Number(ev.target.value)))}
            className="rounded border border-slate-300 py-1 pl-1 pr-5 text-xs outline-none focus:border-teal">
            <option value="">auto</option>
            {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n} staff</option>)}
          </select>
        </label>

        <span className="ml-auto flex items-center gap-2">
          {ratioOn && ratio ? (
            ratio.missingSafetyCover ? <span className="rounded-full bg-port/15 px-2 py-0.5 text-[10px] font-semibold text-port">No safety cover</span>
              : ratio.understaffed ? <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-semibold text-amber">Under-staffed</span>
              : <span className="rounded-full bg-starboard/15 px-2 py-0.5 text-[10px] font-semibold text-starboard">Covered</span>
          ) : null}
          <span className="text-[11px] capitalize text-slate-400">{course.status}</span>
          <a href={`/office/courses/${course.id}`} className="text-xs font-medium text-teal hover:underline">manage →</a>
        </span>
      </div>

      {/* Assigned staff — compact inline pills */}
      {assigned.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {assigned.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
              {a.instructorName} · {a.roleName}{a.isOverride ? <span className="text-amber">(o)</span> : null}
              <button type="button" onClick={() => run(() => removeStaffAction(course.id, a.id))} title="Remove" className="ml-0.5 text-slate-400 hover:text-port">✕</button>
            </span>
          ))}
        </div>
      ) : null}

      {/* Assign row — instructor · role · assign (no override reason field) */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select aria-label="Instructor" value={instr} onChange={(ev) => setInstr(ev.target.value)} className={`${inputCls} min-w-[10rem] flex-1`}>
          <option value="">Instructor…</option>
          {instructors.map((i) => (
            <option key={i.id} value={i.id}>{i.name}{i.fit ? "" : ` — ${i.reason || "not cleared"}`}</option>
          ))}
        </select>
        <select aria-label="Role" value={role} onChange={(ev) => setRole(ev.target.value)} className={`${inputCls} min-w-[8rem]`}>
          <option value="">Role…</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-slate-500" title="Assign even if a check isn't met">
          <input type="checkbox" checked={override} onChange={(ev) => setOverride(ev.target.checked)} /> override
        </label>
        <button type="button" onClick={assign} disabled={pending} className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
          {pending ? "…" : "Assign"}
        </button>
        {err ? <span role="alert" className="text-xs text-port">{err}</span> : null}
      </div>
    </div>
  );
}
