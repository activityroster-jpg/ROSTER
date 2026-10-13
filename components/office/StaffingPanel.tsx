"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { setCourseStaffingAction } from "@/app/(app)/office/courses/actions";
import type { StaffingView } from "@/lib/services/course-resources";
import { SurplusPicker, type SurplusGroup } from "./SurplusPicker";
import { PlaceSelect } from "./PlaceSelect";

/**
 * The one staffing panel (audit A2-2, option B): students booked, what the
 * ratio implies, and the places (instructor types) the admin adjusts. "Staff
 * required" is derived from the lines, never typed. The add-a-place list
 * shows the types that teach this course first, with "Other…" for the rest.
 */
export function StaffingPanel({ courseId, staffing, compact = false, notes, onSaved }: { courseId: string; staffing: StaffingView; compact?: boolean; /** Problems to show beside names when choosing who comes off (double-booked, licences), by instructor id. */ notes?: Record<string, string>; onSaved?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [students, setStudents] = useState(String(staffing.students));
  const [lines, setLines] = useState<{ roleTypeId: string; count: number }[]>(staffing.lines.map((l) => ({ roleTypeId: l.roleTypeId, count: l.count })));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // The course's last-changed time: a save is refused if someone else changed it since (lib/services/concurrency).
  const [version, setVersion] = useState<number | null>(staffing.version ?? null);
  useEffect(() => { setVersion(staffing.version ?? null); }, [staffing.version]);

  const activeRoles = staffing.roles.filter((r) => r.active);
  const unused = activeRoles.filter((r) => !lines.some((l) => l.roleTypeId === r.id));
  const ratioNeeds = Math.max(0, Math.ceil((Number(students) || 0) / Math.max(1, staffing.ratio)));
  const total = lines.reduce((n, l) => n + l.count, 0);
  const dirty = Number(students) !== staffing.students || JSON.stringify(lines) !== JSON.stringify(staffing.lines.map((l) => ({ roleTypeId: l.roleTypeId, count: l.count })));

  const [confirming, setConfirming] = useState(false);
  // Fewer places than people in a role (removed, or its count lowered): the office picks who comes off.
  const surplus: SurplusGroup[] = staffing.lines
    .map((l) => ({ roleName: l.roleName, people: l.people.map((p) => ({ ...p, note: notes?.[p.instructorId] })), surplus: l.people.length - (lines.find((x) => x.roleTypeId === l.roleTypeId)?.count ?? 0) }))
    .filter((g) => g.surplus > 0);
  const save = (remove?: string[]) => start(async () => {
    setConfirming(false);
    const r = await setCourseStaffingAction({ courseId, students: Number(students) || 0, roles: lines, remove, expectedVersion: version });
    setMsg({ ok: r.ok, text: r.ok ? (r.message && r.message !== "Saved" ? r.message : "Staffing saved") : r.error ?? "Failed" });
    if (r.ok) { if (r.version) setVersion(r.version); router.refresh(); onSaved?.(); }
  });
  const askSave = () => (surplus.length ? setConfirming(true) : save([]));
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
          Ratio 1:{Math.max(1, staffing.ratio)} → <span className="font-semibold text-navy">{ratioNeeds} instructor{ratioNeeds === 1 ? "" : "s"}</span>
          {staffing.requiresSafetyBoat ? <> + <span className="font-semibold text-navy">safety cover</span></> : null}
        </p>
        {staffing.suggested.length ? <button type="button" onClick={useSuggestion} className="pb-1.5 text-xs font-medium text-teal hover:underline">Use the suggested places</button> : null}
      </div>

      <div className="mt-3">
        <p className="mb-1 text-xs font-semibold text-slate-500">Places needed (instructor types)</p>
        {lines.length === 0 ? (
          <p className="text-xs text-slate-400">No places listed: the ratio alone decides ({staffing.required} needed, in the course&apos;s lead instructor type). Add places to say exactly who.</p>
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
          <PlaceSelect value="" onChange={addRole} places={unused.map((r) => ({ id: r.id, name: r.name, rank: r.rank, qualificationTypeId: r.qualificationTypeId ?? null }))} relevant={staffing.relevantRoleIds.filter((id) => unused.some((r) => r.id === id))} ariaLabel="Add a place" placeholder="+ Add a place…" className={`${field} mt-2`} />
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${staffing.assigned >= (total || staffing.required) ? "bg-starboard/15 text-starboard" : "bg-amber/15 text-amber"}`}>
          {staffing.assigned} of {total || staffing.required} staff assigned
        </span>
        {staffing.note && !dirty ? <span className="text-xs text-amber">⚠ {staffing.note}</span> : null}
        {dirty ? <button type="button" onClick={askSave} disabled={pending} className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : "Save staffing"}</button> : null}
        {msg ? <span className={`text-xs ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</span> : null}
      </div>
      <SurplusPicker open={confirming} groups={surplus} busy={pending} onCancel={() => setConfirming(false)} onConfirm={(ids) => save(ids)} />
    </div>
  );
}
