"use client";

import { useState } from "react";

const KINDS = [
  ["access", "A copy of the personal data you hold about me"],
  ["correction", "Correct something that is wrong"],
  ["erasure", "Delete my data"],
  ["restriction", "Stop using my data while we sort something out"],
  ["portability", "Export my data in a reusable format"],
  ["objection", "I object to how my data is being used"],
  ["complaint", "A complaint about data protection"],
  ["other", "Something else"],
] as const;

const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal";

export function PrivacyRequestForm() {
  const [v, setV] = useState({ kind: "access", name: "", email: "", centre: "", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof v, val: string) => setV((s) => ({ ...s, [k]: val }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const res = await fetch("/api/privacy-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; reference?: string; error?: string };
      if (!res.ok || !data.ok) { setErr(data.error ?? "Something went wrong. Email privacy@activityroster.com instead."); return; }
      setDone(data.reference ?? "received");
    } catch { setErr("Could not send. Email privacy@activityroster.com instead."); } finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="rounded-card border border-slate-200 bg-white p-6 text-center">
        <p className="text-3xl">📬</p>
        <h2 className="mt-2 font-display text-xl font-semibold text-navy">Received, reference {done}</h2>
        <p className="mt-2 text-sm text-slate-600">We&rsquo;ve emailed you a receipt and will reply within 30 days, usually much sooner.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-card border border-slate-200 bg-white p-6">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">What do you need?</label>
        <select value={v.kind} onChange={(e) => set("kind", e.target.value)} className={input}>
          {KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="mb-1 block text-xs font-medium text-slate-500">Your name</label><input value={v.name} onChange={(e) => set("name", e.target.value)} required className={input} /></div>
        <div><label className="mb-1 block text-xs font-medium text-slate-500">Your email</label><input type="email" value={v.email} onChange={(e) => set("email", e.target.value)} required className={input} /></div>
      </div>
      <div><label className="mb-1 block text-xs font-medium text-slate-500">Centre or club this is about (if any)</label><input value={v.centre} onChange={(e) => set("centre", e.target.value)} placeholder="e.g. Westbay Sailing Club" className={input} /></div>
      <div><label className="mb-1 block text-xs font-medium text-slate-500">Details</label><textarea value={v.message} onChange={(e) => set("message", e.target.value)} required rows={5} className={input} placeholder="Tell us what you need and anything that helps us find your records (the email address your account uses, for example)." /></div>
      <div className="hidden" aria-hidden><label>Website<input tabIndex={-1} autoComplete="off" value={v.website} onChange={(e) => set("website", e.target.value)} /></label></div>
      {err ? <p className="text-sm text-port">{err}</p> : null}
      <button disabled={busy} className="rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{busy ? "Sending…" : "Send request"}</button>
      <p className="text-xs text-slate-400">We use these details only to deal with your request. You can also complain to the ICO (ico.org.uk) or, in Ireland, the Data Protection Commission (dataprotection.ie).</p>
    </form>
  );
}
