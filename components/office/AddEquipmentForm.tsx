"use client";

import { useActionState } from "react";
import { createEquipmentAction, type ActionState } from "@/app/(app)/office/equipment/actions";

const initial: ActionState = { ok: false };

export function AddEquipmentForm({ types }: { types: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createEquipmentAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <select name="equipmentTypeId" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal">
        <option value="">Type…</option>
        {types.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <input name="name" placeholder="Name" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal" />
      <input name="identifier" placeholder="Identifier (e.g. hull no.)" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal" />
      <button disabled={pending} className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
        {pending ? "Adding…" : "Add"}
      </button>
      {state.error ? <span className="w-full text-sm text-port">{state.error}</span> : null}
      {state.ok ? <span className="w-full text-sm text-starboard">{state.message}</span> : null}
    </form>
  );
}
