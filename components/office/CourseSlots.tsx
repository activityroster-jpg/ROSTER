"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignStaffAction, removeStaffAction } from "@/app/(app)/office/courses/actions";
import { courseStateAvailable, groupCandidates } from "@/lib/domain/assign-order";
import { PeoplePicker } from "./PeoplePicker";
import { AddRolePlace } from "./AddRolePlace";
import type { RoleSlot, SlotPerson } from "@/lib/domain/role-slots";

export interface SlotCandidate { id: string; name: string; fit: boolean; reason?: string; avail?: string; qualified?: boolean | null; /** "Youth Stage 3 (Mon AM)" when they are on another course at the same time. */ busyWith?: string }

/** Why someone sits where they do in the list, in plain words. */
export function candidateNote(c: SlotCandidate): string {
  const bits: string[] = [];
  if (!c.fit) bits.push(c.reason || "not cleared to roster");
  if (c.qualified === false) bits.push("not qualified for this course type");
  if (c.busyWith) bits.push(`on another course: ${c.busyWith}`);
  else if (c.avail === "unavailable") bits.push("said they're busy");
  else if (c.avail === "partial") bits.push("only partly free");
  else if (c.avail === "silent") bits.push("hasn't answered (counts as busy)");
  else if (c.avail === "unset") bits.push("not asked yet");
  else if (c.avail === "available") bits.push("free");
  return bits.join(" · ");
}
export const candidateFactsOf = (c: SlotCandidate) => ({ fit: c.fit, qualified: c.qualified ?? null, available: courseStateAvailable(c.avail) && !c.busyWith });

/** What stands in the way of this person on this course: each line is a block the office can override. Empty = nothing. */
export function issuesOf(c: SlotCandidate | undefined): string[] {
  if (!c) return [];
  const out: string[] = [];
  if (!c.fit) out.push(`Not cleared to roster: ${c.reason ?? "a check isn't met"}.`);
  if (c.qualified === false) out.push("Their licences don't cover this course.");
  if (c.busyWith) out.push(`Already on ${c.busyWith}.`);
  else if (c.avail === "unavailable") out.push("Busy in their availability.");
  else if (c.avail === "silent") out.push("Hasn't answered about availability (counts as busy).");
  return out;
}

/**
 * A course's staffing as two columns: each required place on the left
 * ("Instructor 1", "Safety Boat Driver"), who is in it on the right, with
 * Change / Remove, or the picker when it's empty. The picker lists people in
 * the platform's one order: qualified and free, then qualified but busy, then
 * not qualified or not cleared. Assignments are for the whole course.
 */
export function CourseSlots({ courseId, slots, candidates, roles = [], onChanged }: { courseId: string; slots: RoleSlot[]; candidates: SlotCandidate[]; roles?: { id: string; name: string }[]; onChanged?: () => void }) {
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
  const assign = (instructorId: string, roleTypeId: string, override: boolean, note: string | null, replacing?: SlotPerson) => run(async () => {
    if (replacing) { const r = await removeStaffAction(courseId, replacing.assignmentId); if (!r.ok) return r; }
    const fd = new FormData();
    fd.set("courseId", courseId); fd.set("instructorId", instructorId); fd.set("roleTypeId", roleTypeId);
    if (override) { fd.set("override", "on"); if (note) fd.set("overrideNote", note); }
    return assignStaffAction({ ok: false }, fd);
  });
  const remove = (p: SlotPerson) => run(() => removeStaffAction(courseId, p.assignmentId));

  return (
    <div>
      {slots.length === 0 ? <p className="text-xs text-slate-400">No places to fill yet: set the students booked, or add a role below.</p> : null}
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {slots.map((s) => (
          <SlotRowView key={s.key} slot={s} candidates={free} pending={pending} editing={editing === s.key}
            onEdit={() => setEditing(s.key)} onCancel={() => setEditing(null)} onAssign={assign} onRemove={remove} />
        ))}
      </ul>
      {err ? <p role="alert" className="mt-1.5 text-xs text-port">{err}</p> : null}
      {roles.length ? <AddRolePlace courseId={courseId} roles={roles} onChanged={onChanged} /> : null}
    </div>
  );
}

function SlotRowView({ slot, candidates, pending, editing, onEdit, onCancel, onAssign, onRemove }: {
  slot: RoleSlot; candidates: SlotCandidate[]; pending: boolean; editing: boolean;
  onEdit: () => void; onCancel: () => void; onAssign: (instructorId: string, roleTypeId: string, override: boolean, note: string | null, replacing?: SlotPerson) => void; onRemove: (p: SlotPerson) => void;
}) {
  const [pick, setPick] = useState("");
  const p = slot.person;
  const chosen = candidates.find((c) => c.id === pick);
  const picker = !p || editing;
  // A pick with a block only goes on through "Assign anyway", which records the override and why.
  const issues = picker ? issuesOf(chosen) : [];
  const personIssues = p && !editing ? issuesOf(candidates.find((c) => c.id === p.instructorId)) : [];
  const commit = () => { onAssign(pick, slot.roleTypeId, issues.length > 0, issues.length ? issues.join(" ") : null, editing ? p : undefined); setPick(""); };
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
            {personIssues.length ? <span className="basis-full text-xs text-amber">{personIssues.map((t) => `⚠ ${t}`).join(" ")}</span> : null}
            <span className="ml-auto flex items-center gap-2 text-xs">
              <button type="button" disabled={pending} onClick={onEdit} className="rounded border border-slate-300 px-2 py-0.5 font-medium text-navy hover:bg-slate-50 disabled:opacity-50">Change</button>
              <button type="button" disabled={pending} onClick={() => onRemove(p)} className="text-slate-400 hover:text-port disabled:opacity-50">Remove</button>
            </span>
          </>
        ) : picker ? (
          <>
            <PeoplePicker value={pick} onChange={setPick} ariaLabel={`Who for ${slot.label}`} className="flex-1" placeholder={p ? `Replace ${p.name} with…` : "Choose someone…"}
              groups={groupCandidates(candidates, candidateFactsOf, (c) => c.name).map((g) => ({ tier: g.tier, items: g.items.map((c) => ({ id: c.id, label: c.name, note: candidateNote(c) })) }))} />
            {issues.length ? (
              <button type="button" disabled={pending || !pick} onClick={commit} title="Put them on despite the block; the override and the reason are recorded" className="rounded-lg bg-amber px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber/90 disabled:opacity-50">Assign anyway</button>
            ) : (
              <button type="button" disabled={pending || !pick} onClick={commit} className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">Assign</button>
            )}
            {editing ? <button type="button" onClick={() => { onCancel(); setPick(""); }} className="text-xs text-slate-400 hover:text-navy">Cancel</button> : null}
            {issues.length ? <span className="basis-full text-xs text-port">{issues.join(" ")} <span className="text-slate-500">Press “Assign anyway” to put them on regardless; the override is recorded.</span></span> : null}
          </>
        ) : null}
      </div>
    </li>
  );
}
