"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addStaffLicenceAction, setTeachableCoursesAction } from "@/app/(app)/office/staff/actions";

/**
 * On a staff member's page: the office adds a licence they hold (then uploads
 * the copy under Licences & documents) and ticks the courses they can teach.
 */
export function StaffLicencesCourses({ instructorId, name, licenceTypes, heldTypeIds, courseTypes, teaches }: {
  instructorId: string;
  name: string;
  licenceTypes: { id: string; name: string }[];
  heldTypeIds: string[];
  courseTypes: { id: string; name: string; group: string }[];
  teaches: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [licence, setLicence] = useState("");
  const [expiry, setExpiry] = useState("");
  const [picked, setPicked] = useState(new Set(teaches));
  const [filter, setFilter] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const held = new Set(heldTypeIds);
  const options = licenceTypes.filter((t) => !held.has(t.id));
  const groups = useMemo(() => {
    const term = filter.trim().toLowerCase();
    const by = new Map<string, { id: string; name: string }[]>();
    for (const c of courseTypes) if (!term || c.name.toLowerCase().includes(term)) by.set(c.group, [...(by.get(c.group) ?? []), c]);
    return [...by];
  }, [courseTypes, filter]);
  const changed = picked.size !== teaches.length || teaches.some((id) => !picked.has(id));

  const addLicence = () => {
    if (!licence) return;
    setMsg(null);
    start(async () => {
      const r = await addStaffLicenceAction({ instructorId, qualificationTypeId: licence, expiryDate: expiry || null });
      setMsg({ ok: r.ok, text: r.ok ? "Licence added. Upload a copy under Licences & documents." : r.error ?? "That didn't save" });
      if (r.ok) { setLicence(""); setExpiry(""); router.refresh(); }
    });
  };
  const saveCourses = () => {
    setMsg(null);
    start(async () => {
      const r = await setTeachableCoursesAction({ instructorId, courseTypeIds: [...picked] });
      setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Saved" : r.error ?? "That didn't save" });
      if (r.ok) router.refresh();
    });
  };
  const field = "rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal";

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-1.5 text-sm font-medium text-navy">Add a licence {name} holds</p>
        {options.length === 0 ? <p className="text-xs text-slate-400">Every licence type on your list is already recorded.</p> : (
          <div className="flex flex-wrap items-end gap-2">
            <select value={licence} onChange={(e) => setLicence(e.target.value)} aria-label="Licence" className={`${field} min-w-[14rem] flex-1`}>
              <option value="">Choose a licence…</option>
              {options.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <label className="text-xs text-slate-500">Expires (optional)<input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={`${field} mt-0.5 block`} /></label>
            <button type="button" disabled={pending || !licence} onClick={addLicence} className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">Add licence</button>
          </div>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-navy">Courses {name} can teach <span className="text-xs font-normal text-slate-400">({picked.size} ticked)</span></p>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a course" aria-label="Find a course" className={`${field} w-44 py-1 text-xs`} />
        </div>
        <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-slate-200 p-3">
          {groups.length === 0 ? <p className="text-xs text-slate-400">No courses match.</p> : groups.map(([group, list]) => (
            <div key={group}>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{group}</p>
              <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                {list.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm text-navy">
                    <input type="checkbox" checked={picked.has(c.id)} onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n; })} />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button type="button" disabled={pending || !changed} onClick={saveCourses} className="mt-2 rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : "Save courses"}</button>
      </div>
      {msg ? <p className={`text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</p> : null}
    </div>
  );
}
