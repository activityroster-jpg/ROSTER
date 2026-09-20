"use client";

import { useActionState } from "react";
import { updateSettingsAction, type ActionState } from "@/app/(app)/office/settings/actions";

const initial: ActionState = { ok: false };

export function GeneralSettingsForm({
  schedulingMode,
  alertLeadDays,
  currency,
  timezone,
}: {
  schedulingMode: string;
  alertLeadDays: number;
  currency: string;
  timezone: string;
}) {
  const [state, action, pending] = useActionState(updateSettingsAction, initial);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4 sm:items-end">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Scheduling mode</label>
        <select name="schedulingMode" defaultValue={schedulingMode} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal">
          <option value="session">Session</option>
          <option value="hours">Hours</option>
          <option value="day">Day</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Alert lead days</label>
        <input name="alertLeadDays" type="number" defaultValue={alertLeadDays} min={0} max={365} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Currency</label>
        <input name="currency" defaultValue={currency} maxLength={3} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm uppercase outline-none focus:border-teal" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Timezone</label>
        <input name="timezone" defaultValue={timezone} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal" />
      </div>
      <div className="sm:col-span-4 flex items-center gap-3">
        <button disabled={pending} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
          {pending ? "Saving…" : "Save settings"}
        </button>
        {state.error ? <span className="text-sm text-port">{state.error}</span> : null}
        {state.ok ? <span className="text-sm text-starboard">{state.message}</span> : null}
      </div>
    </form>
  );
}
