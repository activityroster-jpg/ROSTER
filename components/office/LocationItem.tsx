"use client";

import { useActionState } from "react";
import { setLocationActiveAction, type ActionState } from "@/app/(app)/office/locations/actions";

const initial: ActionState = { ok: false };

export function LocationItem({ id, name, active }: { id: string; name: string; active: boolean }) {
  const [, action, pending] = useActionState(setLocationActiveAction, initial);
  return (
    <li className="flex items-center justify-between gap-2 py-1">
      <span className={active ? "text-sm text-slate-700" : "text-sm text-slate-400 line-through"}>{name}</span>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="active" value={active ? "false" : "true"} />
        <button disabled={pending} className="text-xs text-slate-400 hover:text-navy disabled:opacity-50">
          {active ? "Deactivate" : "Reactivate"}
        </button>
      </form>
    </li>
  );
}
