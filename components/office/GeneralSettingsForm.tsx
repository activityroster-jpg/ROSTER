"use client";

import { useActionState } from "react";
import { updateSettingsAction, type ActionState } from "@/app/(app)/office/settings/actions";

const initial: ActionState = { ok: false };

export function GeneralSettingsForm({
  schedulingMode,
  alertLeadDays,
  currency,
  timezone,
  enforceLicenceChecks,
  enforceRatioChecks,
  enforceConflictChecks,
  enforceAvailabilityChecks,
}: {
  schedulingMode: string;
  alertLeadDays: number;
  currency: string;
  timezone: string;
  enforceLicenceChecks: boolean;
  enforceRatioChecks: boolean;
  enforceConflictChecks: boolean;
  enforceAvailabilityChecks: boolean;
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
        <select name="currency" defaultValue={currency || "GBP"} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal">
          <option value="GBP">GBP (£)</option>
          <option value="EUR">EUR (€)</option>
          <option value="USD">USD ($)</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Timezone</label>
        <input name="timezone" defaultValue={timezone} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal" />
      </div>
      <fieldset className="sm:col-span-4 rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-xs font-semibold text-slate-500">Optional compliance checks</legend>
        <p className="mb-2 text-xs text-slate-400">
          Off by default to keep things simple. Licence expiry is always shown on the Staff tab. Turn these on to have
          the Courses tab enforce them as you roster.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" name="enforceLicenceChecks" defaultChecked={enforceLicenceChecks} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
            <span>Block rostering an instructor with a missing/expired mandatory licence <span className="text-slate-400">(override allowed)</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" name="enforceRatioChecks" defaultChecked={enforceRatioChecks} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
            <span>Show ratio &amp; safety-cover flags on courses</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" name="enforceConflictChecks" defaultChecked={enforceConflictChecks} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
            <span>Warn when an instructor is double-booked <span className="text-slate-400">(override allowed)</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" name="enforceAvailabilityChecks" defaultChecked={enforceAvailabilityChecks} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
            <span>Don&apos;t roster someone who marked that slot <strong>Busy</strong> <span className="text-slate-400">(on by default; override allowed)</span></span>
          </label>
        </div>
      </fieldset>

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
