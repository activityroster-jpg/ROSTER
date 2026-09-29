"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkAssignStaffAction } from "@/app/(app)/office/courses/actions";

interface CourseOpt { id: string; name: string; audience: string; covered: boolean }
interface InstructorOpt { id: string; name: string; fit: boolean; reason?: string }

/** Roster one instructor onto several courses in one go. */
export function BulkAssignForm({
  courses,
  instructors,
  roles,
}: {
  courses: CourseOpt[];
  instructors: InstructorOpt[];
  roles: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [instructorId, setInstructorId] = useState("");
  const [roleTypeId, setRoleTypeId] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [override, setOverride] = useState(false);
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<"all" | "youth" | "adult" | "uncovered">("all");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const shown = useMemo(
    () =>
      courses.filter((c) =>
        filter === "all" ? true : filter === "uncovered" ? !c.covered : c.audience === filter,
      ),
    [courses, filter],
  );

  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allShownPicked = shown.length > 0 && shown.every((c) => picked.has(c.id));
  const toggleAll = () =>
    setPicked((s) => {
      const n = new Set(s);
      if (allShownPicked) shown.forEach((c) => n.delete(c.id));
      else shown.forEach((c) => n.add(c.id));
      return n;
    });

  const submit = () => {
    setMsg(null);
    if (!instructorId || !roleTypeId) { setMsg({ ok: false, text: "Pick an instructor and a role." }); return; }
    if (picked.size === 0) { setMsg({ ok: false, text: "Tick at least one course." }); return; }
    if (override && !note.trim()) { setMsg({ ok: false, text: "Add a reason to override." }); return; }
    start(async () => {
      const res = await bulkAssignStaffAction({ courseIds: [...picked], instructorId, roleTypeId, override, overrideNote: note });
      if (res.ok) {
        setMsg({ ok: true, text: res.message ?? "Done" });
        setPicked(new Set()); setOverride(false); setNote("");
        router.refresh();
      } else setMsg({ ok: false, text: res.error ?? "Could not assign" });
    });
  };

  if (courses.length === 0) return null;

  return (
    <div className="mb-4 rounded-card border border-slate-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 font-semibold text-navy">
          <span className="text-teal">⚡</span> Bulk assign staff
          <span className="text-xs font-normal text-slate-400">Roster one person onto several courses at once</span>
        </span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open ? (
        <div className="border-t border-slate-100 p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <select aria-label="Instructor to assign" value={instructorId} onChange={(e) => setInstructorId(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal">
              <option value="">Instructor…</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>{i.name}{i.fit ? "" : ` — ${i.reason || "not cleared"}`}</option>
              ))}
            </select>
            <select aria-label="Role to assign them in" value={roleTypeId} onChange={(e) => setRoleTypeId(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal">
              <option value="">Role…</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5 text-xs" role="group" aria-label="Filter courses">
              {([["all", "All"], ["youth", "Youth"], ["adult", "Adult"], ["uncovered", "Needs cover"]] as const).map(([k, label]) => (
                <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={`rounded-full px-2.5 py-0.5 font-medium ${filter === k ? "bg-navy text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{label}</button>
              ))}
            </div>
            <button type="button" onClick={toggleAll} className="text-xs font-semibold text-teal hover:underline">{allShownPicked ? "Clear" : "Select all shown"} ({shown.length})</button>
          </div>

          <div className="mt-2 max-h-60 space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-2">
            {shown.length === 0 ? (
              <p className="px-1 py-2 text-xs text-slate-400">No courses match this filter.</p>
            ) : shown.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${c.audience === "youth" ? "bg-amber/15 text-amber" : c.audience === "adult" ? "bg-teal/15 text-teal" : "bg-slate-100 text-slate-500"}`}>{c.audience === "youth" ? "Youth" : c.audience === "adult" ? "Adult" : "All"}</span>
                <span className="text-navy">{c.name}</span>
                {!c.covered ? <span className="ml-auto text-[10px] font-semibold text-amber">needs cover</span> : null}
              </label>
            ))}
          </div>

          <label className="mt-3 flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
            Assign anyway despite missing checks / clashes (records why)
          </label>
          {override ? (
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Override reason (required)" className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal" />
          ) : null}

          <div className="mt-3 flex items-center gap-3">
            <button onClick={submit} disabled={pending} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
              {pending ? "Assigning…" : `Assign to ${picked.size} course${picked.size === 1 ? "" : "s"}`}
            </button>
            {msg ? <span role="status" className={`text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
