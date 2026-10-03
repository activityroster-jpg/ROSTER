"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addParentalPermissionAction, updateProtectedContactsAction } from "@/app/(app)/office/staff/actions";

export interface ProtectedContactsValues { guardianName: string; guardianPhone: string; guardianEmail: string; emergencyName: string; emergencyPhone: string; emergencyRelationship: string }

/** Admin-only: emergency contact for everyone, parent or guardian for under-18s. Stored encrypted; every view is logged. */
export function ProtectedContactsForm({ instructorId, initial, under18, hasPermissionSlot }: { instructorId: string; initial: ProtectedContactsValues; under18: boolean; hasPermissionSlot: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: keyof ProtectedContactsValues) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const field = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal";
  const save = () => start(async () => { const r = await updateProtectedContactsAction(instructorId, v); setMsg(r.ok ? "Saved" : r.error ?? "Could not save"); if (r.ok) { setEdit(false); router.refresh(); } });
  const addSlot = () => start(async () => { const r = await addParentalPermissionAction(instructorId); setMsg(r.ok ? r.message ?? "Added" : r.error ?? "Could not add"); router.refresh(); });
  const missingGuardian = under18 && !initial.guardianName && !initial.guardianPhone;
  const missingEmergency = !initial.emergencyName && !initial.emergencyPhone;

  return (
    <div>
      {missingGuardian ? <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Under 18: add a parent or guardian contact and their written permission to work.</p> : null}
      {missingEmergency && !missingGuardian ? <p className="mb-2 text-xs text-slate-500">No emergency contact yet.</p> : null}
      {edit ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs font-medium text-slate-500">Emergency contact name<input value={v.emergencyName} onChange={set("emergencyName")} className={field} /></label>
          <label className="text-xs font-medium text-slate-500">Emergency contact phone<input value={v.emergencyPhone} onChange={set("emergencyPhone")} className={field} /></label>
          <label className="text-xs font-medium text-slate-500 sm:col-span-2">Relationship<input value={v.emergencyRelationship} onChange={set("emergencyRelationship")} placeholder="parent, partner, friend" className={field} /></label>
          {under18 ? (
            <>
              <label className="text-xs font-medium text-slate-500">Parent / guardian name<input value={v.guardianName} onChange={set("guardianName")} className={field} /></label>
              <label className="text-xs font-medium text-slate-500">Parent / guardian phone<input value={v.guardianPhone} onChange={set("guardianPhone")} className={field} /></label>
              <label className="text-xs font-medium text-slate-500 sm:col-span-2">Parent / guardian email<input type="email" value={v.guardianEmail} onChange={set("guardianEmail")} className={field} /></label>
            </>
          ) : null}
          <div className="flex items-center gap-3 sm:col-span-2">
            <button type="button" onClick={save} disabled={pending} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => { setEdit(false); setV(initial); }} className="text-sm text-slate-500 hover:text-navy">Cancel</button>
          </div>
        </div>
      ) : (
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-slate-500">Emergency contact</dt><dd className="text-navy">{initial.emergencyName || "–"}{initial.emergencyRelationship ? ` (${initial.emergencyRelationship})` : ""}</dd></div>
          <div><dt className="text-xs text-slate-500">Emergency phone</dt><dd className="text-navy">{initial.emergencyPhone || "–"}</dd></div>
          {under18 ? (
            <>
              <div><dt className="text-xs text-slate-500">Parent / guardian</dt><dd className="text-navy">{initial.guardianName || "–"}</dd></div>
              <div><dt className="text-xs text-slate-500">Guardian phone · email</dt><dd className="text-navy">{initial.guardianPhone || "–"}{initial.guardianEmail ? ` · ${initial.guardianEmail}` : ""}</dd></div>
            </>
          ) : null}
        </dl>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!edit ? <button type="button" onClick={() => setEdit(true)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50">Edit contacts</button> : null}
        {under18 && !hasPermissionSlot ? <button type="button" disabled={pending} onClick={addSlot} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">Add parental permission slot</button> : null}
        {msg ? <span className="text-xs text-slate-500">{msg}</span> : null}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">Stored encrypted. Visible to centre admins only; each time this card shows a contact it is written to the change log.</p>
    </div>
  );
}
