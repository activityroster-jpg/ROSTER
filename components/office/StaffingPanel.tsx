"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setCourseStaffingAction } from "@/app/(app)/office/courses/actions";
import type { StaffingView } from "@/lib/services/course-resources";

/**
 * The one staffing panel (audit A2-2, option B): students booked, what the
 * ratio implies, and the role lines the admin adjusts. "Staff required" is
 * derived from the lines, never typed.
 */
export function StaffingPanel({ courseId, staffing, compact = false, onSaved }: { courseId: string; staffing: StaffingView; compact?: boolean; onSaved?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [students, setStudents] = useState(String(staffing.students));
  const [lines, setLines] = useState<{ roleTypeId: string; count: number }[]>(staffing.lines.map((l) => ({ roleTypeId: l.roleTypeId, count: l.count })));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const activeRoles = staffing.roles.filter((r) => r.active);
  const unused = activeRoles.filter((r) => !lines.some((l) => l.roleTypeId === r.id));
  const ratioNeeds = Math.max(0, Math.ceil((Number(students) || 0) / Math.max(1, staffing.ratio)));
  const total = lines.reduce((n, l) => n + l.count, 0);
  const dirty = Number(students) !== staffing.students || JSON.stringify(lines) !== JSON.stringify(staffing.lines.map((l) => ({ roleTypeId: l.roleTypeId, count: l.count })));

  const save = () => start(async () => {
    const r = await setCourseStaffingAction({ courseId, students: Number(students) || 0, roles: lines });
    setMsg({ ok: r.ok, text: r.ok ? "Staffing saved" : r.error ?? "Failed" });
    if (r.ok) { router.refresh(); onSaved?.(); }
  });
  const useSuggestion = () => setLines(staffing.suggested.length ? staffing.suggested : lines);
  const setCount = (roleTypeId: string, count: number) => setLines((ls) => ls.map((l) => (l.roleTypeId === roleTypeId ? { ...l, count: Math.max(0, Math.min(50, count)) } : l)).filter((l) => l.count > 0));
  const addRole = (roleTypeId: string) => { if (roleTypeId) setLines((ls) => [...ls, { roleTypeId, count: 1 }]); };
  const nameOf = (id: string) => staffing.roles.find((r) => r.id === id)?.name ?? "Role";
  const field = "rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-teal";

  return (
    <div className={compact ? "rounded-lg bg-slate-50 p-3" : ""}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-slate-500">Students booked
          <input type="number" min={0} max={500} value={students} onChange={(e) => setStudents(e.target.value)} className={`${field} mt-1 block w-24`} />
        </label>
        <p className="pb-1.5 text-xs text-slate-500">
          RYA ratio 1:{Math.max(1, staffing.ratio)} → <span className="font-semibold text-navy">{ratioNeeds} instructor{ratioNeeds === 1 ? "" : "s"}</span>
          {staffing.requiresSafetyBoat ? <> + <span className="font-semibold text-navy">safety cover</span></> : null}
        </p>
        {staffing.suggested.length ? <button type="button" onClick={useSuggestion} className="pb-1.5 text-xs font-medium text-teal hover:underline">Use the suggested roles</button> : null}
      </div>

      <div className="mt-3">
        <p className="mb-1 text-xs font-semibold text-slate-500">Roles needed</p>
        {lines.length === 0 ? (
          <p className="text-xs text-slate-400">No role lines: the ratio alone decides ({staffing.required} needed). Add roles to say who exactly.</p>
        ) : (
          <ul className="space-y-1.5">
            {lines.map((l) => {
              const filled = staffing.lines.find((x) => x.roleTypeId === l.roleTypeId)?.filled ?? 0;
              return (
                <li key={l.roleTypeId} className="flex flex-wrap items-center gap-2 text-sm">
                  <input type="number" min={0} max={50} value={l.count} onChange={(e) => setCount(l.roleTypeId, Number(e.target.value))} aria-label={`${nameOf(l.roleTypeId)} needed`} className={`${field} w-16`} />
                  <span className="text-navy">× {nameOf(l.roleTypeId)}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${filled >= l.count ? "bg-starboard/10 text-starboard" : "bg-slate-100 text-slate-600"}`}>{filled}/{l.count} assigned</span>
                  <button type="button" onClick={() => setCount(l.roleTypeId, 0)} className="text-xs text-slate-400 hover:text-port" aria-label={`Remove ${nameOf(l.roleTypeId)}`}>✕</button>
                </li>
              );
            })}
          </ul>
        )}
        {unused.length ? (
          <select value="" onChange={(e) => addRole(e.target.value)} aria-label="Add a role" className={`${field} mt-2`}>
            <option value="">+ Add a role…</option>
            {unused.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${staffing.assigned >= (total || staffing.required) ? "bg-starboard/15 text-starboard" : "bg-amber/15 text-amber"}`}>
          {staffing.assigned} of {total || staffing.required} staff assigned
        </span>
        {staffing.note && !dirty ? <span className="text-xs text-amber">⚠ {staffing.note}</span> : null}
        {dirty ? <button type="button" onClick={save} disabled={pending} className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : "Save staffing"}</button> : null}
        {msg ? <span className={`text-xs ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</span> : null}
      </div>
    </div>
  );
}
