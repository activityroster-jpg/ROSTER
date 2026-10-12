"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignStaffAction, removeStaffAction } from "@/app/(app)/office/courses/actions";
import { TIER_DOT, TIER_LABEL, courseStateAvailable, groupCandidates } from "@/lib/domain/assign-order";
import { courseAvailLabel, type CourseAvailState } from "@/lib/domain/availability";
import type { RoleSlot, SlotPerson } from "@/lib/domain/role-slots";

export interface SlotCandidate { id: string; name: string; fit: boolean; reason?: string; avail?: string; qualified?: boolean | null }

/**
 * A course's staffing as two columns: each required place on the left
 * ("Instructor 1", "Safety Boat Driver"), who is in it on the right, with
 * Change / Remove, or the picker when it's empty. The picker lists people in
 * the platform's one order: qualified and free, then qualified but busy, then
 * not qualified or not cleared. Assignments are for the whole course.
 */
export function CourseSlots({ courseId, slots, candidates, onChanged }: { courseId: string; slots: RoleSlot[]; candidates: SlotCandidate[]; onChanged?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // slot key being changed
  const onCourse = new Set(slots.map((s) => s.person?.instructorId).filter(Boolean));
  const free = candidates.filter((c) => !onCourse.has(c.id));

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setErr(r.error ?? "Something went wrong");
      else { setEditing(null); router.refresh(); onChanged?.(); }
    });
  };
  const assign = (instructorId: string, roleTypeId: string, override: boolean, replacing?: SlotPerson) => run(async () => {
    if (replacing) { const r = await removeStaffAction(courseId, replacing.assignmentId); if (!r.ok) return r; }
    const fd = new FormData();
    fd.set("courseId", courseId); fd.set("instructorId", instructorId); fd.set("roleTypeId", roleTypeId);
    if (override) fd.set("override", "on");
    return assignStaffAction({ ok: false }, fd);
  });
  const remove = (p: SlotPerson) => run(() => removeStaffAction(courseId, p.assignmentId));

  if (slots.length === 0) return <p className="text-xs text-slate-400">No places to fill yet: set the students booked or add a role above.</p>;
  return (
    <div>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {slots.map((s) => (
          <SlotRowView key={s.key} slot={s} candidates={free} pending={pending} editing={editing === s.key}
            onEdit={() => setEditing(s.key)} onCancel={() => setEditing(null)} onAssign={assign} onRemove={remove} />
        ))}
      </ul>
      {err ? <p role="alert" className="mt-1.5 text-xs text-port">{err}</p> : null}
    </div>
  );
}

function SlotRowView({ slot, candidates, pending, editing, onEdit, onCancel, onAssign, onRemove }: {
  slot: RoleSlot; candidates: SlotCandidate[]; pending: boolean; editing: boolean;
  onEdit: () => void; onCancel: () => void; onAssign: (instructorId: string, roleTypeId: string, override: boolean, replacing?: SlotPerson) => void; onRemove: (p: SlotPerson) => void;
}) {
  const [pick, setPick] = useState("");
  const [override, setOverride] = useState(false);
  const p = slot.person;
  const chosen = candidates.find((c) => c.id === pick);
  const picker = !p || editing;
  return (
    <li className="grid gap-2 px-3 py-2 sm:grid-cols-[11rem_1fr] sm:items-center">
      <div className="text-sm font-semibold text-navy">
        {slot.label}
        {slot.extra ? <span className="block text-[10px] font-normal text-slate-400">{p?.status === "declined" ? "declined" : "not required"}</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {p && !editing ? (
          <>
            <span className={`text-sm ${p.status === "declined" ? "text-port line-through" : "text-navy"}`}>{p.name}</span>
            {p.status === "confirmed" ? <span className="rounded bg-starboard/15 px-1.5 py-0.5 text-[10px] font-semibold text-starboard">confirmed</span>
              : p.status === "declined" ? <span className="rounded bg-port/10 px-1.5 py-0.5 text-[10px] font-semibold text-port" title={p.declineNote ?? undefined}>can&apos;t make it</span>
              : <span className="text-[10px] text-slate-400">unconfirmed</span>}
            {p.isOverride ? <span className="text-[10px] font-semibold text-amber" title="Assigned with an override">override</span> : null}
            <span className="ml-auto flex items-center gap-2 text-xs">
              <button type="button" disabled={pending} onClick={onEdit} className="rounded border border-slate-300 px-2 py-0.5 font-medium text-navy hover:bg-slate-50 disabled:opacity-50">Change</button>
              <button type="button" disabled={pending} onClick={() => onRemove(p)} className="text-slate-400 hover:text-port disabled:opacity-50">Remove</button>
            </span>
          </>
        ) : picker ? (
          <>
            <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label={`Who for ${slot.label}`} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal">
              <option value="">{p ? `Replace ${p.name} with…` : "Choose someone…"}</option>
              {groupCandidates(candidates, (c) => ({ fit: c.fit, qualified: c.qualified ?? null, available: courseStateAvailable(c.avail) }), (c) => c.name).map((g) => (
                <optgroup key={g.tier} label={`${TIER_DOT[g.tier]} ${TIER_LABEL[g.tier]}`}>
                  {g.items.map((c) => (
                    <option key={c.id} value={c.id}>{TIER_DOT[g.tier]} {c.name}{c.fit ? "" : ` — ${c.reason || "not cleared"}`}{c.qualified === false ? " — not qualified for this type" : ""}{c.avail && c.avail !== "none" ? ` · ${courseAvailLabel(c.avail as CourseAvailState)}` : ""}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {chosen && (!chosen.fit || chosen.qualified === false || !courseStateAvailable(chosen.avail)) ? (
              <label className="flex items-center gap-1 text-xs text-slate-500" title="Assign even though a check isn't met (recorded)">
                <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} /> override
              </label>
            ) : null}
            <button type="button" disabled={pending || !pick} onClick={() => { onAssign(pick, slot.roleTypeId, override, editing ? p : undefined); setPick(""); setOverride(false); }} className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{p ? "Save" : "Assign"}</button>
            {editing ? <button type="button" onClick={() => { onCancel(); setPick(""); }} className="text-xs text-slate-400 hover:text-navy">Cancel</button> : null}
          </>
        ) : null}
      </div>
    </li>
  );
}
