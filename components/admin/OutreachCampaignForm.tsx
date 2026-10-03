"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCampaignAction, previewAudienceAction, updateCampaignAction } from "@/app/admin/outreach/actions";
import { DEFAULT_PITCH, DEFAULT_STEPS, DEFAULT_TARGET_ROLES, type AudienceFilter, type SequenceStep } from "@/lib/outreach/types";
import { PROSPECT_STATUS_META, PROSPECT_STATUS_ORDER } from "@/lib/marketing";

export interface CampaignFormValues {
  name: string; pitch: string; targetRoles: string; tone: string; fromName: string; fromEmail: string; replyTo: string;
  dailyCap: number; sendWindowStart: number; sendWindowEnd: number; weekdaysOnly: boolean; aiPersonalise: boolean;
  steps: SequenceStep[]; audience: AudienceFilter;
}

export const EMPTY_CAMPAIGN: CampaignFormValues = {
  name: "", pitch: DEFAULT_PITCH, targetRoles: DEFAULT_TARGET_ROLES, tone: "", fromName: "Conor at ActivityRoster", fromEmail: "conor@activityroster.com", replyTo: "",
  dailyCap: 40, sendWindowStart: 8, sendWindowEnd: 18, weekdaysOnly: true, aiPersonalise: true,
  steps: DEFAULT_STEPS, audience: { regions: [], statuses: [], requireWebsite: true, excludeContactedDays: 90, limit: 200 },
};

const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal";
const label = "mb-1 block text-xs font-medium text-slate-500";

