"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteCourseAction, renameCourseAction, setCourseStatusAction, setCourseStudentsAction } from "@/app/(app)/office/courses/actions";

const STATUSES = ["draft", "scheduled", "confirmed", "completed", "cancelled"];

export function CourseManage({ id, name, status, students }: { id: string; name: string; status: string; students: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [nm, setNm] = useState(name);
  const [st, setSt] = useState(String(students));

  const rename = () => start(async () => { const r = await renameCourseAction(id, nm); setMsg(r.ok ? "Saved" : r.error ?? "Failed"); router.refresh(); });
  const saveStudents = () => start(async () => { const r = await setCourseStudentsAction(id, Number(st)); setMsg(r.ok ? "Saved" : r.error ?? "Failed"); router.refresh(); });
  const setStatus = (s: string) => start(async () => { await setCourseStatusAction(id, s); router.refresh(); });
  const del = () => { if (!confirm("Delete this course and all its sessions? This can't be undone.")) return; start(async () => { const r = await deleteCourseAction(id); if (r.ok) router.push("/office/courses"); else setMsg(r.error ?? "Failed"); }); };

  const field = "rounded-lg border border-slate-300 px-3 py-2 text-sm";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-semibold text-slate-500">Course name
        <div className="mt-1 flex gap-2">
          <input value={nm} onChange={(e) => setNm(e.target.value)} className={`w-full ${field}`} />
          <button onClick={rename} disabled={pending} className="rounded-lg border border-slate-300 px-3 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">Save</button>
        </div>
      </label>
      <label className="text-xs font-semibold text-slate-500">Status
        <select defaultValue={status} onChange={(e) => setStatus(e.target.value)} disabled={pending} className={`mt-1 block w-full capitalize ${field}`}>
          {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-500">Students booked
        <div className="mt-1 flex gap-2">
          <input type="number" min={1} max={500} value={st} onChange={(e) => setSt(e.target.value)} className={`w-full ${field}`} />
          <button onClick={saveStudents} disabled={pending || Number(st) === students} className="rounded-lg border border-slate-300 px-3 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">Save</button>
        </div>
        <span className="mt-1 block font-normal text-slate-400">Used for the instructor-to-student ratio check.</span>
      </label>
      <div className="sm:col-span-2 flex items-center justify-between">
        {msg ? <span className="text-sm text-slate-500">{msg}</span> : <span />}
        <button onClick={del} disabled={pending} className="rounded-lg border border-port/40 px-4 py-2 text-sm font-semibold text-port hover:bg-port/5 disabled:opacity-50">Delete course</button>
      </div>
    </div>
  );
}
