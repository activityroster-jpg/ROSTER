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
  privacyNoticeUrl = "",
}: {
  schedulingMode: string;
  alertLeadDays: number;
  currency: string;
  timezone: string;
  enforceLicenceChecks: boolean;
  enforceRatioChecks: boolean;
  enforceConflictChecks: boolean;
  enforceAvailabilityChecks: boolean;
  privacyNoticeUrl?: string;
}) {
  const [state, action, pending] = useActionState(updateSettingsAction, initial);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4 sm:items-end">
      {/* Kept for the saved record; neither changes anything a centre sees. */}
      <input type="hidden" name="schedulingMode" value={schedulingMode || "session"} />
      <input type="hidden" name="timezone" value={timezone || "Europe/London"} />
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-500">Warn me this many days before a cert or check expires</label>
        <input name="alertLeadDays" type="number" defaultValue={alertLeadDays} min={0} max={365} className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Currency</label>
        <select name="currency" defaultValue={currency || "GBP"} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal">
          <option value="GBP">GBP (£)</option>
          <option value="EUR">EUR (€)</option>
          <option value="USD">USD ($)</option>
        </select>
      </div>
      <div className="sm:col-span-4">
        <label className="mb-1 block text-xs font-medium text-slate-500">Your centre&rsquo;s privacy notice (web address, optional)</label>
        <input name="privacyNoticeUrl" type="url" defaultValue={privacyNoticeUrl} placeholder="https://yourclub.org.uk/privacy" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal" />
        <p className="mt-1 text-xs text-slate-400">Shown to your team beside ActivityRoster&rsquo;s own notice. You are the data controller for your staff&rsquo;s details; we process them for you. Need wording? See the template in the Learning Centre.</p>
      </div>
      <fieldset className="sm:col-span-4 rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-xs font-semibold text-slate-500">Checks when rostering</legend>
        <p className="mb-2 text-xs text-slate-400">
          Cert expiry is always shown on the Instructors tab. These decide what the Courses tab stops you doing as you roster
          (you can always override with a note).
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" name="enforceLicenceChecks" defaultChecked={enforceLicenceChecks} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
            <span>Block rostering an instructor with a missing or expired must-have cert or check <span className="text-slate-400">(override allowed)</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" name="enforceRatioChecks" defaultChecked={enforceRatioChecks} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
            <span>Flag courses that are short of instructors or safety-boat cover</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" name="enforceConflictChecks" defaultChecked={enforceConflictChecks} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
            <span>Stop an instructor being double-booked <span className="text-slate-400">(override allowed)</span></span>
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
