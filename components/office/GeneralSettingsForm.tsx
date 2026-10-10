"use client";

import { useActionState, useState } from "react";
import { updateSettingsAction, type ActionState } from "@/app/(app)/office/settings/actions";
import { ConfirmDialog } from "./ConfirmDialog";

const initial: ActionState = { ok: false };

/** One card of settings with its own Save button: only this card's fields are sent and written. */
function SectionForm({ section, title, aside, className = "", children }: { section: string; title?: string; aside?: React.ReactNode; className?: string; children: React.ReactNode }) {
  const [state, action, pending] = useActionState(updateSettingsAction, initial);
  return (
    <form action={action} className={`rounded-lg border border-slate-200 p-3 ${className}`}>
      <input type="hidden" name="section" value={section} />
      {title ? <div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold text-slate-500">{title}</p>{aside}</div> : null}
      {children}
      <div className="mt-3 flex items-center gap-3">
        <button disabled={pending} className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
        {state.error ? <span className="text-xs text-port">{state.error}</span> : null}
        {state.ok ? <span className="text-xs text-starboard">{state.message}</span> : null}
      </div>
    </form>
  );
}

export function GeneralSettingsForm({
  schedulingMode,
  alertLeadDays,
  availabilityWeeksAhead = 4,
  staffManagedBy = "staff",
  currency,
  enforceLicenceChecks,
  enforceRatioChecks,
  enforceConflictChecks,
  enforceAvailabilityChecks,
  checkEquipmentQuantities = true,
  useKitRules = false,
  holidayPayPercent = null,
  privacyNoticeUrl = "",
  dailyDigestEnabled = false,
  dailyDigestHour = 6,
  idleTimeoutMinutes = 30,
}: {
  schedulingMode: string;
  alertLeadDays: number;
  availabilityWeeksAhead?: number;
  staffManagedBy?: "staff" | "office";
  currency: string;
  enforceLicenceChecks: boolean;
  enforceRatioChecks: boolean;
  enforceConflictChecks: boolean;
  enforceAvailabilityChecks: boolean;
  checkEquipmentQuantities?: boolean;
  useKitRules?: boolean;
  holidayPayPercent?: number | null;
  privacyNoticeUrl?: string;
  dailyDigestEnabled?: boolean;
  dailyDigestHour?: number;
  idleTimeoutMinutes?: number;
}) {
  const [checks, setChecks] = useState({ licence: enforceLicenceChecks, ratio: enforceRatioChecks, conflict: enforceConflictChecks, availability: enforceAvailabilityChecks });
  const [askOff, setAskOff] = useState<null | keyof typeof checks>(null);
  const CHECK_TEXT: Record<keyof typeof checks, { title: string; consequences: string[] }> = {
    licence: { title: "Stop blocking people with a missing or expired must-have cert?", consequences: ["Anyone can be rostered whatever their DBS, first aid or other must-have checks say.", "Expiry still shows on the Instructors tab, but nothing stops an assignment.", "The problems list will no longer flag it either."] },
    conflict: { title: "Stop checking for double-bookings?", consequences: ["The same person can be put on two courses at the same time without a warning.", "The problems list stops flagging clashes created by moving sessions.", "Recorded in the change log."] },
    availability: { title: "Stop checking availability when rostering?", consequences: ["People marked Busy, on approved leave, or who never answered can be rostered without a warning.", "The problems list stops flagging rostered-while-Busy.", "Instructors still see and set availability; the office just isn't stopped by it."] },
    ratio: { title: "Stop flagging short-staffed courses and missing safety cover?", consequences: ["Courses no longer show Covered / Under-staffed / No safety cover.", "The Today strip and the problems list stop counting uncovered sessions.", "Ratios are still stored on each course type for when you switch it back on."] },
  };
  const toggle = (k: keyof typeof checks, on: boolean) => { if (!on && checks[k]) setAskOff(k); else setChecks((c) => ({ ...c, [k]: on })); };

  return (
    <div className="space-y-3">
      <SectionForm section="basics">
      <div className="grid gap-3 sm:grid-cols-4 sm:items-end">
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-500">Warn me this many days before a cert or check expires</label>
        <input name="alertLeadDays" type="number" defaultValue={alertLeadDays} min={0} max={365} className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal" />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-500">Holiday pay shown on payroll (% of pay; blank = off)</label>
        <input name="holidayPayPercent" type="number" step={0.01} min={0} max={50} defaultValue={holidayPayPercent ?? ""} placeholder="e.g. 12.07" className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal" />
        <p className="mt-1 text-[11px] text-slate-400">Rolled-up holiday pay for casual workers (UK: 12.07%). Shown as its own column and total for employed and freelance staff; never for volunteers. Check the rule for your staff with your payroll provider.</p>
      </div>
      <fieldset id="staff-managed-by" className="sm:col-span-4 rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-xs font-medium text-slate-500">Who keeps staff availability up to date?</legend>
        <label className="flex items-start gap-2 py-1 text-sm text-navy">
          <input type="radio" name="staffManagedBy" value="staff" defaultChecked={staffManagedBy !== "office"} className="mt-1" />
          <span><span className="font-medium">Each instructor, in the app.</span> <span className="text-slate-500">They sign up, mark when they&rsquo;re free and confirm their sessions. A slot counts as Busy until they answer.</span></span>
        </label>
        <label className="flex items-start gap-2 py-1 text-sm text-navy">
          <input type="radio" name="staffManagedBy" value="office" defaultChecked={staffManagedBy === "office"} className="mt-1" />
          <span><span className="font-medium">The office. Staff don&rsquo;t need to sign up.</span> <span className="text-slate-500">Everyone counts as free unless you mark them busy, nobody is asked to confirm, and published rosters go out by email. You can still invite anyone to the app.</span></span>
        </label>
        <p className="mt-1 text-[11px] text-slate-400">You can choose differently for one person on their page in Staff. <a href="/learn?topic=office-managed" target="_blank" rel="noreferrer" className="text-teal hover:underline">📖 Read the guide</a></p>
      </fieldset>
      <div id="availability-window" className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-500">Ask instructors for availability this many weeks ahead</label>
        <input name="availabilityWeeksAhead" type="number" defaultValue={availabilityWeeksAhead} min={1} max={26} className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal" />
        <p className="mt-1 text-[11px] text-slate-400">For instructors who keep their own availability: inside this window a slot counts as Busy until they mark it Free or Maybe. Beyond it nobody has been asked yet, so nothing blocks.</p>
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
      </div>
      </SectionForm>
      <SectionForm section="digest" title="If the platform is ever down">
        <label className="flex items-start gap-2 text-sm text-slate-600">
          <input type="checkbox" name="dailyDigestEnabled" defaultChecked={dailyDigestEnabled} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
          <span>Email every admin the day&rsquo;s roster each morning at
            <select name="dailyDigestHour" defaultValue={String(dailyDigestHour)} className="mx-1 rounded border border-slate-300 px-1 py-0.5 text-sm">
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
            </select>
            UK time, so you always have today&rsquo;s plan in your inbox. <span className="text-slate-400">Recommended in season.</span></span>
        </label>
        <p className="mt-2 text-xs text-slate-400">The <a href="/office/rota/emergency" className="text-teal hover:underline">emergency sheet</a> (today&rsquo;s staff with emergency contacts) is always one click away from the roster and prints to PDF.</p>
      </SectionForm>
      <SectionForm section="security" title="Security">
        <label className="block text-sm text-slate-600">
          <span className="mb-1 block text-xs font-medium text-slate-500">Ask admins for their PIN after this long without activity</span>
          <select name="idleTimeoutMinutes" defaultValue={String(idleTimeoutMinutes)} className="w-full max-w-xs rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal">
            {[5, 10, 15, 30, 60, 120, 240].map((m) => <option key={m} value={m}>{m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? "" : "s"}`}</option>)}
          </select>
        </label>
        <p className="mt-1 text-xs text-slate-400">30 minutes suits a shared office computer; shorter for a front desk the public can see. Takes effect the next time each admin enters their PIN. Full sign-in is always required again after 12 hours away.</p>
      </SectionForm>
      <SectionForm section="checks" title="Checks when rostering">
        <p className="mb-2 text-xs text-slate-400">
          Cert expiry is always shown on the Instructors tab. These decide what the Courses tab stops you doing as you roster
          (you can always override).
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" name="enforceLicenceChecks" checked={checks.licence} onChange={(e) => toggle("licence", e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
            <span>Block rostering an instructor with a missing or expired must-have cert or check <span className="text-slate-400">(override allowed)</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" name="enforceRatioChecks" checked={checks.ratio} onChange={(e) => toggle("ratio", e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
            <span>Flag courses that are short of instructors or safety-boat cover</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" name="enforceConflictChecks" checked={checks.conflict} onChange={(e) => toggle("conflict", e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
            <span>Stop an instructor being double-booked <span className="text-slate-400">(override allowed)</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" name="enforceAvailabilityChecks" checked={checks.availability} onChange={(e) => toggle("availability", e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
            <span>Don&apos;t roster someone who is <strong>Busy</strong> for that slot, including anyone who hasn&apos;t marked it Free yet <span className="text-slate-400">(on by default; override allowed)</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" name="checkEquipmentQuantities" defaultChecked={checkEquipmentQuantities} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
            <span>Flag a day when the courses running need more of an equipment type than you own <span className="text-slate-400">(uses the quantity on each equipment type; on by default)</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" name="useKitRules" defaultChecked={useKitRules} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
            <span>Use kit rules: a new course gets its equipment from its course type&apos;s kit rules (for example one Pico per two students) <span className="text-slate-400">(set the rules under Course setup; off by default)</span> <a href="/learn?topic=equipment" target="_blank" rel="noreferrer" className="text-teal hover:underline">📖 Guide</a></span>
          </label>
        </div>
      </SectionForm>

      <ConfirmDialog open={askOff !== null} title={askOff ? CHECK_TEXT[askOff].title : ""} consequences={askOff ? CHECK_TEXT[askOff].consequences : []} confirmLabel="Switch it off" onCancel={() => setAskOff(null)} onConfirm={() => { if (askOff) setChecks((c) => ({ ...c, [askOff]: false })); setAskOff(null); }} />
      <p className="text-[11px] text-slate-400">Each card saves on its own, so two people changing different cards never undo each other.</p>
    </div>
  );
}
