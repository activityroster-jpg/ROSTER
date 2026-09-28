"use client";

import { useActionState } from "react";
import { createInstructorAction, type ActionState } from "@/app/(app)/office/staff/actions";

const initial: ActionState = { ok: false };

export interface QualChoice { id: string; name: string }

export function AddInstructorForm({ quals }: { quals: QualChoice[] }) {
  const [state, action, pending] = useActionState(createInstructorAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Name</label>
          <input name="name" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
          <input name="email" type="email" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Employment</label>
          <select name="employmentType" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal">
            <option value="employed">Employed</option>
            <option value="freelance">Freelance</option>
            <option value="volunteer">Volunteer</option>
          </select>
        </div>
      </div>

      {quals.length > 0 ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Qualifications / instructor type they hold</label>
          <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            {quals.map((q) => (
              <label key={q.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="qual" value={q.id} className="h-4 w-4 rounded border-slate-300 text-teal focus:ring-teal" />
                {q.name}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-400">The courses they&apos;re approved to run are worked out from these against each course&apos;s requirements.</p>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add instructor"}
        </button>
        {state.error ? <p className="text-sm text-port">{state.error}</p> : null}
        {state.ok ? <p className="text-sm text-starboard">Instructor added.</p> : null}
      </div>
    </form>
  );
}
