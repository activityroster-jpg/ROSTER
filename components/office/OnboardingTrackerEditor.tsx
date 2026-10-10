"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MAX_CUSTOM_STEPS, MAX_STEP_LABEL, TRACKER_STEPS, cleanCustomSteps, type TrackerConfig, type TrackerStepKey } from "@/lib/domain/onboarding-tracker";
import { saveOnboardingTrackerAction } from "@/app/(app)/office/settings/actions";

/**
 * Choose the instructor onboarding tracker: on or off, which built-in steps,
 * and the centre's own. Controlled, so the setup wizard can save it with its
 * Continue button; Settings wraps it with a Save button (OnboardingTrackerForm).
 */
export function OnboardingTrackerEditor({ value, onChange, payOn }: { value: TrackerConfig; onChange: (next: TrackerConfig) => void; payOn: boolean }) {
  const [draft, setDraft] = useState("");
  const chosen = new Set(value.steps);
  const toggle = (key: TrackerStepKey) => {
    const next = new Set(chosen);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange({ ...value, steps: TRACKER_STEPS.filter((s) => next.has(s.key)).map((s) => s.key) });
  };
  const addCustom = () => {
    const custom = cleanCustomSteps([...value.custom, draft]);
    onChange({ ...value, custom });
    setDraft("");
  };
  const removeCustom = (label: string) => onChange({ ...value, custom: value.custom.filter((c) => c !== label) });
  const full = value.custom.length >= MAX_CUSTOM_STEPS;

  const stepRow = (s: (typeof TRACKER_STEPS)[number]) => (
    <label key={s.key} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-sm transition ${chosen.has(s.key) ? "border-teal bg-teal/5" : "border-slate-200 hover:border-slate-300"}`}>
      <input type="checkbox" checked={chosen.has(s.key)} onChange={() => toggle(s.key)} className="mt-0.5 h-4 w-4 flex-none rounded border-slate-300 text-teal focus:ring-teal" />
      <span>
        <span className="font-medium text-navy">{s.label}</span>
        {s.recommended ? <span className="ml-1.5 rounded-full bg-starboard/10 px-1.5 py-0.5 text-[10px] font-semibold text-starboard">Recommended</span> : null}
        {s.auto ? <span className="block text-xs text-slate-500">{s.needsPay && !payOn ? "Only shows if you use Pay & payroll. " : ""}{s.hint}</span> : null}
      </span>
    </label>
  );

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        {([
          { on: true, title: "Yes, track it", hint: "Each instructor's page shows a checklist and how far through it they are." },
          { on: false, title: "No thanks", hint: "No onboarding checklist. You can switch it on later in Settings." },
        ] as const).map((o) => (
          <button key={String(o.on)} type="button" aria-pressed={value.on === o.on} onClick={() => onChange({ ...value, on: o.on })}
            className={`rounded-lg border p-3 text-left transition ${value.on === o.on ? "border-teal bg-teal/5" : "border-slate-200 hover:border-slate-300"}`}>
            <span className="block text-sm font-semibold text-navy">{o.title}</span>
            <span className="text-xs text-slate-500">{o.hint}</span>
          </button>
        ))}
      </div>

      {value.on ? (
        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Ticks itself from their record</p>
            <div className="grid gap-2 sm:grid-cols-2">{TRACKER_STEPS.filter((s) => s.auto).map(stepRow)}</div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Ticked by the office</p>
            <div className="grid gap-2 sm:grid-cols-2">{TRACKER_STEPS.filter((s) => !s.auto).map(stepRow)}</div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Your own steps</p>
            {value.custom.length ? (
              <ul className="mb-2 flex flex-wrap gap-1.5">
                {value.custom.map((c) => (
                  <li key={c} className="flex items-center gap-1 rounded-full border border-teal bg-teal/5 px-3 py-1 text-xs font-medium text-navy">
                    {c}
                    <button type="button" aria-label={`Remove ${c}`} onClick={() => removeCustom(c)} className="ml-0.5 text-slate-400 hover:text-port">✕</button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <input value={draft} maxLength={MAX_STEP_LABEL} disabled={full} onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (draft.trim()) addCustom(); } }}
                placeholder={full ? `Up to ${MAX_CUSTOM_STEPS} of your own` : "e.g. Boat handling check, Uniform issued"}
                className="min-w-[14rem] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-teal disabled:bg-slate-50" />
              <button type="button" disabled={!draft.trim() || full} onClick={addCustom} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">+ Add step</button>
            </div>
            <p className="mt-1 text-xs text-slate-400">Your own steps are ticked by the office on each instructor&apos;s page.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Settings → General: the tracker editor with its own Save button. */
export function OnboardingTrackerForm({ initial, payOn }: { initial: TrackerConfig; payOn: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify(value) !== JSON.stringify(initial);
  const save = () => start(async () => {
    const r = await saveOnboardingTrackerAction(value);
    setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Saved" : r.error ?? "Could not save" });
    if (r.ok) router.refresh();
  });
  return (
    <div>
      <OnboardingTrackerEditor value={value} onChange={(v) => { setValue(v); setMsg(null); }} payOn={payOn} />
      <div className="mt-4 flex items-center gap-3">
        <button type="button" disabled={pending || !dirty} onClick={save} className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
        {msg ? <span role="status" className={`text-xs ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</span> : null}
      </div>
    </div>
  );
}
