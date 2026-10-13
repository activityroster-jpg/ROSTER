"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignStaffAction, removeStaffAction } from "@/app/(app)/office/courses/actions";
import { courseStateAvailable, groupCandidates } from "@/lib/domain/assign-order";
import { PeoplePicker } from "./PeoplePicker";
import { AddRolePlace } from "./AddRolePlace";
import type { RoleSlot, SlotPerson } from "@/lib/domain/role-slots";
import type { PlaceFacts } from "@/lib/domain/teaching";

export interface SlotCandidate {
  id: string; name: string; fit: boolean; reason?: string; avail?: string;
  /** Their instructor types cover this course type; false = they don't; null = nothing on file for them (not judged). */
  qualified?: boolean | null;
  /** The places (role ids) they can fill: their instructor types, or a lower place on the same ladder. Absent = not judged. */
  fills?: string[];
  /** "Youth Stage 3 (Mon AM)" when they are on another course at the same time. */
  busyWith?: string;
}

/** A place on the course, as the checks need it. */
export interface SlotPlace extends PlaceFacts { rank?: number }

/**
 * The candidate's qualification problem in this place, the same two checks as
 * lib/domain/teaching placeFitIssue: a teaching place needs someone whose types
 * cover the course ("course"); an instructor-type place needs that type or a
 * higher one on its ladder ("place"). Nobody is judged with nothing on file.
 */
export function placeIssueOf(c: SlotCandidate, place: PlaceFacts | undefined): "course" | "place" | null {
  if (c.qualified == null) return null;
  if ((!place || place.countsTowardRatio) && c.qualified === false) return "course";
  if (place?.qualificationTypeId && c.fills && !c.fills.includes(place.id)) return "place";
  return null;
}

/** Why someone sits where they do in the list, in plain words. */
export function candidateNote(c: SlotCandidate, place?: PlaceFacts): string {
  const bits: string[] = [];
  const q = placeIssueOf(c, place);
  if (!c.fit) bits.push(c.reason || "not cleared to roster");
  if (q === "course") bits.push("not qualified for this course type");
  else if (q === "place") bits.push(`not a ${place?.name ?? "holder of this type"}`);
  if (c.busyWith) bits.push(`on another course: ${c.busyWith}`);
  else if (c.avail === "unavailable") bits.push("said they're busy");
  else if (c.avail === "partial") bits.push("only partly free");
  else if (c.avail === "silent") bits.push("hasn't answered (counts as busy)");
  else if (c.avail === "unset") bits.push("not asked yet");
  else if (c.avail === "available") bits.push("free");
  return bits.join(" · ");
}
export const candidateFactsOf = (c: SlotCandidate, place?: PlaceFacts) => ({ fit: c.fit, qualified: c.qualified == null ? null : placeIssueOf(c, place) === null, available: courseStateAvailable(c.avail) && !c.busyWith });

/** What stands in the way of this person in this place on this course: each line is a block the office can override. Empty = nothing. */
export function issuesOf(c: SlotCandidate | undefined, place?: PlaceFacts): string[] {
  if (!c) return [];
  const out: string[] = [];
  const q = placeIssueOf(c, place);
  if (!c.fit) out.push(`Not cleared to roster: ${c.reason ?? "a check isn't met"}.`);
  if (q === "course") out.push("Their instructor types don't cover this course.");
  else if (q === "place") out.push(`Not a ${place?.name ?? "holder of this instructor type"} (or higher on that ladder).`);
  if (c.busyWith) out.push(`Already on ${c.busyWith}.`);
  else if (c.avail === "unavailable") out.push("Busy in their availability.");
  else if (c.avail === "silent") out.push("Hasn't answered about availability (counts as busy).");
  return out;
}

/**
 * A course's staffing as two columns: each required place on the left
 * ("Dinghy Instructor 1", "Assistant Instructor"), who is in it on the right,
 * with Change / Remove, or the picker when it's empty. The picker lists people
 * in the platform's one order: qualified and free, then qualified but busy,
 * then not qualified or not cleared. Assignments are for the whole course.
 */
export function CourseSlots({ courseId, slots, candidates, roles = [], relevant, onChanged }: { courseId: string; slots: RoleSlot[]; candidates: SlotCandidate[]; roles?: SlotPlace[]; /** Places whose instructor type teaches this course, for the add-a-place list. */ relevant?: readonly string[]; onChanged?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // slot key being changed
  const onCourse = new Set(slots.map((s) => s.person?.instructorId).filter(Boolean));
  const free = candidates.filter((c) => !onCourse.has(c.id));
  const placeById = new Map(roles.map((r) => [r.id, r]));

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
      {slots.length === 0 ? <p className="text-xs text-slate-400">No places to fill yet: set the students booked, or add a place below.</p> : null}
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {slots.map((s) => (
          <SlotRowView key={s.key} slot={s} candidates={free} everyone={candidates} place={placeById.get(s.roleTypeId)} personPlace={s.person ? placeById.get(s.person.roleTypeId) : undefined} pending={pending} editing={editing === s.key}
            onEdit={() => setEditing(s.key)} onCancel={() => setEditing(null)} onAssign={assign} onRemove={remove} />
        ))}
      </ul>
      {err ? <p role="alert" className="mt-1.5 text-xs text-port">{err}</p> : null}
      {roles.length ? <AddRolePlace courseId={courseId} roles={roles} relevant={relevant} onChanged={onChanged} /> : null}
    </div>
  );
}

function SlotRowView({ slot, candidates, everyone, place, personPlace, pending, editing, onEdit, onCancel, onAssign, onRemove }: {
  slot: RoleSlot; candidates: SlotCandidate[];
  /** Everyone, including people already on the course (to judge the person in this row). */
  everyone: SlotCandidate[];
  /** The place this row is for, and the place the person in it actually holds. */
  place: PlaceFacts | undefined; personPlace: PlaceFacts | undefined;
  pending: boolean; editing: boolean;
  onEdit: () => void; onCancel: () => void; onAssign: (instructorId: string, roleTypeId: string, override: boolean, note: string | null, replacing?: SlotPerson) => void; onRemove: (p: SlotPerson) => void;
}) {
  const [pick, setPick] = useState("");
  const p = slot.person;
  const chosen = candidates.find((c) => c.id === pick);
  const picker = !p || editing;
  // A pick with a block only goes on through "Assign anyway", which records the override and why.
  const issues = picker ? issuesOf(chosen, place) : [];
  const personIssues = p && !editing ? issuesOf(everyone.find((c) => c.id === p.instructorId), personPlace) : [];
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
              groups={groupCandidates(candidates, (c) => candidateFactsOf(c, place), (c) => c.name).map((g) => ({ tier: g.tier, items: g.items.map((c) => ({ id: c.id, label: c.name, note: candidateNote(c, place) })) }))} />
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
