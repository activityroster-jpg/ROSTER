"use client";

import { useActionState, useRef } from "react";
import { createInstructorAction, type ActionState } from "@/app/(app)/office/staff/actions";

const initial: ActionState = { ok: false };

export function AddInstructorForm() {
  const [state, action, pending] = useActionState(createInstructorAction, initial);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4 sm:items-end">
      <div className="sm:col-span-1">
        <label className="mb-1 block text-xs font-medium text-slate-500">Name</label>
        <input name="name" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
      </div>
      <div className="sm:col-span-1">
        <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
        <input name="email" type="email" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
      </div>
      <div className="sm:col-span-1">
        <label className="mb-1 block text-xs font-medium text-slate-500">Employment</label>
        <select name="employmentType" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal">
          <option value="employed">Employed</option>
          <option value="freelance">Freelance</option>
          <option value="volunteer">Volunteer</option>
        </select>
      </div>
      <div className="sm:col-span-1">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add instructor"}
        </button>
      </div>
      {state.error ? <p className="text-sm text-port sm:col-span-4">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-starboard sm:col-span-4">Instructor added.</p> : null}
    </form>
  );
}
