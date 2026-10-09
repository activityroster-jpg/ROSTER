"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { BoardData, BoardInstructor, OpenRole } from "@/lib/services/board";
import type { RotaDay, RotaSession } from "@/lib/services/schedule";
import { boardAssignAction, boardRemoveAction, boardWorkingTimeAction } from "@/app/(app)/office/rota/board-actions";
import { setCourseStaffingAction } from "@/app/(app)/office/courses/actions";
import { ConfirmDialog } from "./ConfirmDialog";

type Layout = "courses" | "people";
const STORAGE = "ar.board.layout";
const SLOTS = ["AM", "PM", "EV"] as const;
const SLOT_LABEL: Record<string, string> = { AM: "Morning", PM: "Afternoon", EV: "Evening" };
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const AVAIL: Record<string, { dot: string; word: string }> = {
  available: { dot: "bg-starboard", word: "Free" },
  tentative: { dot: "bg-amber", word: "Maybe" },
  unavailable: { dot: "bg-port", word: "Busy" },
  unasked: { dot: "bg-slate-300", word: "Not asked yet" },
};

interface Selected { session: RotaSession; day: RotaDay }

/**
 * The roster board (audit Part E, decision 6): layout (a) course cards per day
 * with their open roles and a side list of instructors to drag onto them; a
 * switch to layout (b) instructor rows across the days. Click a session for the
 * side panel: who is on it, availability, clashes and the young-worker result,
 * add, remove or swap in place, on the whole course or this day only.
 */
export function RosterBoard({ data, canEdit }: { data: BoardData; canEdit: boolean }) {
  const router = useRouter();
  const [layout, setLayout] = useState<Layout>("courses");
  const [sel, setSel] = useState<Selected | null>(null);
  const [picked, setPicked] = useState<string | null>(null); // instructor chosen in the side list (click-to-assign fallback)
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{ session: RotaSession; day: RotaDay; instructorId: string } | null>(null);

  useEffect(() => {
    try { const v = window.localStorage.getItem(STORAGE); if (v === "people" || v === "courses") setLayout(v); } catch { /* ignore */ }
  }, []);
  const choose = (l: Layout) => { setLayout(l); try { window.localStorage.setItem(STORAGE, l); } catch { /* ignore */ } };

  const byId = useMemo(() => new Map(data.instructors.map((i) => [i.id, i])), [data.instructors]);
  const sessionById = useMemo(() => { const m = new Map<string, Selected>(); for (const d of data.days) for (const s of d.sessions) m.set(s.sessionId, { session: s, day: d }); return m; }, [data.days]);
  const totalOpen = Object.values(data.openRoles).reduce((n, rs) => n + rs.reduce((x, r) => x + r.missing, 0), 0);

  const onDropInstructor = (session: RotaSession, day: RotaDay, instructorId: string) => {
    setDropTarget(null);
    if (!canEdit) return;
    setPendingDrop({ session, day, instructorId });
    setSel({ session, day });
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-card border border-slate-200 bg-white px-3 py-2">
        <div className="flex items-center gap-1" role="tablist" aria-label="Board layout">
          <button type="button" role="tab" aria-selected={layout === "courses"} onClick={() => choose("courses")} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${layout === "courses" ? "bg-navy text-white" : "text-navy hover:bg-slate-100"}`}>Courses by day</button>
          <button type="button" role="tab" aria-selected={layout === "people"} onClick={() => choose("people")} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${layout === "people" ? "bg-navy text-white" : "text-navy hover:bg-slate-100"}`}>People × days</button>
        </div>
        <p className="text-xs text-slate-500">
          {totalOpen ? <span className="font-semibold text-amber">{totalOpen} role{totalOpen === 1 ? "" : "s"} still open</span> : <span className="font-semibold text-starboard">Every role filled</span>}
          {data.problemCounts.total ? <> · <span className="font-semibold text-port">{data.problemCounts.total} problem{data.problemCounts.total === 1 ? "" : "s"}</span></> : null}
          {canEdit ? <span className="ml-2 text-slate-400">Drag a person onto a session, or click a person then a session.</span> : null}
        </p>
      </div>

      <div className={`grid gap-4 ${layout === "courses" && canEdit ? "lg:grid-cols-[minmax(0,1fr)_13rem]" : ""} ${sel ? "lg:mr-[28rem]" : ""}`}>
        {layout === "courses" ? (
          <CoursesByDay data={data} canEdit={canEdit} picked={picked} dropTarget={dropTarget} setDropTarget={setDropTarget} onDrop={onDropInstructor} onOpen={(s, d) => { setSel({ session: s, day: d }); if (picked) { setPendingDrop({ session: s, day: d, instructorId: picked }); setPicked(null); } }} selectedId={sel?.session.sessionId ?? null} />
        ) : (
          <PeopleByDay data={data} onOpen={(id) => { const x = sessionById.get(id); if (x) setSel(x); }} />
        )}
        {layout === "courses" && canEdit ? (
          <SideList instructors={data.instructors} picked={picked} setPicked={setPicked} focus={sel ? `${sel.day.date}|${sel.session.slot}` : null} />
        ) : null}
      </div>

      {sel ? (
        <SessionPanel
          key={sel.session.sessionId + (pendingDrop?.instructorId ?? "")}
          data={data}
          selected={sel}
          canEdit={canEdit}
          preselect={pendingDrop && pendingDrop.session.sessionId === sel.session.sessionId ? pendingDrop.instructorId : null}
          instructors={data.instructors}
          byId={byId}
          onClose={() => { setSel(null); setPendingDrop(null); }}
          onChanged={() => { setPendingDrop(null); router.refresh(); }}
        />
      ) : null}
    </div>
  );
}

