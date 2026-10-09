"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { askConfirm } from "@/lib/ui/ask-confirm";
import { useRouter } from "next/navigation";
import { assignableForCellAction, assignFromAvailabilityAction, setAvailabilityBulkAction, setAvailabilityForStaffAction, type CellCandidate } from "@/app/(app)/office/availability/actions";

export interface MatrixRow {
  instructorId: string;
  name: string;
  /** The office keeps their availability: unanswered slots count as Free. */
  officeManaged?: boolean;
  /** Has signed up to the app. */
  hasLogin?: boolean;
  /** Effective status per `${date}|${slot}`: available, tentative, unavailable or unasked. */
  cells: Record<string, string>;
  /** set | pattern | default | unasked | assumed. */
  sources: Record<string, string>;
  /** self | office | leave for dated answers. */
  setBy: Record<string, string>;
  notes: Record<string, string>;
  assigned: Record<string, string[]>;
}

const SLOTS = ["AM", "PM", "EV"] as const;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CELL: Record<string, { label: string; word: string; cls: string }> = {
  available: { label: "✓", word: "Free", cls: "bg-starboard/15 text-starboard hover:bg-starboard/25" },
  tentative: { label: "~", word: "Maybe", cls: "bg-amber/15 text-amber hover:bg-amber/25" },
  unavailable: { label: "✕", word: "Busy", cls: "bg-port/15 text-port hover:bg-port/25" },
  default: { label: "·", word: "Busy (not answered yet)", cls: "bg-slate-100 text-slate-400 hover:bg-slate-200" },
  unasked: { label: "?", word: "Not asked yet", cls: "bg-white text-slate-300 hover:bg-slate-50" },
  assumed: { label: "✓", word: "Free (the office keeps their availability)", cls: "bg-starboard/[0.06] text-starboard/50 hover:bg-starboard/15" },
};
type Brush = "available" | "tentative" | "unavailable" | "clear";
const BRUSHES: { value: Brush; label: string; cls: string }[] = [
  { value: "available", label: "✓ Free", cls: "bg-starboard/15 text-starboard" },
  { value: "tentative", label: "~ Maybe", cls: "bg-amber/15 text-amber" },
  { value: "unavailable", label: "✕ Busy", cls: "bg-port/15 text-port" },
  { value: "clear", label: "Clear answer", cls: "bg-slate-100 text-slate-600" },
];
/** What a quick-set applies to: one person's week, everyone on a day or one slot, or everyone all week. */
type Quick = { kind: "row"; instructorId: string; name: string } | { kind: "day"; date: string; label: string } | { kind: "slot"; date: string; slot: string; label: string } | { kind: "week" };
const SET_BY: Record<string, string> = { office: "set by the office", leave: "approved leave", self: "" };

interface Selected { instructorId: string; name: string; date: string; slot: string; dayLabel: string }

