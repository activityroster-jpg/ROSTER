"use client";

import { WeekHours } from "@/components/office/WeekHours";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { BoardData, BoardInstructor, OpenRole } from "@/lib/services/board";
import type { RotaDay, RotaSession } from "@/lib/services/schedule";
import { askConfirm } from "@/lib/ui/ask-confirm";
import { autoRosterAction, previewUndoAutoRosterAction, undoAutoRosterAction, boardAssignAction, boardAssignManyAction, boardRemoveAction } from "@/app/(app)/office/rota/board-actions";
import { setCourseStaffingAction } from "@/app/(app)/office/courses/actions";
import { ConfirmDialog } from "./ConfirmDialog";
import { groupCandidates } from "@/lib/domain/assign-order";
import { PeoplePicker } from "./PeoplePicker";
import { AddRolePlace } from "./AddRolePlace";
import { SurplusPicker, type SurplusGroup } from "./SurplusPicker";
import { PlaceSelect } from "./PlaceSelect";
import { placeFitIssue, type PlaceFacts } from "@/lib/domain/teaching";

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
 * side panel: who is on it, availability and clashes,
 * add, remove or swap in place, on the whole course or this day only.
 */
export function RosterBoard({ data, canEdit }: { data: BoardData; canEdit: boolean }) {
  const router = useRouter();
  const [layout, setLayout] = useState<Layout>("courses");
  const [sel, setSel] = useState<Selected | null>(null);
  const [picked, setPicked] = useState<string | null>(null); // instructor chosen in the side list (click-to-assign fallback)
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{ session: RotaSession; day: RotaDay; instructorId: string } | null>(null);
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoBusy, startAuto] = useTransition();
  const [autoMsg, setAutoMsg] = useState<{ ok: boolean; text: string; undoId?: string } | null>(null);
  const [autoMode, setAutoMode] = useState<"open" | "redo">("open");
  const undoAuto = (id: string) => startAuto(async () => {
    const p = await previewUndoAutoRosterAction(id);
    if (!p.ok || !p.canUndo) { setAutoMsg({ ok: p.ok, text: p.ok ? p.message ?? "Nothing to undo" : p.error ?? "Couldn't undo" }); return; }
    if (!(await askConfirm(p.message ?? "Undo this run?"))) return;
    const r = await undoAutoRosterAction(id);
    setAutoMsg({ ok: r.ok, text: r.ok ? r.message ?? "Undone" : r.error ?? "Couldn't undo" });
    if (r.ok) router.refresh();
  });
  const runAuto = () => startAuto(async () => {
    const r = await autoRosterAction({ monday: data.monday, mode: autoMode });
    setAutoOpen(false);
    setAutoMsg({ ok: r.ok, text: r.ok ? r.message ?? "Done" : r.error ?? "Couldn't auto-roster", undoId: r.ok ? r.undoId : undefined });
    if (r.ok) router.refresh();
  });

  useEffect(() => {
    try { const v = window.localStorage.getItem(STORAGE); if (v === "people" || v === "courses") setLayout(v); } catch { /* ignore */ }
  }, []);
  const choose = (l: Layout) => { setLayout(l); try { window.localStorage.setItem(STORAGE, l); } catch { /* ignore */ } };

  const byId = useMemo(() => new Map(data.instructors.map((i) => [i.id, i])), [data.instructors]);
  const sessionById = useMemo(() => { const m = new Map<string, Selected>(); for (const d of data.days) for (const s of d.sessions) m.set(s.sessionId, { session: s, day: d }); return m; }, [data.days]);
  // The panel shows the session as it is now, not as it was when clicked: after
  // an assignment the board reloads and the new person must appear in their row.
  const live = sel ? sessionById.get(sel.session.sessionId) ?? sel : null;
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
          {totalOpen ? <span className="font-semibold text-amber">{totalOpen} place{totalOpen === 1 ? "" : "s"} still open</span> : <span className="font-semibold text-starboard">Every place filled</span>}
          {data.problemCounts.total ? <> · <span className="font-semibold text-port">{data.problemCounts.total} problem{data.problemCounts.total === 1 ? "" : "s"}</span></> : null}
          {canEdit ? <span className="ml-2 text-slate-400">Click a session to see its places and assign people.</span> : null}
        </p>
        {canEdit ? (
          <div className="flex items-center gap-2">
            <button type="button" disabled={autoBusy} onClick={() => { setAutoMode(totalOpen ? "open" : "redo"); setAutoOpen(true); }} title="Fill the open places from whoever is free and suitable, spread evenly, or redo the whole week"
              className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{autoBusy ? "Filling…" : "✨ Auto-roster"}</button>
            <a href="/learn?topic=rostering" target="_blank" rel="noreferrer" className="text-xs font-medium text-teal hover:underline">📖 Read the guide</a>
          </div>
        ) : null}
      </div>
      {autoMsg ? <p role="status" className={`mb-3 rounded-lg border px-3 py-2 text-sm ${autoMsg.ok ? "border-starboard/40 bg-starboard/10 text-navy" : "border-port/40 bg-port/10 text-port"}`}>{autoMsg.text}{autoMsg.undoId ? <> <button type="button" disabled={autoBusy} onClick={() => undoAuto(autoMsg.undoId!)} className="ml-1 font-semibold text-teal hover:underline disabled:opacity-50">Undo</button></> : null}</p> : null}
      <ConfirmDialog open={autoOpen} title="Auto-roster this week" tone="teal" confirmLabel={autoMode === "redo" ? "Redo the whole week" : `Fill the ${totalOpen} open place${totalOpen === 1 ? "" : "s"}`} busy={autoBusy} confirmDisabled={autoMode === "open" && totalOpen === 0} onConfirm={runAuto} onCancel={() => setAutoOpen(false)}
        consequences={["Each place goes to someone who is Free (then Maybe) for that session, cleared to roster, able to teach the course type and holding the place's instructor type (or a higher one on its ladder); sessions are shared out as evenly as possible, and nobody is put on two sessions that clash.", "The usual checks run; nothing is overridden, and places nobody suitable is free for stay open.", "You can change any of it afterwards by hand."]}>
        <div className="space-y-2 text-sm text-navy">
          <label className="flex items-start gap-2">
            <input type="radio" name="auto-mode" checked={autoMode === "open"} onChange={() => setAutoMode("open")} className="mt-1" />
            <span><span className="font-semibold">Fill the open places only</span> ({totalOpen} open). Everyone already on the roster keeps their sessions.</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="auto-mode" checked={autoMode === "redo"} onChange={() => setAutoMode("redo")} className="mt-1" />
            <span><span className="font-semibold">Redo the whole week.</span> Every place is worked out afresh, then saved in one go. People who keep their sessions aren&rsquo;t touched; on confirmed days only the people whose shifts change are told. Undo reverses only what the redo changed.</span>
          </label>
        </div>
      </ConfirmDialog>

      <div className={sel ? "lg:mr-[28rem]" : ""}>
        {layout === "courses" ? (
          <CoursesByDay data={data} canEdit={canEdit} picked={picked} dropTarget={dropTarget} setDropTarget={setDropTarget} onDrop={onDropInstructor} onOpen={(s, d) => { setSel({ session: s, day: d }); if (picked) { setPendingDrop({ session: s, day: d, instructorId: picked }); setPicked(null); } }} selectedId={sel?.session.sessionId ?? null} />
        ) : (
          <PeopleByDay data={data} onOpen={(id) => { const x = sessionById.get(id); if (x) setSel(x); }} />
        )}
      </div>

      {live ? (
        <SessionPanel
          key={live.session.sessionId + (pendingDrop?.instructorId ?? "")}
          data={data}
          selected={live}
          canEdit={canEdit}
          preselect={pendingDrop && pendingDrop.session.sessionId === live.session.sessionId ? pendingDrop.instructorId : null}
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
              // The card's state at a glance: red = a problem, orange = places open, green = filled and fine.
              const tone = flags.length
                ? { bar: "border-l-[10px] border-l-port", card: "border-port bg-port/20 hover:bg-port/25" }
                : open.length
                  ? { bar: "border-l-[10px] border-l-amber", card: "border-amber bg-amber/25 hover:bg-amber/30" }
                  : { bar: "border-l-[10px] border-l-starboard", card: "border-starboard bg-starboard/20 hover:bg-starboard/25" };
              return (
                <button
                  key={s.sessionId}
                  type="button"
                  onClick={() => onOpen(s, d)}
                  onDragOver={(e) => { if (!canEdit) return; e.preventDefault(); if (dropTarget !== s.sessionId) setDropTarget(s.sessionId); }}
                  onDragLeave={() => { if (dropTarget === s.sessionId) setDropTarget(null); }}
                  onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/instructor"); if (id) onDrop(s, d, id); }}
                  className={`block w-full rounded-lg border p-2 text-left text-xs transition ${isTarget ? "border-teal bg-teal/10 ring-2 ring-teal/40" : selectedId === s.sessionId ? "border-navy bg-navy/5" : picked ? "border-dashed border-teal/50 hover:bg-teal/5" : tone.card} ${tone.bar}`}
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

/* ---------- Layout (b): people down the side, days across ---------- */
function PeopleByDay({ data, onOpen }: { data: BoardData; onOpen: (sessionId: string) => void }) {
  const cell = new Map<string, { id: string; name: string; status: string; dayOnly: boolean }[]>();
  // Hours each person is rostered this week (declined sessions don't count), shown beside their name.
  const minutes = new Map<string, number>();
  const counted = new Set<string>();
  for (const d of data.days) for (const s of d.sessions) for (const m of s.staff) {
    const k = `${m.instructorId}|${d.date}|${s.slot}`;
    cell.set(k, [...(cell.get(k) ?? []), { id: s.sessionId, name: s.courseName, status: m.status, dayOnly: Boolean(m.dayOnly) }]);
    const once = `${m.instructorId}|${s.sessionId}`;
    if (m.status !== "declined" && !counted.has(once)) { counted.add(once); minutes.set(m.instructorId, (minutes.get(m.instructorId) ?? 0) + Math.max(0, s.endAt - s.startAt) / 60000); }
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
              <td className="sticky left-0 z-10 whitespace-nowrap border-r border-slate-200 bg-white px-3 py-1.5 font-semibold text-navy">
                {i.name}{i.under18 ? <span className="ml-1 rounded bg-amber/15 px-1 text-[9px] font-semibold text-amber">U18</span> : null}
                <WeekHours minutes={minutes.get(i.id) ?? 0} />
              </td>
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
  courseTypeId: string | null; courseId: string | null; canEdit: boolean; multiDay: boolean; pending: boolean;
  elsewhere: Map<string, Elsewhere>;
  /** The place this row is for (its instructor type), for the qualification check. */
  place: PlaceFacts | undefined;
  /** The place the person in the row actually holds (on a ratio-worked row it can be another teaching place). */
  memberPlace: PlaceFacts | undefined;
  /** Staff accept or decline their shifts, so show whether they have. */
  staffAccept?: boolean;
  /** The person picked for this row (the panel holds every row's pick, so one person can't be picked twice). */
  pick: string; onPick: (instructorId: string) => void;
  onAssign: (instructorId: string, roleTypeId: string, override: boolean, note: string | null, replacing?: Member, moveFrom?: Elsewhere) => void; onRemove: (m: Member, scope: "course" | "day") => void; onAskRemove: (m: Member) => void;
}

/** The qualification problem with this person in this place, in words, or null. */
function qualificationIssue(i: BoardInstructor, courseTypeId: string | null, place: PlaceFacts | undefined): string | null {
  const kind = placeFitIssue(i, courseTypeId, place);
  if (kind === "course") return "Their instructor types don't cover this course.";
  if (kind === "place") return `Not a ${place?.name ?? "holder of this instructor type"} (or higher on that ladder).`;
  return null;
}

/** What stands in the way of putting this person on this session: each line is a block the office can override. Empty = nothing. */
function issuesFor(i: BoardInstructor | undefined, slotKey: string, dayWord: string, slot: string, courseTypeId: string | null, elsewhere: Map<string, Elsewhere>, place: PlaceFacts | undefined): string[] {
  if (!i) return [];
  const a = i.availability[slotKey];
  const out: string[] = [];
  if (a?.status === "unavailable" && i.busyBlocks !== false) out.push(`Busy ${dayWord} ${slot} in their availability.`);
  const on = elsewhere.get(i.id)?.name;
  if (on) out.push(`Already on ${on} in this slot.`);
  if (!i.fit) out.push(`Not cleared to roster: ${i.fitReason}`);
  const q = qualificationIssue(i, courseTypeId, place);
  if (q) out.push(q);
  return out;
}

/** Green / orange / red facts for one person on one session, for the pickers' order. */
function candidateFacts(i: BoardInstructor, slotKey: string, courseTypeId: string | null, elsewhere: Map<string, Elsewhere> | undefined, place: PlaceFacts | undefined) {
  const status = i.availability[slotKey]?.status ?? "unasked";
  return { fit: i.fit, qualified: i.knownQualifications ? placeFitIssue(i, courseTypeId, place) === null : null, available: (status === "available" || status === "unasked") && !elsewhere?.get(i.id) };
}

/** Why they sit where they do: on another course, or what they said about the slot, plus licence and qualification notes. */
function candidateNote(i: BoardInstructor, slotKey: string, courseTypeId: string | null, elsewhere: Map<string, Elsewhere> | undefined, place: PlaceFacts | undefined): string {
  const a = i.availability[slotKey];
  const av = a ? AVAIL[a.status] ?? AVAIL.unasked! : AVAIL.unasked!;
  const kind = placeFitIssue(i, courseTypeId, place);
  const bits: string[] = [];
  if (!i.fit) bits.push(i.fitReason);
  if (kind === "course") bits.push("not qualified for this course");
  else if (kind === "place") bits.push(`not a ${place?.name ?? "holder of this type"}`);
  if (i.expiredTypes?.length) bits.push(`${i.expiredTypes.join(", ")} expired`);
  const on = elsewhere?.get(i.id)?.name;
  if (on) bits.push(`on another course: ${on}`);
  else bits.push(`${av.word}${a?.source === "default" ? " (not answered)" : a?.source === "pattern" ? " (usual week)" : ""}`);
  return bits.join(" · ");
}

/** Who is on another session that day in the same slot, or at times that overlap this one, and which course. */
/** Where someone already is in this slot: the other session and their place on it, so the panel can move them here. */
interface Elsewhere { name: string; sessionId: string; courseId: string; member: Member }

function elsewhereInSlot(days: RotaDay[], date: string, slot: string, sessionId: string): Map<string, Elsewhere> {
  const out = new Map<string, Elsewhere>();
  const day = days.find((d) => d.date === date);
  const me = day?.sessions.find((s) => s.sessionId === sessionId);
  const overlaps = (s: RotaSession) => Boolean(me && s.startAt < me.endAt && me.startAt < s.endAt);
  for (const s of day?.sessions ?? []) {
    if (s.sessionId === sessionId || (s.slot !== slot && !overlaps(s))) continue;
    for (const m of s.staff) if (m.status !== "declined" && !out.has(m.instructorId)) out.set(m.instructorId, { name: s.courseName, sessionId: s.sessionId, courseId: s.courseId, member: m });
  }
  return out;
}

/** One role slot: filled (name, Change, Remove) or empty (pick someone, Assign). */
function SlotRow({ roleTypeId, roleName, member, extra, candidates, byId, slotKey, dayWord, slot, courseTypeId, courseId, canEdit, multiDay, pending, elsewhere, place, memberPlace, pick, onPick, onAssign, onRemove, onAskRemove, staffAccept }: SlotRowProps) {
  const [changing, setChanging] = useState(false);
  const setPick = onPick;
  const chosen = pick ? byId.get(pick) : undefined;
  const chosenAvail = chosen?.availability[slotKey];
  const known = chosen ? chosen.knownQualifications : true;
  const showPicker = canEdit && (!member || changing);
  // A pick with a block only goes on through "Assign anyway", which records the override and why.
  const issues = showPicker ? issuesFor(chosen, slotKey, dayWord, slot, courseTypeId, elsewhere, place) : [];
  // Someone already in the row is judged against the place they actually hold.
  const memberIssues = member && !changing ? issuesFor(byId.get(member.instructorId), slotKey, dayWord, slot, courseTypeId, elsewhere, memberPlace) : [];
  const clash = chosen ? elsewhere.get(chosen.id) : undefined;
  const commit = (moveFrom?: Elsewhere) => { onAssign(pick, roleTypeId, issues.length > 0, issues.length ? issues.join(" ") : null, changing ? member : undefined, moveFrom); setChanging(false); setPick(""); };

  return (
    <li className="rounded-lg border border-slate-200 px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-28 flex-none text-xs font-semibold text-slate-500">{roleName}{extra ? <span className="block text-[10px] font-normal text-slate-400">not required</span> : null}</span>
        {member && !changing ? (
          <>
            <span className={`font-medium ${member.status === "declined" ? "text-port line-through" : "text-navy"}`}>{member.name}</span>
            {member.status === "declined" ? <span className="rounded bg-port/10 px-1 text-[10px] font-semibold text-port">can&apos;t make it</span> : !staffAccept ? null : member.status === "confirmed" ? <span className="text-[10px] font-semibold text-starboard">accepted</span> : <span className="text-[10px] text-slate-400">not accepted yet</span>}
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
            <PeoplePicker value={pick} onChange={setPick} ariaLabel={`Who for ${roleName}`} className="flex-1" placeholder={member ? `Replace ${member.name} with…` : "Choose someone…"}
              groups={groupCandidates(candidates, (i) => candidateFacts(i, slotKey, courseTypeId, elsewhere, place), (i) => i.name).map((g) => ({ tier: g.tier, items: g.items.map((i) => ({ id: i.id, label: i.name, note: candidateNote(i, slotKey, courseTypeId, elsewhere, place) })) }))} />
            {clash ? (
              <>
                <button type="button" disabled={pending || !pick} onClick={() => commit(clash)} title={`Put them on here and take them off ${clash.name} for this day`} className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">Move here</button>
                <button type="button" disabled={pending || !pick} onClick={() => commit()} title="Put them on here as well; the clash override is recorded" className="rounded-lg bg-amber px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber/90 disabled:opacity-50">Keep on both</button>
              </>
            ) : issues.length ? (
              <button type="button" disabled={pending || !pick} onClick={() => commit()} title="Put them on despite the block; the override and the reason are recorded" className="rounded-lg bg-amber px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber/90 disabled:opacity-50">Assign anyway</button>
            ) : (
              <button type="button" disabled={pending || !pick} onClick={() => commit()} className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">Assign</button>
            )}
            {changing ? <button type="button" onClick={() => { setChanging(false); setPick(""); }} className="text-xs text-slate-400 hover:text-navy">Cancel</button> : null}
          </>
        ) : (
          <span className="text-sm text-amber">Not filled</span>
        )}
      </div>
      {showPicker && chosen ? (
        <div className="mt-1.5 space-y-0.5 pl-[7.5rem] text-xs">
          <p className={chosenAvail?.status === "available" ? "text-starboard" : chosenAvail?.status === "unavailable" ? "text-port" : "text-slate-500"}>Availability {dayWord} {slot}: {(chosenAvail ? AVAIL[chosenAvail.status] ?? AVAIL.unasked! : AVAIL.unasked!).word}{chosenAvail?.source === "default" ? " (hasn't answered; counts as busy)" : chosenAvail?.source === "pattern" ? " (usual week)" : chosenAvail?.source === "assumed" ? " (office keeps their availability)" : ""}</p>
          {issues.map((t) => <p key={t} className="text-port">{t}</p>)}
          {clash ? <p className="text-slate-500">“Move here” takes them off {clash.name} for this day; “Keep on both” leaves them on it as well (the clash override is recorded).</p>
            : issues.length ? <p className="text-slate-500">Press “Assign anyway” to put them on regardless; the override is recorded.</p> : !known ? <p className="text-slate-400">No instructor types recorded for them yet.</p> : null}
        </div>
      ) : null}
      {memberIssues.length ? (
        <div className="mt-1.5 space-y-0.5 pl-[7.5rem] text-xs">
          {memberIssues.map((t) => <p key={t} className="text-amber">⚠ {t}</p>)}
        </div>
      ) : null}
    </li>
  );
}

/** Students and the places the course needs, editable for the whole course. */
function StaffingEditor({ courseId, students, needs, roles, relevant, filling, noteFor, onSaved, onCancel }: {
  courseId: string; students: number; needs: { roleTypeId: string; count: number }[]; roles: BoardData["roles"];
  /** Places whose instructor type teaches this course: the drop-downs list these first, the rest behind "Other…". */
  relevant: readonly string[];
  filling: { roleTypeId: string; roleName: string; member?: Member; extra?: boolean }[]; noteFor: (instructorId: string, roleTypeId: string) => string | undefined; onSaved: (message?: string) => void; onCancel: () => void;
}) {
  const [n, setN] = useState(String(students || ""));
  // A new line starts on the course's lead instructor type (its lowest relevant teaching place), else the first teaching place.
  const leadId = [...roles].filter((r) => relevant.includes(r.id)).sort((a, b) => (a.rank >= 20 ? 0 : 1) - (b.rank >= 20 ? 0 : 1) || a.rank - b.rank)[0]?.id
    ?? roles.find((r) => r.countsTowardRatio)?.id ?? roles[0]?.id ?? "";
  const [lines, setLines] = useState(needs.length ? needs.map((x) => ({ ...x })) : [{ roleTypeId: leadId, count: 1 }]);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  // Fewer places than people in a role (removed, or its count lowered): the office picks who comes off.
  // "Filling" follows the panel's rows, so an Assistant Instructor holding an Instructor place counts for that line.
  const surplus: SurplusGroup[] = needs.map((need) => {
    const people = filling.flatMap((sl) => (sl.roleTypeId === need.roleTypeId && sl.member && !sl.extra && sl.member.status !== "declined" ? [{ instructorId: sl.member.instructorId, name: sl.member.name, note: noteFor(sl.member.instructorId, sl.member.roleTypeId) }] : []));
    const count = lines.filter((l) => l.roleTypeId === need.roleTypeId).reduce((t, l) => t + l.count, 0);
    return { roleName: roles.find((r) => r.id === need.roleTypeId)?.name ?? "Role", people, surplus: people.length - count };
  }).filter((g) => g.surplus > 0);
  const save = (remove?: string[]) => {
    setConfirming(false);
    setErr(null);
    start(async () => {
      const r = await setCourseStaffingAction({ courseId, students: Math.max(0, Math.round(Number(n) || 0)), roles: lines.filter((l) => l.roleTypeId && l.count > 0), remove });
      if (r.ok) onSaved(r.message); else setErr(r.error ?? "That didn't save");
    });
  };
  const field = "rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-teal";
  return (
    <div className="mb-3 rounded-lg border border-navy/20 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Students and staff needed (whole course)</p>
      <p className="mb-2 text-xs text-slate-500">Each place is an instructor type. The list shows the types that teach this course; &ldquo;Other instructor type…&rdquo; opens the rest.</p>
      <label className="flex items-center gap-2 text-sm text-navy">Students <input type="number" min={0} max={500} value={n} onChange={(e) => setN(e.target.value)} className={`${field} w-20`} /></label>
      <ul className="mt-2 space-y-1.5">
        {lines.map((l, i) => (
          <li key={i} className="flex items-center gap-2">
            <input type="number" min={1} max={50} value={l.count} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, count: Math.max(1, Math.round(Number(e.target.value) || 1)) } : x)))} aria-label="How many" className={`${field} w-16`} />
            <span className="text-slate-400">×</span>
            <PlaceSelect value={l.roleTypeId} onChange={(id) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, roleTypeId: id } : x)))} places={roles} relevant={relevant} ariaLabel="Instructor type" className={`${field} flex-1`} />
            <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="text-xs text-slate-400 hover:text-port" aria-label="Remove this place">✕</button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setLines((ls) => [...ls, { roleTypeId: leadId, count: 1 }])} className="mt-2 text-xs font-medium text-teal hover:underline">+ Add a place</button>
      {err ? <p className="mt-2 text-xs text-port">{err}</p> : null}
      <div className="mt-3 flex items-center gap-2">
        <button type="button" disabled={pending} onClick={() => (surplus.length ? setConfirming(true) : save([]))} className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
        <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:text-navy">Cancel</button>
      </div>
      <SurplusPicker open={confirming} groups={surplus} busy={pending} onCancel={() => setConfirming(false)} onConfirm={(ids) => save(ids)} />
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
  const [editing, setEditing] = useState(false);
  // One pick per row (by row index). Someone picked for one row is left out of the others' lists.
  const [picks, setPicks] = useState<Record<number, string>>({});
  const setPickAt = (i: number, id: string) => setPicks((p) => { const n = { ...p }; if (id) n[i] = id; else delete n[i]; return n; });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [askRemove, setAskRemove] = useState<Member | null>(null);
  const key = `${day.date}|${s.slot}`;

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, then?: () => Promise<unknown>) => start(async () => {
    try {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Done" : r.error ?? "Failed" });
      if (r.ok) { if (then) await then(); onChanged(); }
    } catch { setMsg({ ok: false, text: "That didn't save. Reload the page and try again." }); }
  });
  const remove = (m: Member, sc: "course" | "day") => run(() => boardRemoveAction({ sessionId: s.sessionId, courseId: s.courseId, instructorId: m.instructorId, roleTypeId: m.roleTypeId, assignmentId: m.assignmentId, scope: sc }));
  // Change = put the new person on first, then take the old one off, so a refused assignment leaves the slot as it was.
  // "Move here" = assign here, then take them off the other session: just this day when that course runs on other days too.
  const assign = (instructorId: string, roleTypeId: string, override: boolean, note: string | null, replacing?: Member, moveFrom?: Elsewhere) => run(
    () => boardAssignAction({ sessionId: s.sessionId, courseId: s.courseId, instructorId, roleTypeId, scope: replacing?.dayOnly ? "day" : scope, override, note: moveFrom ? `Moved here from ${moveFrom.name}` : note }),
    replacing || moveFrom ? async () => {
      if (replacing) await boardRemoveAction({ sessionId: s.sessionId, courseId: s.courseId, instructorId: replacing.instructorId, roleTypeId: replacing.roleTypeId, assignmentId: replacing.assignmentId, scope: replacing.dayOnly ? "day" : "course" });
      if (moveFrom) {
        const m = moveFrom.member;
        const otherMultiDay = Boolean(data.sessionMeta[moveFrom.sessionId]?.multiDay);
        await boardRemoveAction({ sessionId: moveFrom.sessionId, courseId: moveFrom.courseId, instructorId: m.instructorId, roleTypeId: m.roleTypeId, assignmentId: m.assignmentId, scope: m.dayOnly || otherMultiDay ? "day" : "course" });
      }
    } : undefined,
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
  const elsewhere = elsewhereInSlot(data.days, day.date, s.slot, s.sessionId);
  const preselectRole = open[0]?.roleTypeId;
  const dayWord = day.label.split(" ")[0] ?? "";
  // A person dropped or clicked onto the session lands in the first open row for the role that needs them.
  const preselectRow = preselect ? slots.findIndex((sl) => !sl.member && sl.roleTypeId === preselectRole) : -1;
  const pickFor = (i: number) => picks[i] ?? (i === preselectRow && preselect && !Object.values(picks).includes(preselect) ? preselect : "");
  const pickedRows = slots.map((sl, i) => ({ i, sl, id: pickFor(i) })).filter((x) => x.id && !x.sl.member);
  const assignAll = () => run(async () => {
    const items = pickedRows.map(({ sl, id }) => { const issues = issuesFor(byId.get(id), key, dayWord, s.slot, meta?.courseTypeId ?? null, elsewhere, roleFlags.get(sl.roleTypeId)); return { instructorId: id, roleTypeId: sl.roleTypeId, override: issues.length > 0, note: issues.length ? issues.join(" ") : null }; });
    const r = await boardAssignManyAction({ sessionId: s.sessionId, courseId: s.courseId, scope, items });
    setPicks({});
    const failed = (r.results ?? []).filter((x) => !x.ok).map((x) => `${byId.get(x.instructorId)?.name ?? "Someone"}: ${x.message}`);
    return { ok: r.ok, message: failed.length ? `${r.message}. Not assigned — ${failed.join("; ")}` : r.message, error: r.error };
  });
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
          {canEdit && meta ? <button type="button" onClick={() => setEditing((v) => !v)} className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-navy hover:bg-slate-50">{editing ? "Close" : "Edit students & places"}</button> : null}
        </div>
        {editing && meta ? <StaffingEditor courseId={meta.courseId} students={s.students} needs={(meta.needs ?? []).map((x) => ({ roleTypeId: x.roleTypeId, count: x.count }))} roles={data.roles} relevant={meta.relevantRoleIds} filling={slots} noteFor={(id, roleTypeId) => issuesFor(byId.get(id), key, dayWord, s.slot, meta?.courseTypeId ?? null, elsewhere, roleFlags.get(roleTypeId)).join(" ") || undefined} onCancel={() => setEditing(false)} onSaved={(message) => { setEditing(false); setMsg({ ok: true, text: message && message !== "Saved" ? message : "Students and places saved for the whole course" }); onChanged(); }} /> : null}
        {flags.length ? <ul className="mb-3 space-y-1 rounded-lg bg-port/5 p-2 text-xs text-port">{flags.map((f, i) => <li key={i}>⚠ {f}</li>)}</ul> : null}

        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Places</p>
          {open.length ? <p className="text-xs text-amber">{open.reduce((n, r: OpenRole) => n + r.missing, 0)} still to fill</p> : <p className="text-xs text-starboard">Every place filled</p>}
        </div>
        {canEdit && meta?.multiDay ? (
          <div className="mb-2 flex gap-3 text-xs text-slate-600">
            <span className="text-slate-400">Assign for:</span>
            <label className="flex items-center gap-1"><input type="radio" name="scope" checked={scope === "day"} onChange={() => setScope("day")} /> This day only</label>
            <label className="flex items-center gap-1"><input type="radio" name="scope" checked={scope === "course"} onChange={() => setScope("course")} /> Whole course</label>
          </div>
        ) : null}
        {slots.length === 0 ? <p className="mb-3 text-xs text-slate-400">This course doesn&apos;t list any places yet. Use &ldquo;Edit students &amp; places&rdquo; to add them.</p> : (
          <ul className="mb-3 space-y-1.5">
            {slots.map((sl, i) => (
              <SlotRow key={`${sl.roleTypeId}-${sl.member?.instructorId ?? "open"}-${i}`} {...sl} byId={byId} slotKey={key} dayWord={dayWord} slot={s.slot} elsewhere={elsewhere} place={roleFlags.get(sl.roleTypeId)} memberPlace={sl.member ? roleFlags.get(sl.member.roleTypeId) : undefined} staffAccept={data.staffAccept}
                candidates={candidates.filter((c) => { const mine = pickFor(i); return c.id === mine || !slots.some((_, j) => j !== i && pickFor(j) === c.id); })}
                courseTypeId={meta?.courseTypeId ?? null} courseId={meta?.courseId ?? null} canEdit={canEdit} multiDay={Boolean(meta?.multiDay)} pending={pending}
                pick={pickFor(i)} onPick={(id) => setPickAt(i, id)}
                onAssign={(instructorId, roleTypeId, override, note, replacing, moveFrom) => { setPickAt(i, ""); assign(instructorId, roleTypeId, override, note, replacing, moveFrom); }} onRemove={remove} onAskRemove={setAskRemove} />
            ))}
          </ul>
        )}
        {canEdit && pickedRows.length > 1 ? (
          <div className="mb-3 flex items-center justify-end gap-2">
            <span className="text-xs text-slate-500">{pickedRows.length} picked</span>
            <button type="button" disabled={pending} onClick={assignAll} className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Assigning…" : `Assign all ${pickedRows.length}`}</button>
          </div>
        ) : null}
        {canEdit && meta ? <div className="mb-3"><AddRolePlace courseId={meta.courseId} roles={data.roles} relevant={meta.relevantRoleIds} onChanged={onChanged} /></div> : null}
        {msg ? <p className={`mt-3 text-xs ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</p> : null}
      </div>
      <ConfirmDialog open={askRemove !== null} title={`Take ${askRemove?.name ?? ""} off ${s.courseName}?`} confirmLabel="Remove from the course" busy={pending} onCancel={() => setAskRemove(null)}
        onConfirm={() => { const m = askRemove; setAskRemove(null); if (m) remove(m, "course"); }}
        consequences={[meta?.multiDay ? "They come off every day of this course, not just this one (use “skip this day” for one day)." : "They come off this session.", "Their unapproved pay lines for it are removed; approved ones are kept and flagged.", "If the day is confirmed they are told straight away.", "Any open role this leaves shows on the board and the problems list."]} />
    </div>
  );
}
