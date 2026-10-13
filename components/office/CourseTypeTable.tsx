"use client";

import { askConfirm } from "@/lib/ui/ask-confirm";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addCourseTypeAction,
  deleteCourseTypeAction,
  reactivateCourseTypeAction,
  setCourseTeachersAction,
  updateCourseTypeAction,
  type CourseTypeInput,
} from "@/app/(app)/office/course-setup/actions";
import { schemeDiscipline, type TypeOption } from "@/lib/domain/teaching";
import { CourseTeachersEditor, teacherSummary, type TeacherTick } from "./CourseTeachersEditor";

export interface CourseTypeRow {
  id: string;
  name: string;
  scheme: string | null;
  audience: string;
  defaultCapacity: number;
  studentsPerInstructor: number;
  active: boolean;
  /** Who can teach it: the instructor types linked to it (the course map). */
  teachers: TeacherTick[];
}

const AUDIENCES = [
  { v: "youth", l: "Youth" },
  { v: "adult", l: "Adult" },
  { v: "all", l: "All" },
];

const cell = "rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-teal";

function Row({ row, types, onMsg }: { row: CourseTypeRow; types: TypeOption[]; onMsg: (m: { ok: boolean; text: string }) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editingTeachers, setEditingTeachers] = useState(false);
  const [teachers, setTeachers] = useState<TeacherTick[]>(row.teachers);
  const anyTypes = types.some((t) => t.discipline);
  const [v, setV] = useState<CourseTypeInput>({
    name: row.name,
    scheme: row.scheme ?? "",
    audience: row.audience,
    defaultCapacity: row.defaultCapacity,
    studentsPerInstructor: row.studentsPerInstructor,
  });
  const dirty =
    v.name !== row.name || (v.scheme ?? "") !== (row.scheme ?? "") || v.audience !== row.audience ||
    Number(v.defaultCapacity) !== row.defaultCapacity || Number(v.studentsPerInstructor) !== row.studentsPerInstructor;

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn();
      onMsg({ ok: res.ok, text: res.ok ? res.message ?? "Saved" : res.error ?? "Something went wrong" });
      if (res.ok) router.refresh();
    });

  if (!row.active) {
    return (
      <tr className="bg-slate-50/60 text-slate-400">
        <td className="px-4 py-2 line-through">{row.name}</td>
        <td className="px-4 py-2">{row.scheme ?? "—"}</td>
        <td className="px-4 py-2 capitalize">{row.audience}</td>
        <td className="px-4 py-2">{row.defaultCapacity}</td>
        <td className="px-4 py-2">1:{row.studentsPerInstructor}</td>
        <td className="px-4 py-2 text-xs">{teacherSummary(types, row.teachers) || "—"}</td>
        <td className="px-4 py-2 text-right">
          <span className="mr-2 text-xs">Retired</span>
          <button type="button" disabled={pending} onClick={() => run(() => reactivateCourseTypeAction(row.id))} className="text-xs font-medium text-teal hover:underline">Reactivate</button>
        </td>
      </tr>
    );
  }

  return (
    <>
    <tr>
      <td className="px-4 py-2"><input aria-label="Course type name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={`${cell} w-full min-w-[10rem] font-medium text-navy`} /></td>
      <td className="px-4 py-2"><input aria-label="Scheme" value={v.scheme ?? ""} onChange={(e) => setV({ ...v, scheme: e.target.value })} placeholder="—" className={`${cell} w-full min-w-[8rem]`} /></td>
      <td className="px-4 py-2">
        <select aria-label="Audience" value={v.audience} onChange={(e) => setV({ ...v, audience: e.target.value })} className={cell}>
          {AUDIENCES.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
        </select>
      </td>
      <td className="px-4 py-2"><input aria-label="Capacity" type="number" min={1} value={v.defaultCapacity} onChange={(e) => setV({ ...v, defaultCapacity: e.target.value })} className={`${cell} w-20`} /></td>
      <td className="px-4 py-2">
        <span className="flex items-center gap-1 text-slate-500">1:<input aria-label="Students per instructor" type="number" min={1} value={v.studentsPerInstructor} onChange={(e) => setV({ ...v, studentsPerInstructor: e.target.value })} className={`${cell} w-16`} /></span>
      </td>
      <td className="max-w-[14rem] px-4 py-2">
        <button type="button" onClick={() => setEditingTeachers((x) => !x)} className="text-left text-xs hover:underline" aria-expanded={editingTeachers}>
          {row.teachers.length ? <span className="text-navy">{teacherSummary(types, row.teachers)}</span> : anyTypes ? <span className="font-semibold text-amber">⚠ Pick who can teach it</span> : <span className="text-slate-400">By activity</span>}
          <span className="ml-1 text-teal">{editingTeachers ? "close" : "edit"}</span>
        </button>
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-right">
        {dirty ? (
          <button type="button" disabled={pending} onClick={() => run(() => updateCourseTypeAction(row.id, v))} className="mr-3 rounded bg-teal px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "…" : "Save"}</button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={async () => { if (await askConfirm(`Delete "${row.name}"? If it's used by existing courses it will be retired instead.`)) run(() => deleteCourseTypeAction(row.id)); }}
          className="text-xs text-slate-400 hover:text-port"
        >
          Delete
        </button>
      </td>
    </tr>
    {editingTeachers ? (
      <tr className="bg-slate-50/70">
        <td colSpan={7} className="px-4 py-3">
          <CourseTeachersEditor types={types} value={teachers} onChange={setTeachers} ladder={schemeDiscipline(row.scheme)} courseName={row.name} />
          <div className="mt-2 flex items-center gap-3">
            <button type="button" disabled={pending} onClick={() => run(async () => { const r = await setCourseTeachersAction(row.id, teachers.map((x) => ({ typeId: x.typeId, needsApproval: x.needsApproval }))); if (r.ok) setEditingTeachers(false); return r; })} className="rounded bg-teal px-3 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : "Save who can teach it"}</button>
            <button type="button" onClick={() => { setTeachers(row.teachers); setEditingTeachers(false); }} className="text-xs text-slate-500 hover:text-navy">Cancel</button>
          </div>
        </td>
      </tr>
    ) : null}
    </>
  );
}

/** Editable course-type catalogue: edit fields inline, add, and delete/retire. */
export function CourseTypeTable({ rows, types, schemePlaceholder = "e.g. RYA Youth Sailing" }: { rows: CourseTypeRow[]; types: TypeOption[]; schemePlaceholder?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const blank: CourseTypeInput = { name: "", scheme: "", audience: "all", defaultCapacity: 8, studentsPerInstructor: 6 };
  const [nv, setNv] = useState<CourseTypeInput>(blank);
  const [newTeachers, setNewTeachers] = useState<TeacherTick[]>([]);
  // The centre's own course must say who can teach it (when it has any instructor types).
  const needTeachers = types.some((t) => t.discipline);

  const add = () =>
    start(async () => {
      const res = await addCourseTypeAction({ ...nv, teachers: newTeachers.map((x) => ({ typeId: x.typeId, needsApproval: x.needsApproval })) });
      setMsg({ ok: res.ok, text: res.ok ? res.message ?? "Added" : res.error ?? "Could not add" });
      if (res.ok) { setNv(blank); setNewTeachers([]); router.refresh(); }
    });

  const active = rows.filter((r) => r.active);
  const retired = rows.filter((r) => !r.active);

  return (
    <div>
      <div className="overflow-x-auto rounded-card border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Course type</th>
              <th className="px-4 py-3">Scheme</th>
              <th className="px-4 py-3">Audience</th>
              <th className="px-4 py-3">Capacity</th>
              <th className="px-4 py-3">Ratio</th>
              <th className="px-4 py-3">Who can teach it</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {active.map((r) => <Row key={`${r.id}-${r.active}`} row={r} types={types} onMsg={setMsg} />)}
            <tr className="bg-teal/5">
              <td className="px-4 py-2"><input aria-label="New course type name" value={nv.name} onChange={(e) => setNv({ ...nv, name: e.target.value })} placeholder="Add a course type…" className={`${cell} w-full min-w-[10rem]`} /></td>
              <td className="px-4 py-2"><input aria-label="New scheme" value={nv.scheme ?? ""} onChange={(e) => setNv({ ...nv, scheme: e.target.value })} placeholder={schemePlaceholder} className={`${cell} w-full min-w-[8rem]`} /></td>
              <td className="px-4 py-2">
                <select aria-label="New audience" value={nv.audience} onChange={(e) => setNv({ ...nv, audience: e.target.value })} className={cell}>
                  {AUDIENCES.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
                </select>
              </td>
              <td className="px-4 py-2"><input aria-label="New capacity" type="number" min={1} value={nv.defaultCapacity} onChange={(e) => setNv({ ...nv, defaultCapacity: e.target.value })} className={`${cell} w-20`} /></td>
              <td className="px-4 py-2"><span className="flex items-center gap-1 text-slate-500">1:<input aria-label="New students per instructor" type="number" min={1} value={nv.studentsPerInstructor} onChange={(e) => setNv({ ...nv, studentsPerInstructor: e.target.value })} className={`${cell} w-16`} /></span></td>
              <td className="px-4 py-2 text-xs text-slate-500">{newTeachers.length ? teacherSummary(types, newTeachers) : needTeachers ? "Tick below" : "—"}</td>
              <td className="px-4 py-2 text-right">
                <button type="button" disabled={pending || !nv.name.trim() || (needTeachers && newTeachers.length === 0)} onClick={add} title={needTeachers && newTeachers.length === 0 ? "Tick at least one instructor type who can teach it" : undefined} className="rounded bg-teal px-3 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "…" : "Add"}</button>
              </td>
            </tr>
            {nv.name.trim() && needTeachers ? (
              <tr className="bg-teal/5">
                <td colSpan={7} className="px-4 pb-3">
                  <p className="mb-1 text-xs font-semibold text-navy">Who can teach {nv.name.trim()}? <span className="font-normal text-slate-500">(required)</span></p>
                  <CourseTeachersEditor types={types} value={newTeachers} onChange={setNewTeachers} ladder={schemeDiscipline(nv.scheme ?? null)} courseName={nv.name.trim()} />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {retired.length > 0 ? (
        <details className="mt-3 rounded-card border border-slate-200 bg-white">
          <summary className="cursor-pointer px-4 py-2 text-sm font-semibold text-navy">Retired course types <span className="font-normal text-slate-400">({retired.length}) · old courses still show them</span></summary>
          <table className="w-full min-w-[720px] text-left text-sm"><tbody className="divide-y divide-slate-100 border-t border-slate-100">{retired.map((r) => <Row key={`${r.id}-${r.active}`} row={r} types={types} onMsg={setMsg} />)}</tbody></table>
        </details>
      ) : null}
      {msg ? <p role="status" className={`mt-2 text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</p> : null}
    </div>
  );
}