/* ---------- Layout (a): course cards per day ---------- */
function CoursesByDay({ data, canEdit, picked, dropTarget, setDropTarget, onDrop, onOpen, selectedId }: {
  data: BoardData; canEdit: boolean; picked: string | null; dropTarget: string | null; setDropTarget: (id: string | null) => void;
  onDrop: (s: RotaSession, d: RotaDay, instructorId: string) => void; onOpen: (s: RotaSession, d: RotaDay) => void; selectedId: string | null;
}) {
  return (
    <div className="overflow-x-auto pb-1">
    <div className="grid min-w-[56rem] grid-cols-7 gap-2">
      {data.days.map((d) => (
        <div key={d.date} className="min-w-0 rounded-card border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-navy">{d.label}</div>
          <div className="space-y-1.5 p-1.5">
            {d.sessions.length === 0 ? <p className="px-1 py-3 text-center text-[11px] text-slate-300">—</p> : null}
            {d.sessions.map((s) => {
              const open = data.openRoles[s.sessionId] ?? [];
              const flags = data.problems[s.sessionId] ?? [];
              const isTarget = dropTarget === s.sessionId;
              return (
                <button
                  key={s.sessionId}
                  type="button"
                  onClick={() => onOpen(s, d)}
                  onDragOver={(e) => { if (!canEdit) return; e.preventDefault(); if (dropTarget !== s.sessionId) setDropTarget(s.sessionId); }}
                  onDragLeave={() => { if (dropTarget === s.sessionId) setDropTarget(null); }}
                  onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/instructor"); if (id) onDrop(s, d, id); }}
                  className={`block w-full rounded-lg border p-2 text-left text-xs transition ${isTarget ? "border-teal bg-teal/10 ring-2 ring-teal/40" : selectedId === s.sessionId ? "border-navy bg-navy/5" : picked ? "border-dashed border-teal/50 hover:bg-teal/5" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"} ${s.audience === "youth" ? "border-l-4 border-l-amber" : s.audience === "adult" ? "border-l-4 border-l-teal" : "border-l-4 border-l-slate-300"}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-semibold leading-tight text-navy">{s.courseName}</span>
                    {flags.length ? <span title={flags.join("\n")} className="rounded-full bg-port/15 px-1.5 text-[10px] font-semibold text-port">⚠{flags.length}</span> : null}
                  </div>
                  <div className="text-[11px] text-slate-500">{fmtTime(s.startAt)}–{fmtTime(s.endAt)}</div>
                  {open.length ? <span className="mt-1 inline-block rounded-full bg-amber/15 px-1.5 text-[10px] font-semibold text-amber" title={open.map((r) => `${r.missing} × ${r.roleName}`).join(", ")}>needs {open.reduce((n, r) => n + r.missing, 0)}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
    </div>
  );
}

/* ---------- Side list of people (drag source) ---------- */
function SideList({ instructors, picked, setPicked, focus }: { instructors: BoardInstructor[]; picked: string | null; setPicked: (id: string | null) => void; focus: string | null }) {
  const [q, setQ] = useState("");
  const shown = instructors.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <aside className="rounded-card border border-slate-200 bg-white p-2">
      <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">People</p>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find…" aria-label="Find an instructor" className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-teal" />
      {focus ? <p className="mb-1 px-1 text-[10px] text-slate-400">Dots show availability for the selected slot.</p> : <p className="mb-1 px-1 text-[10px] text-slate-400">Click a session to see availability for its slot.</p>}
      <ul className="max-h-[60vh] space-y-0.5 overflow-y-auto">
        {shown.map((i) => {
          const a = focus ? i.availability[focus] : undefined;
          const av = a ? AVAIL[a.status] ?? AVAIL.unasked! : null;
          return (
            <li key={i.id}>
              <button
                type="button"
                draggable
                onDragStart={(e) => { e.dataTransfer.setData("text/instructor", i.id); e.dataTransfer.effectAllowed = "copy"; }}
                onClick={() => setPicked(picked === i.id ? null : i.id)}
                title={`${i.name}${av ? ` · ${av.word}${a?.source === "pattern" ? " (usual week)" : a?.source === "default" ? " (not answered)" : ""}` : ""}${i.fit ? "" : ` · ${i.fitReason}`}`}
                className={`flex w-full cursor-grab items-center gap-2 rounded-lg px-2 py-1 text-left text-xs ${picked === i.id ? "bg-teal/15 ring-1 ring-teal" : "hover:bg-slate-50"}`}
              >
                {av ? <span className={`h-2 w-2 flex-none rounded-full ${av.dot} ${a?.source === "default" ? "opacity-40" : ""}`} /> : <span className="h-2 w-2 flex-none rounded-full bg-slate-200" />}
                <span className={`truncate ${i.fit ? "text-navy" : "text-port"}`}>{i.name}</span>
                {i.under18 ? <span className="rounded bg-amber/15 px-1 text-[9px] font-semibold text-amber">U18</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

/* ---------- Layout (b): people down the side, days across ---------- */
function PeopleByDay({ data, onOpen }: { data: BoardData; onOpen: (sessionId: string) => void }) {
  const cell = new Map<string, { id: string; name: string; status: string; dayOnly: boolean }[]>();
  for (const d of data.days) for (const s of d.sessions) for (const m of s.staff) {
    const k = `${m.instructorId}|${d.date}|${s.slot}`;
    cell.set(k, [...(cell.get(k) ?? []), { id: s.sessionId, name: s.courseName, status: m.status, dayOnly: Boolean(m.dayOnly) }]);
  }
  const slots = SLOTS.filter((code) => data.days.some((d) => d.sessions.some((s) => s.slot === code)));
  const rows = slots.length ? slots : (["AM", "PM"] as const);
  return (
    <div className="overflow-x-auto rounded-card border border-slate-200 bg-white">
      <table className="w-full min-w-[960px] border-collapse text-left text-xs">
        <thead>
          <tr className="bg-slate-50">
            <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-navy">Instructor</th>
            {data.days.map((d) => <th key={d.date} colSpan={rows.length} className="border-b border-r border-slate-200 px-1 py-2 text-center font-semibold text-navy last:border-r-0">{d.label.split(" ")[0]} <span className="font-normal text-slate-400">{d.date.slice(8)}</span></th>)}
          </tr>
          <tr className="bg-slate-50 text-[10px] text-slate-400">
            <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50" />
            {data.days.map((d) => rows.map((code, i) => <th key={`${d.date}-${code}`} className={`border-b px-1 py-1 text-center font-semibold ${i === rows.length - 1 ? "border-r border-slate-200" : ""}`}>{code}</th>))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.instructors.map((i) => (
            <tr key={i.id}>
              <td className="sticky left-0 z-10 whitespace-nowrap border-r border-slate-200 bg-white px-3 py-1.5 font-semibold text-navy">{i.name}{i.under18 ? <span className="ml-1 rounded bg-amber/15 px-1 text-[9px] font-semibold text-amber">U18</span> : null}</td>
              {data.days.map((d) => rows.map((code, ci) => {
                const items = cell.get(`${i.id}|${d.date}|${code}`) ?? [];
                const a = i.availability[`${d.date}|${code}`];
                const av = a ? AVAIL[a.status] ?? AVAIL.unasked! : AVAIL.unasked!;
                return (
                  <td key={`${d.date}-${code}`} className={`h-10 w-16 px-1 py-1 align-top ${ci === rows.length - 1 ? "border-r border-slate-200" : ""} ${items.length === 0 ? (a?.status === "available" ? "bg-starboard/5" : a?.status === "unavailable" && a.source !== "default" ? "bg-port/5" : "") : ""}`} title={`${d.label} ${SLOT_LABEL[code]}: ${av.word}`}>
                    {items.map((x) => (
                      <button key={x.id} type="button" onClick={() => onOpen(x.id)} className={`mb-0.5 block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium ${x.status === "declined" ? "bg-port/10 text-port line-through" : x.dayOnly ? "bg-teal/15 text-teal" : "bg-navy/10 text-navy"}`}>{x.name}</button>
                    ))}
                    {items.length === 0 && a?.status === "available" ? <span className="block text-center text-[9px] text-starboard">free</span> : null}
                  </td>
                );
              }))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Side panel for one session ---------- */
type Member = RotaSession["staff"][number];
interface SlotRowProps {
  roleTypeId: string; roleName: string; member?: Member; extra?: boolean;
  candidates: BoardInstructor[]; byId: Map<string, BoardInstructor>; slotKey: string; dayWord: string; slot: string;
  courseTypeId: string | null; courseId: string | null; canEdit: boolean; multiDay: boolean; pending: boolean; preselect: string | null;
  onAssign: (instructorId: string, roleTypeId: string, replacing?: Member) => void; onRemove: (m: Member, scope: "course" | "day") => void; onAskRemove: (m: Member) => void;
}

function optionLabel(i: BoardInstructor, slotKey: string, courseTypeId: string | null): string {
  const a = i.availability[slotKey];
  const av = a ? AVAIL[a.status] ?? AVAIL.unasked! : AVAIL.unasked!;
  const q = courseTypeId ? (i.knownQualifications ? i.teaches.includes(courseTypeId) : null) : null;
  return `${i.name} · ${av.word}${a?.source === "default" ? " (not answered)" : a?.source === "pattern" ? " (usual)" : ""}${!i.fit ? ` · ${i.fitReason}` : ""}${q === false ? " · not qualified for this course" : ""}`;
}

/** One role slot: filled (name, Change, Remove) or empty (pick someone, Assign). */
function SlotRow({ roleTypeId, roleName, member, extra, candidates, byId, slotKey, dayWord, slot, courseTypeId, courseId, canEdit, multiDay, pending, preselect, onAssign, onRemove, onAskRemove }: SlotRowProps) {
  const [changing, setChanging] = useState(false);
  const [pick, setPick] = useState(!member && preselect ? preselect : "");
  const [wt, setWt] = useState<{ blocks: string; warns: string } | null>(null);
  const chosen = pick ? byId.get(pick) : undefined;
  const chosenAvail = chosen?.availability[slotKey];
  const qualified = chosen && courseTypeId ? (chosen.knownQualifications ? chosen.teaches.includes(courseTypeId) : null) : null;
  useEffect(() => {
    if (!pick || !chosen?.under18 || !courseId) { setWt(null); return; }
    let live = true;
    boardWorkingTimeAction(courseId, pick).then((r) => { if (live && r.ok && r.active) setWt({ blocks: r.blocks, warns: r.warns }); }).catch(() => {});
    return () => { live = false; };
  }, [pick, chosen?.under18, courseId]);
  const field = "min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal";
  const showPicker = canEdit && (!member || changing);

  return (
    <li className="rounded-lg border border-slate-200 px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-28 flex-none text-xs font-semibold text-slate-500">{roleName}{extra ? <span className="block text-[10px] font-normal text-slate-400">not required</span> : null}</span>
        {member && !changing ? (
          <>
            <span className={`font-medium ${member.status === "declined" ? "text-port line-through" : "text-navy"}`}>{member.name}</span>
            {member.status === "confirmed" ? <span className="text-[10px] font-semibold text-starboard">confirmed</span> : member.status === "declined" ? <span className="rounded bg-port/10 px-1 text-[10px] font-semibold text-port">can&apos;t make it</span> : <span className="text-[10px] text-slate-400">unconfirmed</span>}
            {member.dayOnly ? <span className="rounded bg-teal/15 px-1 text-[9px] font-semibold uppercase text-teal">this day only</span> : null}
            {canEdit ? (
              <span className="ml-auto flex items-center gap-2 text-xs">
                <button type="button" disabled={pending} onClick={() => { setChanging(true); setPick(""); }} className="rounded border border-slate-300 px-2 py-0.5 font-medium text-navy hover:bg-slate-50">Change</button>
                {member.dayOnly ? <button type="button" disabled={pending} onClick={() => onRemove(member, "day")} className="text-slate-400 hover:text-port">Remove</button> : (
                  <>
                    {multiDay ? <button type="button" disabled={pending} onClick={() => onRemove(member, "day")} className="text-slate-400 hover:text-port" title="Not needed this day; stays on the rest of the course">Skip this day</button> : null}
                    <button type="button" disabled={pending} onClick={() => onAskRemove(member)} className="text-slate-400 hover:text-port">Remove</button>
                  </>
                )}
              </span>
            ) : null}
          </>
        ) : showPicker ? (
          <>
            <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label={`Who for ${roleName}`} className={field}>
              <option value="">{member ? `Replace ${member.name} with…` : "Choose someone…"}</option>
              {candidates.map((i) => <option key={i.id} value={i.id}>{optionLabel(i, slotKey, courseTypeId)}</option>)}
            </select>
            <button type="button" disabled={pending || !pick} onClick={() => { onAssign(pick, roleTypeId, changing ? member : undefined); setChanging(false); setPick(""); }} className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{member ? "Save" : "Assign"}</button>
            {changing ? <button type="button" onClick={() => { setChanging(false); setPick(""); }} className="text-xs text-slate-400 hover:text-navy">Cancel</button> : null}
          </>
        ) : (
          <span className="text-sm text-amber">Not filled</span>
        )}
      </div>
      {showPicker && chosen ? (
        <div className="mt-1.5 space-y-0.5 pl-[7.5rem] text-xs">
          <p className={chosenAvail?.status === "available" ? "text-starboard" : chosenAvail?.status === "unavailable" ? "text-port" : "text-slate-500"}>Availability {dayWord} {slot}: {(chosenAvail ? AVAIL[chosenAvail.status] ?? AVAIL.unasked! : AVAIL.unasked!).word}{chosenAvail?.source === "default" ? " (hasn't answered; counts as busy)" : chosenAvail?.source === "pattern" ? " (usual week)" : chosenAvail?.source === "assumed" ? " (office keeps their availability)" : ""}</p>
          {!chosen.fit ? <p className="text-port">Not cleared to roster: {chosen.fitReason}</p> : null}
          {qualified === false ? <p className="text-port">Their licences don&apos;t cover this course (override needed).</p> : qualified === null ? <p className="text-slate-400">No licences recorded for them.</p> : null}
          {chosen.under18 ? (wt ? (wt.blocks ? <p className="text-port">Young worker&apos;s hours: {wt.blocks}</p> : wt.warns ? <p className="text-amber">Young worker&apos;s hours: {wt.warns}</p> : <p className="text-starboard">Young worker&apos;s hours: within the limits.</p>) : <p className="text-slate-400">Checking young worker&apos;s hours…</p>) : null}
        </div>
      ) : null}
    </li>
  );
}

/** Students and the roles the course needs, editable for the whole course. */
function StaffingEditor({ courseId, students, needs, roles, onSaved, onCancel }: {
  courseId: string; students: number; needs: { roleTypeId: string; count: number }[]; roles: BoardData["roles"]; onSaved: () => void; onCancel: () => void;
}) {
  const [n, setN] = useState(String(students || ""));
  const [lines, setLines] = useState(needs.length ? needs.map((x) => ({ ...x })) : [{ roleTypeId: roles[0]?.id ?? "", count: 1 }]);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const save = () => {
    setErr(null);
    start(async () => {
      const r = await setCourseStaffingAction({ courseId, students: Math.max(0, Math.round(Number(n) || 0)), roles: lines.filter((l) => l.roleTypeId && l.count > 0) });
      if (r.ok) onSaved(); else setErr(r.error ?? "That didn't save");
    });
  };
  const field = "rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-teal";
  return (
    <div className="mb-3 rounded-lg border border-navy/20 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Students and staff needed (whole course)</p>
      <label className="flex items-center gap-2 text-sm text-navy">Students <input type="number" min={0} max={500} value={n} onChange={(e) => setN(e.target.value)} className={`${field} w-20`} /></label>
      <ul className="mt-2 space-y-1.5">
        {lines.map((l, i) => (
          <li key={i} className="flex items-center gap-2">
            <input type="number" min={1} max={50} value={l.count} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, count: Math.max(1, Math.round(Number(e.target.value) || 1)) } : x)))} aria-label="How many" className={`${field} w-16`} />
            <span className="text-slate-400">×</span>
            <select value={l.roleTypeId} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, roleTypeId: e.target.value } : x)))} aria-label="Role" className={`${field} flex-1`}>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="text-xs text-slate-400 hover:text-port" aria-label="Remove this role">✕</button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setLines((ls) => [...ls, { roleTypeId: roles[0]?.id ?? "", count: 1 }])} className="mt-2 text-xs font-medium text-teal hover:underline">+ Add a role</button>
      {err ? <p className="mt-2 text-xs text-port">{err}</p> : null}
      <div className="mt-3 flex items-center gap-2">
        <button type="button" disabled={pending} onClick={save} className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
        <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:text-navy">Cancel</button>
      </div>
    </div>
  );
}

function SessionPanel({ data, selected, canEdit, preselect, instructors, byId, onClose, onChanged }: {
  data: BoardData; selected: Selected; canEdit: boolean; preselect: string | null; instructors: BoardInstructor[]; byId: Map<string, BoardInstructor>; onClose: () => void; onChanged: () => void;
}) {
  const { session: s, day } = selected;
  const meta = data.sessionMeta[s.sessionId];
  const open = data.openRoles[s.sessionId] ?? [];
  const flags = data.problems[s.sessionId] ?? [];
  const [pending, start] = useTransition();
  const [scope, setScope] = useState<"course" | "day">(meta?.multiDay ? "day" : "course");
  const [override, setOverride] = useState(false);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [askRemove, setAskRemove] = useState<Member | null>(null);
  const key = `${day.date}|${s.slot}`;

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, then?: () => Promise<unknown>) => start(async () => {
    try {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Done" : r.error ?? "Failed" });
      if (r.ok) { if (then) await then(); setOverride(false); onChanged(); }
    } catch { setMsg({ ok: false, text: "That didn't save. Reload the page and try again." }); }
  });
  const remove = (m: Member, sc: "course" | "day") => run(() => boardRemoveAction({ sessionId: s.sessionId, courseId: s.courseId, instructorId: m.instructorId, roleTypeId: m.roleTypeId, assignmentId: m.assignmentId, scope: sc }));
  // Change = put the new person on first, then take the old one off, so a refused assignment leaves the slot as it was.
  const assign = (instructorId: string, roleTypeId: string, replacing?: Member) => run(
    () => boardAssignAction({ sessionId: s.sessionId, courseId: s.courseId, instructorId, roleTypeId, scope: replacing?.dayOnly ? "day" : scope, override }),
    replacing ? () => boardRemoveAction({ sessionId: s.sessionId, courseId: s.courseId, instructorId: replacing.instructorId, roleTypeId: replacing.roleTypeId, assignmentId: replacing.assignmentId, scope: replacing.dayOnly ? "day" : "course" }) : undefined,
  );

  // One row per required place; people on roles the course doesn't list come after.
  const active = s.staff.filter((m) => m.status !== "declined");
  const used = new Set<Member>();
  const slots: { roleTypeId: string; roleName: string; member?: Member; extra?: boolean }[] = [];
  // Needs worked out from the ratio (no role lines) are met by anyone in a teaching role, as the ratio check counts them.
  const roleFlags = new Map(data.roles.map((r) => [r.id, r]));
  const fits = (m: Member, roleTypeId: string) => {
    if (meta?.explicitRoles !== false) return m.roleTypeId === roleTypeId;
    const want = roleFlags.get(roleTypeId), has = roleFlags.get(m.roleTypeId);
    if (!want || !has) return m.roleTypeId === roleTypeId;
    return want.isSafetyCover ? Boolean(has.isSafetyCover) : Boolean(has.countsTowardRatio && !has.isSafetyCover);
  };
  for (const n of meta?.needs ?? []) {
    const onRole = s.staff.filter((m) => fits(m, n.roleTypeId) && !used.has(m));
    const filled = onRole.filter((m) => m.status !== "declined");
    const declined = onRole.filter((m) => m.status === "declined");
    for (const m of [...filled, ...declined]) used.add(m);
    const label = (m?: Member) => (m && m.roleTypeId !== n.roleTypeId ? m.role : n.roleName);
    for (let i = 0; i < Math.max(n.count, filled.length); i++) slots.push({ roleTypeId: n.roleTypeId, roleName: label(filled[i]), member: filled[i] });
    for (const m of declined) slots.push({ roleTypeId: n.roleTypeId, roleName: label(m), member: m });
  }
  for (const m of s.staff.filter((x) => !used.has(x))) slots.push({ roleTypeId: m.roleTypeId, roleName: m.role, member: m, extra: true });
  const candidates = instructors.filter((i) => !active.some((m) => m.instructorId === i.id));
  const preselectRole = open[0]?.roleTypeId;
  const dayWord = day.label.split(" ")[0] ?? "";
  const totalNeeded = (meta?.needs ?? []).reduce((n, x) => n + x.count, 0);

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl" role="dialog" aria-label={`${s.courseName}, ${day.label}`}>
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <p className="font-display text-lg font-semibold text-navy">{s.courseName}</p>
          <p className="text-xs text-slate-500">{day.label} · {SLOT_LABEL[s.slot] ?? s.slot} {fmtTime(s.startAt)}–{fmtTime(s.endAt)}{s.locations.length ? ` · ${s.locations.join(", ")}` : ""}</p>
          <Link href={`/office/courses/${s.courseId}`} className="text-xs font-medium text-teal hover:underline">Open the course →</Link>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-slate-400 hover:text-navy" aria-label="Close">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-sm text-navy"><span className="font-semibold">{s.students || 0}</span> students · <span className="font-semibold">{totalNeeded}</span> staff needed</p>
          {canEdit && meta ? <button type="button" onClick={() => setEditing((v) => !v)} className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-navy hover:bg-slate-50">{editing ? "Close" : "Edit students & roles"}</button> : null}
        </div>
        {editing && meta ? <StaffingEditor courseId={meta.courseId} students={s.students} needs={(meta.needs ?? []).map((x) => ({ roleTypeId: x.roleTypeId, count: x.count }))} roles={data.roles} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); setMsg({ ok: true, text: "Students and roles saved for the whole course" }); onChanged(); }} /> : null}
        {flags.length ? <ul className="mb-3 space-y-1 rounded-lg bg-port/5 p-2 text-xs text-port">{flags.map((f, i) => <li key={i}>⚠ {f}</li>)}</ul> : null}

        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Roles</p>
          {open.length ? <p className="text-xs text-amber">{open.reduce((n, r: OpenRole) => n + r.missing, 0)} still to fill</p> : <p className="text-xs text-starboard">Every role filled</p>}
        </div>
        {canEdit && meta?.multiDay ? (
          <div className="mb-2 flex gap-3 text-xs text-slate-600">
            <span className="text-slate-400">Assign for:</span>
            <label className="flex items-center gap-1"><input type="radio" name="scope" checked={scope === "day"} onChange={() => setScope("day")} /> This day only</label>
            <label className="flex items-center gap-1"><input type="radio" name="scope" checked={scope === "course"} onChange={() => setScope("course")} /> Whole course</label>
          </div>
        ) : null}
        {slots.length === 0 ? <p className="mb-3 text-xs text-slate-400">This course doesn&apos;t list any roles yet. Use &ldquo;Edit students &amp; roles&rdquo; to add them.</p> : (
          <ul className="mb-3 space-y-1.5">
            {slots.map((sl, i) => (
              <SlotRow key={`${sl.roleTypeId}-${sl.member?.instructorId ?? "open"}-${i}`} {...sl} candidates={candidates} byId={byId} slotKey={key} dayWord={dayWord} slot={s.slot}
                courseTypeId={meta?.courseTypeId ?? null} courseId={meta?.courseId ?? null} canEdit={canEdit} multiDay={Boolean(meta?.multiDay)} pending={pending}
                preselect={!sl.member && sl.roleTypeId === preselectRole ? preselect : null}
                onAssign={assign} onRemove={remove} onAskRemove={setAskRemove} />
            ))}
          </ul>
        )}
        {canEdit ? <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} /> Override a block (Busy, clash, licence, qualification)</label> : null}
        {msg ? <p className={`mt-3 text-xs ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</p> : null}
      </div>
      <ConfirmDialog open={askRemove !== null} title={`Take ${askRemove?.name ?? ""} off ${s.courseName}?`} confirmLabel="Remove from the course" busy={pending} onCancel={() => setAskRemove(null)}
        onConfirm={() => { const m = askRemove; setAskRemove(null); if (m) remove(m, "course"); }}
        consequences={[meta?.multiDay ? "They come off every day of this course, not just this one (use “skip this day” for one day)." : "They come off this session.", "Their unapproved pay lines for it are removed; approved ones are kept and flagged.", "If the week is published they are told straight away.", "Any open role this leaves shows on the board and the problems list."]} />
    </div>
  );
}
