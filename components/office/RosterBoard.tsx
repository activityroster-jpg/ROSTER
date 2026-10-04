"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { BoardData, BoardInstructor, OpenRole } from "@/lib/services/board";
import type { RotaDay, RotaSession } from "@/lib/services/schedule";
import { boardAssignAction, boardRemoveAction, boardWorkingTimeAction } from "@/app/(app)/office/rota/board-actions";
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

      <div className={`grid gap-4 ${layout === "courses" && canEdit ? "lg:grid-cols-[1fr_15rem]" : ""}`}>
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
    <div className="grid gap-2 md:grid-cols-7">
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
                  <div className="text-[10px] text-slate-500">{fmtTime(s.startAt)}–{fmtTime(s.endAt)}{s.locations.length ? ` · ${s.locations[0]}` : ""}</div>
                  <ul className="mt-1 space-y-0.5">
                    {s.staff.map((m) => (
                      <li key={m.instructorId} className={`flex items-center gap-1 ${m.status === "declined" ? "text-port line-through" : "text-slate-700"}`}>
                        <span className={`h-1.5 w-1.5 flex-none rounded-full ${m.status === "confirmed" ? "bg-starboard" : m.status === "declined" ? "bg-port" : "bg-slate-300"}`} />
                        <span className="truncate">{m.name}</span>
                        <span className="truncate text-[10px] text-slate-400">{m.role}</span>
                        {m.dayOnly ? <span className="rounded bg-teal/15 px-1 text-[9px] font-semibold uppercase text-teal">day</span> : null}
                      </li>
                    ))}
                    {open.map((r) => (
                      <li key={r.roleTypeId} className="flex items-center gap-1 text-amber">
                        <span className="h-1.5 w-1.5 flex-none rounded-full border border-amber" />
                        <span>+ {r.missing > 1 ? `${r.missing} × ` : ""}{r.roleName}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
        </div>
      ))}
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
function SessionPanel({ data, selected, canEdit, preselect, instructors, byId, onClose, onChanged }: {
  data: BoardData; selected: Selected; canEdit: boolean; preselect: string | null; instructors: BoardInstructor[]; byId: Map<string, BoardInstructor>; onClose: () => void; onChanged: () => void;
}) {
  const { session: s, day } = selected;
  const meta = data.sessionMeta[s.sessionId];
  const open = data.openRoles[s.sessionId] ?? [];
  const flags = data.problems[s.sessionId] ?? [];
  const [pending, start] = useTransition();
  const [who, setWho] = useState(preselect ?? "");
  const [role, setRole] = useState(open[0]?.roleTypeId ?? data.roles[0]?.id ?? "");
  const [scope, setScope] = useState<"course" | "day">(meta?.multiDay ? "day" : "course");
  const [override, setOverride] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [wt, setWt] = useState<{ blocks: string; warns: string } | null>(null);
  const [askRemove, setAskRemove] = useState<RotaSession["staff"][number] | null>(null);
  const key = `${day.date}|${s.slot}`;
  const chosen = who ? byId.get(who) : undefined;
  const chosenAvail = chosen?.availability[key];
  const qualified = chosen && meta ? (chosen.knownQualifications ? chosen.teaches.includes(meta.courseTypeId) : null) : null;

  useEffect(() => {
    if (!who || !chosen?.under18 || !meta) { setWt(null); return; }
    let live = true;
    boardWorkingTimeAction(meta.courseId, who).then((r) => { if (live && r.ok && r.active) setWt({ blocks: r.blocks, warns: r.warns }); }).catch(() => {});
    return () => { live = false; };
  }, [who, chosen?.under18, meta]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => start(async () => {
    const r = await fn();
    setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Done" : r.error ?? "Failed" });
    if (r.ok) { setWho(""); setOverride(false); setNote(""); onChanged(); }
  });
  const assign = () => { if (!who || !role || !meta) return; run(() => boardAssignAction({ sessionId: s.sessionId, courseId: s.courseId, instructorId: who, roleTypeId: role, scope, override, note: override ? note : null })); };
  const remove = (m: RotaSession["staff"][number], sc: "course" | "day") => run(() => boardRemoveAction({ sessionId: s.sessionId, courseId: s.courseId, instructorId: m.instructorId, roleTypeId: m.roleTypeId, assignmentId: m.assignmentId, scope: sc }));
  const candidates = instructors.filter((i) => !s.staff.some((m) => m.instructorId === i.id && m.status !== "declined"));
  const field = "rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal";

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl" role="dialog" aria-label={`${s.courseName}, ${day.label}`}>
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <p className="font-display text-lg font-semibold text-navy">{s.courseName}</p>
          <p className="text-xs text-slate-500">{day.label} · {SLOT_LABEL[s.slot] ?? s.slot} {fmtTime(s.startAt)}–{fmtTime(s.endAt)}{s.locations.length ? ` · ${s.locations.join(", ")}` : ""}{s.students ? ` · ${s.students} students` : ""}</p>
          <Link href={`/office/courses/${s.courseId}`} className="text-xs font-medium text-teal hover:underline">Open the course →</Link>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-slate-400 hover:text-navy" aria-label="Close">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
        {flags.length ? <ul className="mb-3 space-y-1 rounded-lg bg-port/5 p-2 text-xs text-port">{flags.map((f, i) => <li key={i}>⚠ {f}</li>)}</ul> : null}

        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">On this session</p>
        {s.staff.length === 0 ? <p className="mb-3 text-xs text-slate-400">Nobody yet.</p> : (
          <ul className="mb-3 space-y-1">
            {s.staff.map((m) => (
              <li key={m.instructorId} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
                <span className={`font-medium ${m.status === "declined" ? "text-port line-through" : "text-navy"}`}>{m.name}</span>
                <span className="text-xs text-slate-500">{m.role}</span>
                {m.status === "confirmed" ? <span className="text-[10px] font-semibold text-starboard">confirmed</span> : m.status === "declined" ? <span className="rounded bg-port/10 px-1 text-[10px] font-semibold text-port">can&apos;t make it</span> : <span className="text-[10px] text-slate-400">unconfirmed</span>}
                {m.dayOnly ? <span className="rounded bg-teal/15 px-1 text-[9px] font-semibold uppercase text-teal">this day only</span> : null}
                {canEdit ? (
                  <span className="ml-auto flex items-center gap-2 text-[11px]">
                    {m.dayOnly ? <button type="button" disabled={pending} onClick={() => remove(m, "day")} className="text-slate-400 hover:text-port">remove</button> : (
                      <>
                        {meta?.multiDay ? <button type="button" disabled={pending} onClick={() => remove(m, "day")} className="text-slate-400 hover:text-port" title="Not needed this day; stays on the rest of the course">skip this day</button> : null}
                        <button type="button" disabled={pending} onClick={() => setAskRemove(m)} className="text-slate-400 hover:text-port">remove</button>
                      </>
                    )}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {open.length ? <p className="mb-3 text-xs text-amber">Still open: {open.map((r: OpenRole) => `${r.missing} × ${r.roleName}`).join(", ")}</p> : <p className="mb-3 text-xs text-starboard">Every role filled.</p>}

        {canEdit ? (
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Add someone</p>
            <div className="grid gap-2">
              <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Instructor" className={field}>
                <option value="">Instructor…</option>
                {candidates.map((i) => {
                  const a = i.availability[key];
                  const av = a ? AVAIL[a.status] ?? AVAIL.unasked! : AVAIL.unasked!;
                  const q = meta ? (i.knownQualifications ? i.teaches.includes(meta.courseTypeId) : null) : null;
                  return <option key={i.id} value={i.id}>{i.name} · {av.word}{a?.source === "default" ? " (not answered)" : a?.source === "pattern" ? " (usual)" : ""}{!i.fit ? ` · ${i.fitReason}` : ""}{q === false ? " · not qualified for this type" : ""}</option>;
                })}
              </select>
              {chosen ? (
                <div className="space-y-0.5 text-xs">
                  <p className={chosenAvail?.status === "available" ? "text-starboard" : chosenAvail?.status === "unavailable" ? "text-port" : "text-slate-500"}>Availability {day.label.split(" ")[0]} {s.slot}: {(chosenAvail ? AVAIL[chosenAvail.status] ?? AVAIL.unasked! : AVAIL.unasked!).word}{chosenAvail?.source === "default" ? " (hasn't answered; counts as busy)" : chosenAvail?.source === "pattern" ? " (usual week)" : ""}</p>
                  {!chosen.fit ? <p className="text-port">Not cleared to roster: {chosen.fitReason}</p> : null}
                  {qualified === false ? <p className="text-port">Their qualifications don&apos;t cover this course type (override needed).</p> : qualified === null ? <p className="text-slate-400">No qualifications recorded for them.</p> : null}
                  {chosen.under18 ? (wt ? (wt.blocks ? <p className="text-port">Young worker&apos;s hours: {wt.blocks}</p> : wt.warns ? <p className="text-amber">Young worker&apos;s hours: {wt.warns}</p> : <p className="text-starboard">Young worker&apos;s hours: within the limits.</p>) : <p className="text-slate-400">Checking young worker&apos;s hours…</p>) : null}
                </div>
              ) : null}
              <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role" className={field}>
                {data.roles.map((r) => <option key={r.id} value={r.id}>{r.name}{open.some((o) => o.roleTypeId === r.id) ? " (needed)" : ""}</option>)}
              </select>
              {meta?.multiDay ? (
                <div className="flex gap-3 text-xs text-slate-600">
                  <label className="flex items-center gap-1"><input type="radio" name="scope" checked={scope === "day"} onChange={() => setScope("day")} /> This day only</label>
                  <label className="flex items-center gap-1"><input type="radio" name="scope" checked={scope === "course"} onChange={() => setScope("course")} /> Whole course</label>
                </div>
              ) : null}
              <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} /> Override a block (Busy, clash, cert, qualification) with a note</label>
              {override ? <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why it's fine, for the record" maxLength={300} className={field} /> : null}
              <button type="button" disabled={pending || !who || !role || (override && !note.trim())} onClick={assign} className="rounded-lg bg-teal px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : scope === "day" && meta?.multiDay ? "Add for this day" : "Assign"}</button>
            </div>
          </div>
        ) : null}
        {msg ? <p className={`mt-3 text-xs ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</p> : null}
      </div>
      <ConfirmDialog open={askRemove !== null} title={`Take ${askRemove?.name ?? ""} off ${s.courseName}?`} confirmLabel="Remove from the course" busy={pending} onCancel={() => setAskRemove(null)}
        onConfirm={() => { const m = askRemove; setAskRemove(null); if (m) remove(m, "course"); }}
        consequences={[meta?.multiDay ? "They come off every day of this course, not just this one (use “skip this day” for one day)." : "They come off this session.", "Their unapproved pay lines for it are removed; approved ones are kept and flagged.", "If the week is published they are told straight away.", "Any open role this leaves shows on the board and the problems list."]} />
    </div>
  );
}
