"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignableForCellAction, assignFromAvailabilityAction, type CellCandidate } from "@/app/(app)/office/availability/actions";

export interface MatrixRow { instructorId: string; name: string; cells: Record<string, string>; assigned: Record<string, string[]> }

const SLOTS = ["AM", "PM", "EV"] as const;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CELL: Record<string, { label: string; word: string; cls: string }> = {
  available: { label: "✓", word: "Free", cls: "bg-starboard/15 text-starboard hover:bg-starboard/25" },
  tentative: { label: "~", word: "Maybe", cls: "bg-amber/15 text-amber hover:bg-amber/25" },
  unavailable: { label: "✕", word: "Busy", cls: "bg-port/15 text-port hover:bg-port/25" },
  none: { label: "·", word: "Not set", cls: "bg-slate-50 text-slate-300 hover:bg-slate-100" },
};

interface Selected { instructorId: string; name: string; date: string; slot: string; dayLabel: string }

export function AvailabilityMatrix({ days, rows, availableCounts }: { days: string[]; rows: MatrixRow[]; availableCounts: Record<string, number> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
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

  return (
    <div>
      <div className="overflow-x-auto rounded-card border border-slate-200 bg-white">
        <table className="border-collapse text-center text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600">
              <th rowSpan={3} className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-4 text-left text-sm font-semibold">Instructor</th>
              {DAY_LABELS.map((d, i) => (
                <th key={d} colSpan={3} className="border-l border-slate-200 px-1 py-2 text-sm font-bold text-navy">{d} <span className="font-normal text-slate-400">{days[i]?.slice(8)}</span></th>
              ))}
            </tr>
            <tr className="bg-slate-50 text-xs text-slate-400">
              {days.map((_, di) => SLOTS.map((s, si) => (
                <th key={`${di}-${s}`} className={`w-12 px-1 py-1 font-semibold ${si === 0 ? "border-l border-slate-200" : ""}`}>{s}</th>
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
                <td className="sticky left-0 z-10 whitespace-nowrap border-r border-slate-200 bg-white px-4 py-1.5 text-left text-sm font-semibold text-navy">{r.name}</td>
                {days.map((d, di) => SLOTS.map((s, si) => {
                  const status = r.cells[`${d}|${s}`] ?? "none";
                  const cfg = CELL[status] ?? CELL.none;
                  const rostered = r.assigned[`${d}|${s}`];
                  const rosterLabel = rostered?.length ? `Rostered: ${rostered.join(" · ")}` : "";
                  const isSel = sel?.instructorId === r.instructorId && sel?.date === d && sel?.slot === s;
                  const cellLabel = `${r.name}, ${DAY_LABELS[di]} ${s}: ${cfg!.word}${rosterLabel ? ` · ${rosterLabel}` : ""} — click to fill a shift`;
                  return (
                    <td key={`${r.instructorId}-${di}-${s}`} className={`p-0 ${si === 0 ? "border-l border-slate-200" : ""}`}>
                      <button
                        type="button"
                        onClick={() => openCell(r.instructorId, r.name, d, s, `${DAY_LABELS[di]} ${days[di]?.slice(8) ?? ""}`)}
                        title={cellLabel}
                        aria-label={cellLabel}
                        className={`relative flex h-10 w-12 items-center justify-center text-base font-semibold transition ${cfg!.cls} ${isSel ? "ring-2 ring-inset ring-navy" : ""}`}
                      >
                        <span aria-hidden="true">{cfg!.label}</span>
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

      {/* Fill-a-shift panel */}
      {sel ? (
        <div className="mt-4 rounded-card border border-navy/20 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-navy">
              Fill a shift — <span className="text-teal">{sel.name}</span>, {sel.dayLabel} {sel.slot}
            </p>
            <button type="button" onClick={() => { setSel(null); setCands(null); setMsg(null); }} className="text-sm text-slate-400 hover:text-navy">✕ Close</button>
          </div>

          {pending && cands === null ? (
            <p className="mt-3 text-sm text-slate-400">Finding sessions they can cover…</p>
          ) : cands && cands.length > 0 ? (
            <>
              <div className="mt-3 flex items-center gap-2">
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
            <p className="mt-3 text-sm text-slate-500">No sessions {sel.dayLabel} {sel.slot} that {sel.name} can be assigned to (nothing scheduled they can teach, or they&apos;re already on them). Create the course in <a href="/office/courses" className="text-teal hover:underline">Courses</a> first.</p>
          ) : null}

          {msg ? <p className={`mt-3 text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
