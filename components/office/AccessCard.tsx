"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteGuardianAction, revokeGuardianAction, setMemberRoleAction } from "@/app/(app)/office/staff/actions";

export interface GuardianRow { id: string; email: string; status: string; consentGivenAt: string | null; consentNote: string | null; createdAt: string }

/** Staff profile: what this person can do in the centre, and (under-18s) who may see their roster. */
export function AccessCard({ instructorId, linked, role, canChangeRole, under18, guardianEmailOnFile, guardians }: {
  instructorId: string; linked: boolean; role: string | null; canChangeRole: boolean; under18: boolean; guardianEmailOnFile: boolean; guardians: GuardianRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => start(async () => { const r = await fn(); setMsg(r.ok ? r.message ?? "Done" : r.error ?? "Failed"); router.refresh(); });
  const ROLES = [["instructor", "Instructor", "Their own portal: shifts, availability, confirmations, documents."], ["senior_instructor", "Senior instructor", "Also the office roster: courses, assignments, availability grid, leave and cover, publishing. No pay, billing, settings or exports."], ["welfare_officer", "Welfare officer", "Office access to staff profiles, guardian and emergency contacts, the emergency sheet and the young-worker register. Nothing operational or financial."]] as const;
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="font-medium text-navy">Role in this centre</p>
        {!linked ? <p className="text-xs text-slate-500">Invite them to sign in first; a role attaches to their account.</p> : role === "admin" ? <p className="text-xs text-slate-500">Admin: runs the centre. Admins are changed through ActivityRoster support.</p> : canChangeRole ? (
          <div className="mt-1 space-y-1.5">
            {ROLES.map(([value, label, help]) => (
              <label key={value} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 ${role === value ? "border-teal bg-teal/5" : "border-slate-200"}`}>
                <input type="radio" name="role" className="mt-1" checked={role === value} disabled={pending} onChange={() => run(() => setMemberRoleAction(instructorId, value))} />
                <span><span className="font-medium text-navy">{label}</span><span className="block text-xs text-slate-500">{help}</span></span>
              </label>
            ))}
          </div>
        ) : <p className="text-xs text-slate-500">{role ? role.replace(/_/g, " ") : "instructor"}</p>}
      </div>
      {under18 ? (
        <div className="border-t border-slate-100 pt-3">
          <p className="font-medium text-navy">Parent / guardian access</p>
          <p className="text-xs text-slate-500">A parent or guardian can be given a read-only view of this young person&rsquo;s roster (dates, courses, times, places; nothing else and nobody else&rsquo;s details). The invitation goes to the guardian email on this profile, and the consent you record here is kept with it. The plain-English page you can send them is <a href="/privacy/young-people" target="_blank" rel="noreferrer" className="font-medium text-teal hover:underline">activityroster.com/privacy/young-people</a>.</p>
          {guardians.length ? (
            <ul className="mt-2 divide-y divide-slate-100">
              {guardians.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <span>{g.email} <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${g.status === "active" ? "bg-starboard/10 text-starboard" : "bg-slate-100 text-slate-500"}`}>{g.status}</span><span className="block text-xs text-slate-400">{g.consentGivenAt ? `Consent recorded ${new Date(g.consentGivenAt).toLocaleDateString("en-GB")}` : "No consent note"}{g.consentNote ? ` · ${g.consentNote}` : ""}</span></span>
                  {g.status === "active" && canChangeRole ? <button disabled={pending} onClick={() => run(() => revokeGuardianAction(instructorId, g.id))} className="text-xs text-port hover:underline">Remove access</button> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {canChangeRole ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Consent note, e.g. signed permission form on file, 3 Oct" className="w-72 rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
              <button disabled={pending || !guardianEmailOnFile} title={guardianEmailOnFile ? "" : "Add the guardian's email first"} onClick={() => run(() => inviteGuardianAction(instructorId, note))} className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">{guardians.some((g) => g.status === "active") ? "Re-send invitation" : "Invite guardian"}</button>
            </div>
          ) : null}
        </div>
      ) : null}
      {msg ? <p className="text-xs text-navy">{msg}</p> : null}
    </div>
  );
}
