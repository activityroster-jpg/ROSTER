"use client";

import { useActionState } from "react";
import { createLocationAction, type ActionState } from "@/app/(app)/office/locations/actions";

const initial: ActionState = { ok: false };

export function AddLocationForm({ types }: { types: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createLocationAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input name="name" placeholder="Location name" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal" />
      <select name="locationTypeId" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal">
        <option value="">Category (optional)…</option>
        {types.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <button disabled={pending} className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
        {pending ? "Adding…" : "Add"}
      </button>
      {state.error ? <span className="w-full text-sm text-port">{state.error}</span> : null}
      {state.ok ? <span className="w-full text-sm text-starboard">{state.message}</span> : null}
    </form>
  );
}
