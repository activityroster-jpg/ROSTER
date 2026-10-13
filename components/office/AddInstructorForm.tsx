"use client";

import { useActionState, useEffect, useState } from "react";
import { setupInstructorAction, type ActionState } from "@/app/(app)/office/staff/actions";
import { MultiSelect } from "@/components/MultiSelect";
import type { TeachingData } from "@/lib/domain/teaching";
import { InstructorTypesEditor, approvalsToSave, type TypesValue } from "./InstructorTypesEditor";

const initial: ActionState = { ok: false };

export interface Choice { id: string; name: string; mandatory?: boolean }

/**
 * Add someone with all their details: who they are, the instructor types they
 * hold (tick every one that applies; the courses they can teach follow from
 * the types), any Principal's approvals, and the checks they need.
 */
export function AddInstructorForm({ teaching, checks }: { teaching: TeachingData; checks: Choice[] }) {
  const [state, action, pending] = useActionState(setupInstructorAction, initial);
  const [types, setTypes] = useState<TypesValue>({ typeIds: new Set(), approvedIds: new Set() });
  const [personName, setPersonName] = useState("");
  const [selChecks, setSelChecks] = useState<Set<string>>(new Set(checks.filter((c) => c.mandatory).map((c) => c.id)));
  // A saved person clears the ticks for the next one.
  useEffect(() => { if (state.ok) { setTypes({ typeIds: new Set(), approvedIds: new Set() }); setPersonName(""); } }, [state]);

  const toggler = (set: React.Dispatch<React.SetStateAction<Set<string>>>) => (id: string) =>
    set((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOf = (opts: { id: string }[], set: React.Dispatch<React.SetStateAction<Set<string>>>) => () => set(new Set(opts.map((o) => o.id)));
  const clear = (set: React.Dispatch<React.SetStateAction<Set<string>>>) => () => set(new Set());

  const Field = ({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-sm font-semibold text-navy">{title}</label>
      <p className="mb-1.5 text-xs text-slate-500">{hint}</p>
      {children}
    </div>
  );

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-navy">Full name</label>
          <input name="name" required value={personName} onChange={(e) => setPersonName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-navy">Email</label>
          <input name="email" type="email" placeholder="so we can send their invite" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-navy">Date of birth</label>
          <input name="dateOfBirth" type="date" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
          <p className="mt-1 text-[11px] text-slate-400">Needed for under-18 privacy protections.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-navy">Employment</label>
          <select name="employmentType" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal">
            <option value="employed">Employed</option><option value="freelance">Freelance</option><option value="volunteer">Volunteer</option>
          </select>
        </div>
      </div>

      <InstructorTypesEditor data={teaching} value={types} onChange={setTypes} personName={personName.split(" ")[0]} compact />

      <Field title="Background checks they need" hint="DBS, first aid, safeguarding — the mandatory ones are already ticked.">
        <MultiSelect placeholder="Select checks…" options={checks} selected={selChecks} onToggle={toggler(setSelChecks)} onSelectAll={allOf(checks, setSelChecks)} onClear={clear(setSelChecks)} />
      </Field>

      {approvalsToSave(teaching, types).map((id) => <input key={`c${id}`} type="hidden" name="course" value={id} />)}
      {[...types.typeIds].map((id) => <input key={`q${id}`} type="hidden" name="qual" value={id} />)}
      {[...selChecks].map((id) => <input key={`k${id}`} type="hidden" name="check" value={id} />)}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
          {pending ? "Saving…" : "Save & send invite"}
        </button>
        {state.error ? <p className="text-sm text-port">{state.error}</p> : null}
        {state.ok ? <p className="text-sm text-starboard">{state.message}</p> : null}
      </div>
      <p className="text-xs text-slate-400">Saving emails the instructor a link to set up their account and upload a photo of each licence. You can also upload documents for them from their page.</p>
    </form>
  );
}