export function AvailabilityMatrix({ days, rows, availableCounts, staffManagedBy = "staff" }: { days: string[]; rows: MatrixRow[]; availableCounts: Record<string, number>; staffManagedBy?: "staff" | "office" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [brush, setBrush] = useState<Brush | null>(null);
  const [painted, setPainted] = useState<Record<string, Brush>>({});
  const stroke = useRef<{ instructorId: string; date: string; slot: string }[] | null>(null);
  const [quick, setQuick] = useState<Quick | null>(null);
  const [quickMsg, setQuickMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setPainted({}), [rows]);

  const runBulk = (input: Record<string, unknown>, done?: () => void) => {
    setQuickMsg(null);
    start(async () => {
      const res = await setAvailabilityBulkAction(input);
      setQuickMsg({ ok: res.ok, text: res.ok ? res.message ?? "Saved" : res.error ?? "That didn't save" });
      if (res.ok) { done?.(); router.refresh(); } else setPainted({});
    });
  };
  const statusOf = (b: Brush) => (b === "clear" ? null : b);

  // Brush: press on a cell and drag across others; one save per stroke.
  const paint = (instructorId: string, date: string, slot: string) => {
    if (!brush || !stroke.current) return;
    const key = `${instructorId}|${date}|${slot}`;
    if (stroke.current.some((c) => `${c.instructorId}|${c.date}|${c.slot}` === key)) return;
    stroke.current.push({ instructorId, date, slot });
    setPainted((p) => ({ ...p, [key]: brush }));
  };
  useEffect(() => {
    const finish = () => {
      const cells = stroke.current;
      stroke.current = null;
      if (cells?.length && brush) runBulk({ cells, status: statusOf(brush) });
    };
    window.addEventListener("pointerup", finish);
    return () => window.removeEventListener("pointerup", finish);
    // runBulk is stable enough for this listener; brush is the only input that changes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brush]);

  const applyQuick = (b: Brush) => {
    if (!quick) return;
    const status = statusOf(b);
    if (quick.kind === "row") runBulk({ instructorIds: [quick.instructorId], dates: days, slots: [...SLOTS], status });
    else if (quick.kind === "day") runBulk({ everyone: true, dates: [quick.date], slots: [...SLOTS], status });
    else if (quick.kind === "slot") runBulk({ everyone: true, dates: [quick.date], slots: [quick.slot], status });
    else runBulk({ everyone: true, dates: days, slots: [...SLOTS], status });
  };
  const quickTitle = !quick ? "" : quick.kind === "row" ? `${quick.name}, this whole week` : quick.kind === "day" ? `Everyone, ${quick.label} (all day)` : quick.kind === "slot" ? `Everyone, ${quick.label}` : "Everyone, this whole week";
  const [sel, setSel] = useState<Selected | null>(null);
  const [cands, setCands] = useState<CellCandidate[] | null>(null);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [role, setRole] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const openCell = (instructorId: string, name: string, date: string, slot: string, dayLabel: string) => {
    setSel({ instructorId, name, date, slot, dayLabel });
    setCands(null); setMsg(null); setRole("");
    start(async () => {
      const res = await assignableForCellAction(date, slot, instructorId);
      if (res.ok) { setCands(res.candidates); setRoles(res.roles); setRole(res.roles[0]?.id ?? ""); }
      else { setMsg({ ok: false, text: res.error }); setCands([]); }
    });
  };

  const assign = (courseId: string) => {
    if (!sel) return;
    setMsg(null);
    start(async () => {
      const res = await assignFromAvailabilityAction(courseId, sel.instructorId, role);
      setMsg({ ok: res.ok, text: res.ok ? res.message ?? "Assigned" : res.error ?? "Failed" });
      if (res.ok) {
        setCands((cs) => (cs ? cs.filter((c) => c.courseId !== courseId) : cs));
        router.refresh();
      }
    });
  };

  const setStatus = (status: "available" | "tentative" | "unavailable" | null) => {
    if (!sel) return;
    setMsg(null);
    start(async () => {
      const res = await setAvailabilityForStaffAction({ instructorId: sel.instructorId, date: sel.date, slot: sel.slot, status });
      setMsg({ ok: res.ok, text: res.ok ? (status ? `Set to ${CELL[status]!.word} (recorded as set by the office)` : "Answer removed; their usual week or Busy applies") : res.error ?? "Failed" });
      if (res.ok) router.refresh();
    });
  };

  const selRow = sel ? rows.find((r) => r.instructorId === sel.instructorId) : null;
  const selKey = sel ? `${sel.date}|${sel.slot}` : "";
  const selStatus = selRow?.cells[selKey] ?? "unavailable";
  const selSource = selRow?.sources[selKey] ?? "default";
  const selNote = sel ? selRow?.notes[sel.date] : undefined;

  return (
    <div>
      <div className="mb-3 rounded-card border border-teal/30 bg-teal/5 p-3 text-sm">
        <p className="font-semibold text-navy">Set availability for lots of slots at once</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">1</span>
          <span className="text-slate-600">Choose:</span>
          {BRUSHES.map((b) => (
            <button key={b.value} type="button" aria-pressed={brush === b.value} onClick={() => setBrush(brush === b.value ? null : b.value)} className={`rounded-full px-3 py-1 text-xs font-semibold ${b.cls} ${brush === b.value ? "ring-2 ring-navy" : "opacity-80 hover:opacity-100"}`}>{b.label}</button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white ${brush ? "bg-navy" : "bg-slate-300"}`}>2</span>
          {brush ? (
            <>
              <span className="text-slate-700">Click or drag across the grid to paint slots <strong>{BRUSHES.find((b) => b.value === brush)?.label}</strong>, or</span>
              <button type="button" disabled={pending} onClick={async () => { if (await askConfirm(`Set everyone's whole week to ${BRUSHES.find((b) => b.value === brush)?.label}? Approved leave is left as it is.`)) runBulk({ everyone: true, dates: days, slots: [...SLOTS], status: statusOf(brush) }); }} className="rounded-full border border-navy/30 bg-white px-3 py-1 text-xs font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">apply to everyone, this week</button>
              <button type="button" onClick={() => setBrush(null)} className="text-xs text-slate-500 underline hover:text-navy">stop</button>
            </>
          ) : (
            <span className="text-slate-500">Then click or drag across the grid, or apply it to everyone for the week.</span>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">Or click a <strong>name</strong> to set that person&rsquo;s whole week, or a <strong>day</strong> or <strong>AM / PM / EV</strong> heading to set everyone then. With nothing chosen, clicking one slot opens it to set or fill a shift.</p>
      </div>

      {quick ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-card border border-navy/20 bg-white px-3 py-2 text-xs shadow-sm">
          <span className="font-semibold text-navy">{quickTitle}:</span>
          {BRUSHES.map((b) => (
            <button key={b.value} type="button" disabled={pending} onClick={() => applyQuick(b.value)} className={`rounded-full px-2.5 py-1 font-semibold disabled:opacity-50 ${b.cls}`}>{b.label}</button>
          ))}
          {quick.kind === "row" ? <a href={`/office/staff/${quick.instructorId}#availability`} className="text-teal hover:underline">Usual week and more →</a> : null}
          <button type="button" onClick={() => { setQuick(null); setQuickMsg(null); }} className="ml-auto text-slate-400 hover:text-navy">✕ Close</button>
          <p className="basis-full text-[11px] text-slate-400">Saved as set by the office. Approved leave is left as it is. &ldquo;Clear answer&rdquo; goes back to their usual week, or to {staffManagedBy === "office" ? "free for office-managed people (busy for anyone who keeps their own)" : "busy until they answer (free for office-managed people)"}.</p>
        </div>
      ) : null}
      {quickMsg ? <p className={`mb-2 text-sm ${quickMsg.ok ? "text-starboard" : "text-port"}`}>{quickMsg.text}</p> : null}

      <div className="overflow-x-auto rounded-card border border-slate-200 bg-white">
        <table className="border-collapse text-center text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600">
              <th rowSpan={3} className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-4 text-left text-sm font-semibold">Instructor</th>
              {DAY_LABELS.map((d, i) => (
                <th key={d} colSpan={3} className="border-l border-slate-200 p-0 text-sm font-bold text-navy">
                  <button type="button" onClick={() => { setQuick({ kind: "day", date: days[i]!, label: `${d} ${days[i]?.slice(8)}` }); setQuickMsg(null); }} className="w-full px-1 py-2 hover:bg-slate-100" title={`Set everyone's availability for ${d}`}>{d} <span className="font-normal text-slate-400">{days[i]?.slice(8)}</span></button>
                </th>
              ))}
            </tr>
            <tr className="bg-slate-50 text-xs text-slate-400">
              {days.map((d, di) => SLOTS.map((s, si) => (
                <th key={`${di}-${s}`} className={`w-12 p-0 font-semibold ${si === 0 ? "border-l border-slate-200" : ""}`}>
                  <button type="button" onClick={() => { setQuick({ kind: "slot", date: d, slot: s, label: `${DAY_LABELS[di]} ${d.slice(8)} ${s}` }); setQuickMsg(null); }} className="w-full px-1 py-1 hover:bg-slate-100 hover:text-navy" title={`Set everyone's availability for ${DAY_LABELS[di]} ${s}`}>{s}</button>
                </th>
              )))}
            </tr>
            <tr className="bg-slate-50">
              {days.map((d, di) => SLOTS.map((s, si) => {
                const n = availableCounts[`${d}|${s}`] ?? 0;
                return <th key={`c${di}-${s}`} className={`px-1 pb-1.5 text-xs font-bold ${n > 0 ? "text-starboard" : "text-slate-300"} ${si === 0 ? "border-l border-slate-200" : ""}`} title="Instructors free then">{n}</th>;
              }))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.instructorId} className="hover:bg-slate-50/40">
                <td className="sticky left-0 z-10 whitespace-nowrap border-r border-slate-200 bg-white p-0 text-left text-sm font-semibold text-navy">
                  <button type="button" onClick={() => { setQuick({ kind: "row", instructorId: r.instructorId, name: r.name }); setQuickMsg(null); }} className="flex w-full items-center gap-1.5 px-4 py-1.5 text-left hover:bg-slate-50" title={`Set ${r.name}'s whole week`}>
                    {r.name}
                    {r.officeManaged ? <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-500" title="The office keeps their availability">office</span> : null}
                  </button>
                </td>
                {days.map((d, di) => SLOTS.map((s, si) => {
                  const key = `${d}|${s}`;
                  const status = r.cells[key] ?? "unavailable";
                  const source = r.sources[key] ?? "default";
                  const paintedAs = painted[`${r.instructorId}|${d}|${s}`];
                  const cfg = (paintedAs ? (paintedAs === "clear" ? CELL.unasked : CELL[paintedAs]) : source === "default" ? CELL.default : source === "unasked" ? CELL.unasked : source === "assumed" ? CELL.assumed : CELL[status]) ?? CELL.default!;
                  const rostered = r.assigned[key];
                  const rosterLabel = rostered?.length ? `Rostered: ${rostered.join(" · ")}` : "";
                  const note = si === 0 ? r.notes[d] : undefined;
                  const by = SET_BY[r.setBy[key] ?? "self"];
                  const isSel = sel?.instructorId === r.instructorId && sel?.date === d && sel?.slot === s;
                  const cellLabel = `${r.name}, ${DAY_LABELS[di]} ${s}: ${cfg.word}${source === "pattern" ? " (usual week)" : ""}${by ? ` (${by})` : ""}${r.notes[d] ? ` · note: ${r.notes[d]}` : ""}${rosterLabel ? ` · ${rosterLabel}` : ""} — click to set or fill a shift`;
                  return (
                    <td key={`${r.instructorId}-${di}-${s}`} className={`p-0 ${si === 0 ? "border-l border-slate-200" : ""}`}>
                      <button
                        type="button"
                        onClick={() => { if (!brush) openCell(r.instructorId, r.name, d, s, `${DAY_LABELS[di]} ${days[di]?.slice(8) ?? ""}`); }}
                        onPointerDown={(e) => { if (!brush) return; e.preventDefault(); stroke.current = []; paint(r.instructorId, d, s); }}
                        onPointerEnter={() => paint(r.instructorId, d, s)}
                        title={cellLabel}
                        aria-label={cellLabel}
                        className={`relative flex h-10 w-12 items-center justify-center text-base font-semibold transition ${cfg.cls} ${isSel ? "ring-2 ring-inset ring-navy" : ""} ${brush ? "cursor-crosshair select-none" : ""}`}
                      >
                        <span aria-hidden="true">{cfg.label}</span>
                        {source === "pattern" ? <span aria-hidden="true" className="absolute right-0.5 top-0.5 text-[7px] font-bold uppercase leading-none opacity-60">usual</span> : null}
                        {note ? <span aria-hidden="true" className="absolute left-0.5 top-0.5 text-[9px] leading-none text-slate-500">✎</span> : null}
                        {rostered?.length ? <span title={rosterLabel} className="absolute bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-navy" /> : null}
                      </button>
                    </td>
                  );
                }))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cell panel: set availability, fill a shift */}
      {sel ? (
        <div className="mt-4 rounded-card border border-navy/20 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-navy">
              <span className="text-teal">{sel.name}</span>, {sel.dayLabel} {sel.slot}
            </p>
            <button type="button" onClick={() => { setSel(null); setCands(null); setMsg(null); }} className="text-sm text-slate-400 hover:text-navy">✕ Close</button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-xs font-medium text-slate-500">Availability:</span>
            <span className="text-xs text-slate-600">
              {selSource === "unasked" ? "not asked yet (beyond the window)" : selSource === "default" ? "Busy, not answered yet" : selSource === "assumed" ? "Free (the office keeps their availability; mark Busy when they can't work)" : `${CELL[selStatus]?.word ?? selStatus}${selSource === "pattern" ? " from their usual week" : ""}${SET_BY[selRow?.setBy[selKey] ?? "self"] ? ` (${SET_BY[selRow?.setBy[selKey] ?? "self"]})` : ""}`}
            </span>
            <span className="mx-1 text-slate-300">|</span>
            <span className="text-xs font-medium text-slate-500">Set for them:</span>
            {(["available", "tentative", "unavailable"] as const).map((s) => (
              <button key={s} type="button" disabled={pending} onClick={() => setStatus(s)} className={`rounded-full px-2.5 py-1 text-xs font-semibold disabled:opacity-50 ${CELL[s]!.cls} ${selStatus === s && selSource === "set" ? "ring-2 ring-navy/40" : ""}`}>{CELL[s]!.label} {CELL[s]!.word}</button>
            ))}
            {selSource === "set" ? <button type="button" disabled={pending} onClick={() => setStatus(null)} className="text-xs text-slate-400 hover:text-navy disabled:opacity-50">remove answer</button> : null}
          </div>
          {selNote ? <p className="mt-2 text-xs text-slate-600">✎ Note from {sel.name} for {sel.dayLabel}: “{selNote}”</p> : null}

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Fill a shift</p>
          {pending && cands === null ? (
            <p className="mt-2 text-sm text-slate-400">Finding sessions they can cover…</p>
          ) : cands && cands.length > 0 ? (
            <>
              <div className="mt-2 flex items-center gap-2">
                <label className="text-xs font-medium text-slate-500">Assign as</label>
                <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal">
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <ul className="mt-3 space-y-1.5">
                {cands.map((c) => (
                  <li key={c.courseId} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <span className="font-medium text-navy">{c.courseName}</span>
                    <span className="text-xs text-slate-500">{c.time}</span>
                    {c.needsCover ? <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-semibold text-amber">needs cover{c.required ? ` · ${c.assigned}/${c.required}` : ""}</span> : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">covered</span>}
                    <button type="button" onClick={() => assign(c.courseId)} disabled={pending || !role} className="ml-auto rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
                      {pending ? "…" : "Assign"}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : cands ? (
            <p className="mt-2 text-sm text-slate-500">No sessions {sel.dayLabel} {sel.slot} that {sel.name} can be assigned to (nothing scheduled they can teach, or they&apos;re already on them). Create the course in <a href="/office/courses" className="text-teal hover:underline">Courses</a> first.</p>
          ) : null}

          {msg ? <p className={`mt-3 text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
