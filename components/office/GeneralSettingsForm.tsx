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

export interface TermDate { from: string; to: string; label?: string }
/** What the centre's jurisdiction gives us: the rule pack in force, or none. */
export interface PackStatus { name: string; version: string; verified: boolean; unverifiedCount: number; source: "builtin" | "edited" }

export function GeneralSettingsForm({
  schedulingMode,
  alertLeadDays,
  availabilityWeeksAhead = 4,
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
  workingTimeMode = "block_override",
  termDates = [],
  requireParentApproval = true,
  packStatus = null,
  idleTimeoutMinutes = 30,
}: {
  schedulingMode: string;
  alertLeadDays: number;
  availabilityWeeksAhead?: number;
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
  workingTimeMode?: string;
  termDates?: TermDate[];
  requireParentApproval?: boolean;
  packStatus?: PackStatus | null;
  idleTimeoutMinutes?: number;
}) {
  const [terms, setTerms] = useState<TermDate[]>(termDates);
  const [checks, setChecks] = useState({ licence: enforceLicenceChecks, ratio: enforceRatioChecks, conflict: enforceConflictChecks, availability: enforceAvailabilityChecks });
  const [askOff, setAskOff] = useState<null | keyof typeof checks>(null);
  const CHECK_TEXT: Record<keyof typeof checks, { title: string; consequences: string[] }> = {
    licence: { title: "Stop blocking people with a missing or expired must-have cert?", consequences: ["Anyone can be rostered whatever their DBS, first aid or other must-have checks say.", "Expiry still shows on the Instructors tab, but nothing stops an assignment.", "The problems list will no longer flag it either."] },
    conflict: { title: "Stop checking for double-bookings?", consequences: ["The same person can be put on two courses at the same time without a warning.", "The problems list stops flagging clashes created by moving sessions.", "Recorded in the change log."] },
    availability: { title: "Stop checking availability when rostering?", consequences: ["People marked Busy, on approved leave, or who never answered can be rostered without a warning.", "The problems list stops flagging rostered-while-Busy.", "Instructors still see and set availability; the office just isn't stopped by it."] },
    ratio: { title: "Stop flagging short-staffed courses and missing safety cover?", consequences: ["Courses no longer show Covered / Under-staffed / No safety cover.", "The Today strip and the problems list stop counting uncovered sessions.", "Ratios are still stored on each course type for when you switch it back on."] },
  };
  const toggle = (k: keyof typeof checks, on: boolean) => { if (!on && checks[k]) setAskOff(k); else setChecks((c) => ({ ...c, [k]: on })); };
  const setTerm = (i: number, patch: Partial<TermDate>) => setTerms((t) => t.map((r, j) => (j === i ? { ...r, ...patch } : r)));

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
      <div id="availability-window" className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-500">Ask instructors for availability this many weeks ahead</label>
        <input name="availabilityWeeksAhead" type="number" defaultValue={availabilityWeeksAhead} min={1} max={26} className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal" />
        <p className="mt-1 text-[11px] text-slate-400">Inside this window a slot counts as Busy until the instructor marks it Free or Maybe. Beyond it nobody has been asked yet, so nothing blocks.</p>
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
      <SectionForm section="young" title="Young workers&rsquo; hours (under-18s)" aside={<a href="/learn?topic=young-workers" target="_blank" rel="noreferrer" className="text-xs font-medium text-teal hover:underline">📖 Read the guide</a>}>
        <input type="hidden" name="termDates" value={JSON.stringify(terms.filter((t) => t.from && t.to))} />
        {packStatus ? (
          <p className="mb-2 text-xs text-slate-500">
            Checks use <strong>{packStatus.name}</strong> (version {packStatus.version}
            {packStatus.source === "edited" ? ", figures edited by ActivityRoster" : ""}).{" "}
            {packStatus.verified
              ? <span className="text-starboard">Every figure in this pack has been verified against the official source.</span>
              : <span className="text-amber-700">{packStatus.unverifiedCount} figure{packStatus.unverifiedCount === 1 ? "" : "s"} in this pack {packStatus.unverifiedCount === 1 ? "is" : "are"} not yet verified against the official source; warnings say so when one applies.</span>}
          </p>
        ) : (
          <p className="mb-2 rounded-lg bg-amber/10 px-2.5 py-1.5 text-xs text-navy">⚠ Young-worker hour checks are <strong>not active</strong> for your centre&rsquo;s jurisdiction yet. Under-18s are still flagged on the Instructors tab; the hour rules below only run once a rule pack exists for your country.</p>
        )}
        <label className="block text-sm text-slate-600">
          <span className="mb-1 block text-xs font-medium text-slate-500">When rostering an under-18 would break their hour, rest or start/finish rules</span>
          <select name="workingTimeMode" defaultValue={workingTimeMode} className="w-full max-w-md rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal">
            <option value="block_override">Block it, but let an admin override with a note (recommended; the override is recorded)</option>
            <option value="block">Block it outright (no override)</option>
            <option value="warn">Warn only (still recorded against the assignment)</option>
          </select>
        </label>
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-slate-500">School term dates</p>
          <p className="mb-2 text-xs text-slate-400">The law caps school-age children far lower in term time than in the holidays. Add this year&rsquo;s terms (your local authority publishes them); any week not listed counts as a school holiday. With no dates at all, every week is treated as term time (the stricter caps).</p>
          <ul className="space-y-1">
            {terms.map((t, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <input type="date" aria-label="Term starts" value={t.from} onChange={(e) => setTerm(i, { from: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
                <span className="text-slate-400">to</span>
                <input type="date" aria-label="Term ends" value={t.to} onChange={(e) => setTerm(i, { to: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
                <input type="text" aria-label="Label" placeholder="e.g. Autumn term" value={t.label ?? ""} onChange={(e) => setTerm(i, { label: e.target.value })} className="w-40 rounded border border-slate-300 px-2 py-1 text-sm" />
                <button type="button" onClick={() => setTerms((x) => x.filter((_, j) => j !== i))} className="text-xs text-port hover:underline">Remove</button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setTerms((x) => [...x, { from: "", to: "", label: "" }])} className="mt-2 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-navy hover:bg-slate-50">+ Add a term</button>
        </div>
        <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" name="requireParentApproval" defaultChecked={requireParentApproval} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
          <span>Needs a parent or guardian&rsquo;s approval before an under-18 can be rostered <span className="block text-xs text-slate-500">When a young person signs up they give a parent&rsquo;s email; the parent approves from their own account. Legally required for under-16s in Ireland; good practice everywhere. An admin can still override with a note.</span></span>
        </label>
        <p className="mt-3 text-[11px] leading-snug text-slate-400">ActivityRoster applies the published working-time rules for your jurisdiction as a planning aid. It is not legal advice: the employer remains responsible for complying with child-employment law, local authority permits and the school-leaving rules that apply to each young person.</p>
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
          (you can always override with a note).
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
