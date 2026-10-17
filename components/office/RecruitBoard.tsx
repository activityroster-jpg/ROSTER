"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, StatusPill } from "@/components/ui";
import { askConfirm } from "@/lib/ui/ask-confirm";
import { dismissHiringCardAction, jobOpAction, saveCentreDetailsAction, saveJobAction } from "@/app/(app)/office/recruit/actions";
import {
  canClose, canDelete, canEdit, canPublish, canRenew, DESCRIPTION_MAX, EMPLOYMENT_LABEL, MAX_LIVE_JOBS, PAY_LABEL, PAY_WITHOUT_AMOUNT,
  REGION_OPTIONS, ROLE_TYPE_LABEL, STATUS_LABEL, type JobStatusLike,
} from "@/lib/domain/jobs";

export interface JobRow {
  id: string;
  title: string;
  roleType: string;
  employmentType: string;
  positions: number;
  startDate: string;
  endDate: string | null;
  payType: string;
  payAmountGbp: number | null;
  accommodation: boolean;
  locationText: string;
  requiredQualifications: string[];
  description: string;
  closingDate: string;
  applicationEmail: string;
  status: JobStatusLike;
  listingId: string | null;
  publicUrl: string | null;
  expiresAt: string | null;
  removedReason: string | null;
  syncError: string | null;
  applicationsCount: number;
  /** A call to Boaty Jobs is still on its way. */
  sending: boolean;
}

interface Centre { town: string; postcode: string; region: string | null; regionLabel: string | null; website: string; logoUrl: string; email: string }

const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal disabled:bg-slate-50";
const label = "mb-1 block text-sm font-medium text-navy";
const btn = "rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50";

function tone(s: JobStatusLike): "covered" | "conflict" | "attention" | "neutral" {
  if (s === "live") return "covered";
  if (s === "removed" || s === "sync_failed") return "conflict";
  if (s === "publishing") return "attention";
  return "neutral";
}

const ukDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function RecruitBoard({ jobs, canPost, readOnlyReason, liveUsed, centre, defaults, qualOptions }: {
  jobs: JobRow[];
  canPost: boolean;
  readOnlyReason: string | null;
  liveUsed: number;
  centre: Centre;
  defaults: { locationText: string; applicationEmail: string };
  qualOptions: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<JobRow | "new" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const needsDetails = !centre.town || !centre.regionLabel;

  const op = (id: string, which: "publish" | "close" | "renew" | "retry" | "delete", confirm?: string) => start(async () => {
    if (confirm && !(await askConfirm(confirm))) return;
    const r = await jobOpAction(id, which);
    setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Done." : r.error ?? "Something went wrong." });
    router.refresh();
  });

  return (
    <div className="space-y-6">
      {!canPost ? (
        <div className="rounded-card border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-navy">
          <strong>{readOnlyReason}</strong> Your jobs are shown below, read-only. <a href="/office/billing" className="font-medium text-teal hover:underline">Go to Billing</a>
        </div>
      ) : null}
      {msg ? <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-starboard/10 text-starboard" : "bg-port/10 text-port"}`}>{msg.text}</p> : null}

      <CentreDetails centre={centre} canPost={canPost} open={needsDetails} onSaved={(t) => { setMsg({ ok: true, text: t }); router.refresh(); }} onError={(t) => setMsg({ ok: false, text: t })} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-navy">Your jobs <span className="ml-1 text-sm font-normal text-slate-500">{liveUsed} of {MAX_LIVE_JOBS} live</span></h2>
        {canPost && editing === null ? (
          <button type="button" onClick={() => { setMsg(null); setEditing("new"); }} className={`${btn} bg-teal text-white hover:bg-teal-700`}>+ New job</button>
        ) : null}
      </div>

      {editing !== null ? (
        <JobEditor
          job={editing === "new" ? null : editing}
          defaults={defaults}
          qualOptions={qualOptions}
          blockedFromPublishing={needsDetails ? "Add your centre's town and region above before publishing." : null}
          onDone={(text, ok) => { setMsg({ ok, text }); if (ok) setEditing(null); router.refresh(); }}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      {jobs.length === 0 && editing === null ? (
        <Card className="text-sm text-slate-500">No jobs yet. {canPost ? "Press “+ New job” to write your first one." : ""}</Card>
      ) : null}

      <ul className="space-y-3">
        {jobs.map((j) => (
          <li key={j.id}>
            <Card className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-navy">{j.title}</p>
                  <p className="text-xs text-slate-500">
                    {ROLE_TYPE_LABEL[j.roleType] ?? j.roleType} · {EMPLOYMENT_LABEL[j.employmentType] ?? j.employmentType}
                    {j.positions > 1 ? ` · ${j.positions} places` : ""} · starts {ukDate(j.startDate)} · closes {ukDate(j.closingDate)}
                  </p>
                </div>
                <StatusPill tone={tone(j.status)}>{STATUS_LABEL[j.status]}</StatusPill>
              </div>
              {j.sending ? <p className="text-xs text-slate-500">Sending to Boaty Jobs…</p> : null}
              {j.status === "live" && j.publicUrl ? (
                <p className="text-sm">On Boaty Jobs: <a href={j.publicUrl} target="_blank" rel="noreferrer" className="break-all font-medium text-teal hover:underline">{j.publicUrl}</a>{j.expiresAt ? <span className="text-slate-500"> · until {ukDate(j.expiresAt)}</span> : null}</p>
              ) : null}
              {j.status === "removed" ? <p className="text-sm text-port">Boaty Jobs removed this listing: {j.removedReason}</p> : null}
              {j.status === "sync_failed" ? <p className="text-sm text-port">{j.syncError ?? "Boaty Jobs couldn't be reached."} Press Retry to try again.</p> : null}
              {j.status !== "draft" ? (
                <p className="text-sm text-slate-600">Applications received: <strong>{j.applicationsCount}</strong> <span className="text-slate-500">· emailed to {j.applicationEmail}</span></p>
              ) : null}
              {canPost ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {canEdit(j) ? <button type="button" disabled={pending} onClick={() => { setMsg(null); setEditing(j); }} className={`${btn} border border-slate-300 text-navy hover:bg-slate-50`}>Edit</button> : null}
                  {canPublish(j) && j.status === "draft" ? <button type="button" disabled={pending || needsDetails} title={needsDetails ? "Add your centre's town and region first" : undefined} onClick={() => op(j.id, "publish")} className={`${btn} bg-teal text-white hover:bg-teal-700`}>Publish to Boaty Jobs</button> : null}
                  {j.status === "sync_failed" ? <button type="button" disabled={pending} onClick={() => op(j.id, "retry")} className={`${btn} bg-teal text-white hover:bg-teal-700`}>Retry</button> : null}
                  {canRenew(j) ? <button type="button" disabled={pending} onClick={() => op(j.id, "renew")} className={`${btn} border border-teal text-teal hover:bg-teal/5`}>Renew for 60 days</button> : null}
                  {canClose(j) ? <button type="button" disabled={pending} onClick={() => op(j.id, "close", "Close this job? It comes off Boaty Jobs and stops taking applications. You can renew it later.")} className={`${btn} border border-slate-300 text-navy hover:bg-slate-50`}>Close</button> : null}
                  {canDelete(j) ? <button type="button" disabled={pending} onClick={() => op(j.id, "delete", "Delete this draft?")} className={`${btn} text-slate-400 hover:text-port`}>Delete draft</button> : null}
                </div>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CentreDetails({ centre, canPost, open, onSaved, onError }: { centre: Centre; canPost: boolean; open: boolean; onSaved: (t: string) => void; onError: (t: string) => void }) {
  const [v, setV] = useState({ town: centre.town, postcode: centre.postcode, region: centre.region ?? "", website: centre.website, logoUrl: centre.logoUrl, email: centre.email });
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const r = await saveCentreDetailsAction({ ...v, region: v.region || null });
    if (r.ok) onSaved(r.message ?? "Saved."); else onError(r.error ?? "Couldn't save.");
  });
  return (
    <details open={open} className="rounded-card border border-slate-200 bg-white p-5 shadow-sm">
      <summary className="cursor-pointer font-semibold text-navy">Centre details shown on Boaty Jobs <span className="ml-1 text-sm font-normal text-slate-500">{[centre.town, centre.regionLabel].filter(Boolean).join(", ") || "not set yet"}</span></summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label><span className={label}>Town</span><input className={input} disabled={!canPost} value={v.town} onChange={(e) => setV({ ...v, town: e.target.value })} placeholder="e.g. Weymouth" /></label>
        <label><span className={label}>Postcode</span><input className={input} disabled={!canPost} value={v.postcode} onChange={(e) => setV({ ...v, postcode: e.target.value })} placeholder="e.g. DT4 9DT" /></label>
        <label><span className={label}>Region</span>
          <select className={input} disabled={!canPost} value={v.region} onChange={(e) => setV({ ...v, region: e.target.value })}>
            <option value="">{centre.region === null && centre.regionLabel ? `${centre.regionLabel} (from your centre)` : "Choose…"}</option>
            {REGION_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
        <label><span className={label}>Website</span><input className={input} disabled={!canPost} value={v.website} onChange={(e) => setV({ ...v, website: e.target.value })} placeholder="https://" /></label>
        <label><span className={label}>Logo image link (optional)</span><input className={input} disabled={!canPost} value={v.logoUrl} onChange={(e) => setV({ ...v, logoUrl: e.target.value })} placeholder="https://…/logo.png" /></label>
        <label><span className={label}>Send applications to</span><input type="email" className={input} disabled={!canPost} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></label>
      </div>
      <p className="mt-3 text-xs text-slate-500">Shown publicly with every job, together with your centre&apos;s name. The applications email is the default for new jobs; each job can use its own.</p>
      {canPost ? <button type="button" disabled={pending} onClick={save} className={`${btn} mt-3 bg-navy text-white hover:opacity-90`}>{pending ? "Saving…" : "Save centre details"}</button> : null}
    </details>
  );
}

function JobEditor({ job, defaults, qualOptions, blockedFromPublishing, onDone, onCancel }: {
  job: JobRow | null;
  defaults: { locationText: string; applicationEmail: string };
  qualOptions: string[];
  blockedFromPublishing: string | null;
  onDone: (text: string, ok: boolean) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState({
    title: job?.title ?? "",
    roleType: job?.roleType ?? "dinghy_instructor",
    employmentType: job?.employmentType ?? "seasonal",
    positions: job?.positions ?? 1,
    startDate: job?.startDate ?? "",
    endDate: job?.endDate ?? "",
    payType: job?.payType ?? "weekly",
    payAmount: job?.payAmountGbp?.toString() ?? "",
    accommodation: job?.accommodation ?? false,
    locationText: job?.locationText ?? defaults.locationText,
    quals: job?.requiredQualifications ?? [],
    description: job?.description ?? "",
    closingDate: job?.closingDate ?? "",
    applicationEmail: job?.applicationEmail ?? defaults.applicationEmail,
  });
  const [other, setOther] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const isLive = job ? job.status === "live" || (job.status === "sync_failed" && Boolean(job.listingId)) : false;
  const canPublishNow = !job || job.status === "draft";
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((x) => ({ ...x, [k]: val }));
  const toggleQual = (q: string) => set("quals", v.quals.includes(q) ? v.quals.filter((x) => x !== q) : [...v.quals, q]);
  const options = [...new Set([...qualOptions, ...v.quals])];

  const submit = (publishNow: boolean) => start(async () => {
    setErr(null);
    const amount = v.payAmount.trim() === "" ? null : Number(v.payAmount);
    if (amount !== null && Number.isNaN(amount)) { setErr("Enter the pay as a number, e.g. 450"); return; }
    const payload = {
      title: v.title,
      roleType: v.roleType,
      employmentType: v.employmentType,
      positions: Number(v.positions) || 1,
      startDate: v.startDate,
      endDate: v.endDate || null,
      payType: v.payType,
      payAmountGbp: PAY_WITHOUT_AMOUNT.includes(v.payType) ? null : amount,
      accommodation: v.accommodation,
      locationText: v.locationText,
      requiredQualifications: v.quals,
      description: v.description,
      closingDate: v.closingDate,
      applicationEmail: v.applicationEmail,
    };
    const r = await saveJobAction(job?.id ?? null, payload, publishNow);
    if (r.ok) onDone(r.message ?? "Saved.", true);
    else if (r.id && !job) onDone(r.error ?? "Saved as a draft.", false);
    else setErr(r.error ?? "Couldn't save.");
  });

  return (
    <Card className="space-y-4 border-teal/40">
      <h3 className="font-semibold text-navy">{job ? `Edit: ${job.title}` : "New job"}</h3>
      {isLive ? <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">This job is live: saving updates it on Boaty Jobs straight away.</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className={label}>Job title</span><input className={input} value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Seasonal Dinghy Instructor 2027" maxLength={120} /></label>
        <label><span className={label}>Role</span>
          <select className={input} value={v.roleType} onChange={(e) => set("roleType", e.target.value)}>
            {Object.entries(ROLE_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label><span className={label}>Type of work</span>
          <select className={input} value={v.employmentType} onChange={(e) => set("employmentType", e.target.value)}>
            {Object.entries(EMPLOYMENT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label><span className={label}>Places</span><input type="number" min={1} max={50} className={input} value={v.positions} onChange={(e) => set("positions", Number(e.target.value))} /></label>
        <label><span className={label}>Where</span><input className={input} value={v.locationText} onChange={(e) => set("locationText", e.target.value)} placeholder="Town, postcode" maxLength={200} /></label>
        <label><span className={label}>Start date</span><input type="date" className={input} value={v.startDate} onChange={(e) => set("startDate", e.target.value)} /></label>
        <label><span className={label}>End date (optional)</span><input type="date" className={input} value={v.endDate} onChange={(e) => set("endDate", e.target.value)} /></label>
        <label><span className={label}>Pay</span>
          <select className={input} value={v.payType} onChange={(e) => set("payType", e.target.value)}>
            {Object.entries(PAY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        {!PAY_WITHOUT_AMOUNT.includes(v.payType) ? (
          <label><span className={label}>Amount (£)</span><input inputMode="decimal" className={input} value={v.payAmount} onChange={(e) => set("payAmount", e.target.value)} placeholder="e.g. 450" /></label>
        ) : <span />}
        <label className="flex items-center gap-2 text-sm text-navy sm:col-span-2"><input type="checkbox" checked={v.accommodation} onChange={(e) => set("accommodation", e.target.checked)} /> Accommodation provided</label>
      </div>

      <fieldset>
        <legend className={label}>Qualifications needed</legend>
        <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {options.map((q) => (
            <label key={q} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${v.quals.includes(q) ? "border-teal bg-teal/10 text-navy" : "border-slate-200 text-slate-600"}`}>
              <input type="checkbox" className="sr-only" checked={v.quals.includes(q)} onChange={() => toggleQual(q)} />{q}
            </label>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input className={input} value={other} onChange={(e) => setOther(e.target.value)} placeholder="Something else, e.g. First aid certificate" maxLength={100}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (other.trim()) { toggleQual(other.trim()); setOther(""); } } }} />
          <button type="button" onClick={() => { if (other.trim() && !v.quals.includes(other.trim())) { set("quals", [...v.quals, other.trim()]); setOther(""); } }} className={`${btn} border border-slate-300 text-navy hover:bg-slate-50`}>Add</button>
        </div>
      </fieldset>

      <label className="block"><span className={label}>Description</span>
        <textarea className={`${input} min-h-40`} value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={DESCRIPTION_MAX} placeholder="What the job involves, the season, who you're looking for, and anything that makes your centre a good place to work." />
        <span className="text-xs text-slate-400">{v.description.length.toLocaleString("en-GB")} / {DESCRIPTION_MAX.toLocaleString("en-GB")} · plain text</span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className={label}>Closing date</span><input type="date" className={input} value={v.closingDate} onChange={(e) => set("closingDate", e.target.value)} /></label>
        <label><span className={label}>Applications email</span><input type="email" className={input} value={v.applicationEmail} onChange={(e) => set("applicationEmail", e.target.value)} /></label>
      </div>
      <p className="rounded-lg bg-teal/5 px-3 py-2 text-sm text-navy">Applications are emailed to <strong>{v.applicationEmail || "the address above"}</strong>. Boaty Jobs sends them to you; they don&apos;t come into ActivityRoster.</p>

      {err ? <p className="text-sm text-port">{err}</p> : null}
      <div className="flex flex-wrap gap-2">
        {canPublishNow ? (
          <>
            <button type="button" disabled={pending || Boolean(blockedFromPublishing)} title={blockedFromPublishing ?? undefined} onClick={() => submit(true)} className={`${btn} bg-teal text-white hover:bg-teal-700`}>{pending ? "Saving…" : "Save and publish to Boaty Jobs"}</button>
            <button type="button" disabled={pending} onClick={() => submit(false)} className={`${btn} border border-slate-300 text-navy hover:bg-slate-50`}>Save as draft</button>
          </>
        ) : (
          <button type="button" disabled={pending} onClick={() => submit(false)} className={`${btn} bg-teal text-white hover:bg-teal-700`}>{pending ? "Saving…" : isLive ? "Save and update on Boaty Jobs" : "Save"}</button>
        )}
        <button type="button" disabled={pending} onClick={onCancel} className={`${btn} text-slate-500 hover:text-navy`}>Cancel</button>
      </div>
      {blockedFromPublishing && canPublishNow ? <p className="text-xs text-slate-500">{blockedFromPublishing}</p> : null}
    </Card>
  );
}

/** The seasonal dashboard card (1 Dec – 30 Apr), dismissible until next season. */
export function HiringSeasonCard() {
  const [hidden, setHidden] = useState(false);
  const [pending, start] = useTransition();
  if (hidden) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-teal/30 bg-teal/5 px-4 py-3">
      <p className="text-sm text-navy"><strong>Hiring for the season?</strong> Post jobs free on Boaty Jobs, included with your plan.</p>
      <div className="flex items-center gap-2">
        <a href="/office/recruit" className={`${btn} bg-teal text-white hover:bg-teal-700`}>Post a job</a>
        <button type="button" disabled={pending} onClick={() => start(async () => { setHidden(true); await dismissHiringCardAction(); })} aria-label="Dismiss" className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:text-navy">Not now</button>
      </div>
    </div>
  );
}
