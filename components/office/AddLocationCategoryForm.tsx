"use client";

import { useActionState } from "react";
import { createLocationCategoryAction, type ActionState } from "@/app/(app)/office/locations/actions";

const initial: ActionState = { ok: false };

export function AddLocationCategoryForm() {
  const [state, action, pending] = useActionState(createLocationCategoryAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input name="name" placeholder="New category (e.g. Slipways, Pontoons)" required className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal" />
      <button disabled={pending} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">
        {pending ? "Adding…" : "+ Add category"}
      </button>
      {state.error ? <span className="w-full text-sm text-port">{state.error}</span> : null}
      {state.ok ? <span className="w-full text-sm text-starboard">{state.message}</span> : null}
    </form>
  );
}