export function OutreachCampaignForm({ id, initial, regions }: { id?: string; initial: CampaignFormValues; regions: string[] }) {
  const router = useRouter();
  const [v, setV] = useState<CampaignFormValues>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<{ count: number; withWebsite: number } | null>(null);
  const set = <K extends keyof CampaignFormValues>(k: K, val: CampaignFormValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const setA = <K extends keyof AudienceFilter>(k: K, val: AudienceFilter[K]) => setV((s) => ({ ...s, audience: { ...s.audience, [k]: val } }));
  const setStep = (i: number, patch: Partial<SequenceStep>) => setV((s) => ({ ...s, steps: s.steps.map((st, j) => (j === i ? { ...st, ...patch } : st)) }));

  useEffect(() => {
    const t = setTimeout(() => {
      previewAudienceAction(v.audience).then((r) => { if (r.ok) setPreview({ count: r.count ?? 0, withWebsite: r.withWebsite ?? 0 }); });
    }, 400);
    return () => clearTimeout(t);
  }, [v.audience]);

  const save = () => {
    setMsg(null);
    start(async () => {
      const res = id ? await updateCampaignAction(id, v) : await createCampaignAction(v);
      if (!res.ok) { setMsg({ ok: false, text: res.error ?? "Could not save" }); return; }
      setMsg({ ok: true, text: res.message ?? "Saved" });
      if (!id && res.id) router.push(`/admin/outreach/${res.id}`); else router.refresh();
    });
  };
  const toggle = (arr: string[], item: string) => (arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <section className="rounded-card border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-navy">What you are selling, and to whom</h2>
          <div className="mt-3 grid gap-3">
            <div><label className={label}>Campaign name</label><input value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="South coast clubs, autumn" className={input} /></div>
            <div><label className={label}>The pitch (the agent writes from this; keep it honest and specific)</label><textarea rows={4} value={v.pitch} onChange={(e) => set("pitch", e.target.value)} className={input} /></div>
            <div><label className={label}>Who to write to (roles, in order of preference)</label><input value={v.targetRoles} onChange={(e) => set("targetRoles", e.target.value)} className={input} /></div>
            <div><label className={label}>Tone notes (optional)</label><input value={v.tone} onChange={(e) => set("tone", e.target.value)} placeholder="warm, direct, no hype, no exclamation marks" className={input} /></div>
          </div>
        </section>

        <section className="rounded-card border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-navy">The sequence</h2>
          <p className="mt-1 text-xs text-slate-500">Each step is a template. With AI personalisation on, the agent rewrites it around what it found on the centre&rsquo;s website; with it off, the template is sent as-is. Placeholders: <span className="font-mono">{"{{centre}} {{first_name}} {{contact_name}} {{region}} {{sender}} {{hook}}"}</span>. A sign-off and opt-out footer are added automatically.</p>
          <div className="mt-3 space-y-4">
            {v.steps.map((st, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-navy">Step {i + 1}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {i > 0 ? <label>Days after step {i}: <input type="number" min={1} max={60} value={st.gapDays} onChange={(e) => setStep(i, { gapDays: Number(e.target.value) })} className="ml-1 w-16 rounded border border-slate-300 px-2 py-1" /></label> : <span>Sent first</span>}
                    {v.steps.length > 1 ? <button type="button" onClick={() => set("steps", v.steps.filter((_, j) => j !== i))} className="text-port hover:underline">Remove</button> : null}
                  </div>
                </div>
                <div className="mt-2 grid gap-2">
                  <div><label className={label}>Purpose (guidance for the writer)</label><input value={st.purpose} onChange={(e) => setStep(i, { purpose: e.target.value })} className={input} /></div>
                  <div><label className={label}>Subject</label><input value={st.subject} onChange={(e) => setStep(i, { subject: e.target.value })} className={input} /></div>
                  <div><label className={label}>Body</label><textarea rows={6} value={st.body} onChange={(e) => setStep(i, { body: e.target.value })} className={input} /></div>
                </div>
              </div>
            ))}
            {v.steps.length < 6 ? <button type="button" onClick={() => set("steps", [...v.steps, { gapDays: 5, purpose: "Follow-up", subject: "Re: Rostering at {{centre}}", body: "Hi {{first_name}},\n\n\n\n{{sender}}" }])} className="text-sm font-semibold text-teal hover:underline">+ Add a step</button> : null}
          </div>
        </section>

        <section className="rounded-card border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-navy">Sending</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label className={label}>From name</label><input value={v.fromName} onChange={(e) => set("fromName", e.target.value)} className={input} /></div>
            <div><label className={label}>From address (must be on your verified Resend domain)</label><input value={v.fromEmail} onChange={(e) => set("fromEmail", e.target.value)} className={input} /></div>
            <div><label className={label}>Reply-to (optional; where replies land)</label><input value={v.replyTo} onChange={(e) => set("replyTo", e.target.value)} className={input} /></div>
            <div><label className={label}>Daily cap (emails per day for this campaign)</label><input type="number" min={1} max={200} value={v.dailyCap} onChange={(e) => set("dailyCap", Number(e.target.value))} className={input} /></div>
            <div><label className={label}>Sending hours (UK time)</label><div className="flex items-center gap-2"><input type="number" min={0} max={23} value={v.sendWindowStart} onChange={(e) => set("sendWindowStart", Number(e.target.value))} className={input} /><span className="text-slate-400">to</span><input type="number" min={1} max={24} value={v.sendWindowEnd} onChange={(e) => set("sendWindowEnd", Number(e.target.value))} className={input} /></div></div>
            <div className="flex flex-col justify-end gap-2 text-sm text-navy">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={v.weekdaysOnly} onChange={(e) => set("weekdaysOnly", e.target.checked)} /> Weekdays only</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={v.aiPersonalise} onChange={(e) => set("aiPersonalise", e.target.checked)} /> AI personalisation (needs the Claude API key)</label>
            </div>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={pending} className="rounded-lg bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : id ? "Save changes" : "Save as draft"}</button>
          {msg ? <span className={`text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</span> : null}
        </div>
      </div>

      <aside className="space-y-4">
        <section className="rounded-card border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-navy">Audience</h2>
          <p className="mt-1 text-xs text-slate-500">Drawn from your Marketing list when you launch. Purchased and rejected centres are always left out.</p>
          <div className="mt-3">
            <p className={label}>Regions (none ticked = all)</p>
            <div className="max-h-44 space-y-1 overflow-auto rounded-lg border border-slate-200 p-2 text-sm">
              {regions.length === 0 ? <p className="text-xs text-slate-400">No regions on your list yet.</p> : regions.map((r) => (
                <label key={r} className="flex items-center gap-2"><input type="checkbox" checked={v.audience.regions.includes(r)} onChange={() => setA("regions", toggle(v.audience.regions, r))} /> {r}</label>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <p className={label}>Current status (none ticked = any)</p>
            <div className="space-y-1 text-sm">
              {PROSPECT_STATUS_ORDER.filter((s) => s !== "purchased" && s !== "rejected").map((s) => (
                <label key={s} className="flex items-center gap-2"><input type="checkbox" checked={v.audience.statuses.includes(s)} onChange={() => setA("statuses", toggle(v.audience.statuses, s))} /> {PROSPECT_STATUS_META[s].label}</label>
              ))}
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-navy"><input type="checkbox" checked={v.audience.requireWebsite} onChange={(e) => setA("requireWebsite", e.target.checked)} /> Only centres with a website</label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div><label className={label}>Skip if emailed in the last (days)</label><input type="number" min={0} max={365} value={v.audience.excludeContactedDays} onChange={(e) => setA("excludeContactedDays", Number(e.target.value))} className={input} /></div>
            <div><label className={label}>Max centres</label><input type="number" min={1} max={2000} value={v.audience.limit} onChange={(e) => setA("limit", Number(e.target.value))} className={input} /></div>
          </div>
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-navy">{preview ? <><span className="font-semibold">{preview.count}</span> centre{preview.count === 1 ? "" : "s"} match{preview.count === 1 ? "es" : ""} right now{!v.audience.requireWebsite ? <> ({preview.withWebsite} with a website)</> : null}.</> : "Counting…"}</p>
        </section>
      </aside>
    </div>
  );
}
