"use client";

import { askConfirm } from "@/lib/ui/ask-confirm";
import { useState, useTransition } from "react";
import { sendSubprocessorNoticeAction } from "@/app/admin/privacy/actions";

/** Dev Center card: send the 30-day sub-processor change notice to every centre admin. */
export function SubprocessorNotice() {
  const [summary, setSummary] = useState("");
  const [effectiveOn, setEffectiveOn] = useState(() => new Date(Date.now() + 35 * 86_400_000).toISOString().slice(0, 10));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (test: boolean) => start(async () => {
    setMsg(null);
    const r = await sendSubprocessorNoticeAction({ summary, effectiveOn, test });
    setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Done" : r.error ?? "Could not send" });
  });
  return (
    <div className="rounded-card border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-navy">Sub-processor change notice</h2>
      <p className="mt-1 text-sm text-slate-500">Before a new company handles centres&rsquo; data (or an existing one changes role or location), add the line to <code className="text-xs">lib/legal/subprocessors.ts</code> and <code className="text-xs">docs/subprocessors.md</code>, then send this. Every admin of every live centre gets one email, at least 30 days ahead, linking to the public register. Send yourself a test first.</p>
      <label className="mt-3 block text-xs font-medium text-slate-600">What is changing
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} placeholder="e.g. From 10 November we will use Postmark as a backup email provider. It only sends if our main provider fails, receives the same email addresses and content, and processes in the United States under EU standard contractual clauses." className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <label className="mt-3 block text-xs font-medium text-slate-600">Takes effect on
        <input type="date" value={effectiveOn} onChange={(e) => setEffectiveOn(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => run(true)} disabled={pending || summary.trim().length < 20} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50 disabled:opacity-50">Send me a test</button>
        <button type="button" onClick={async () => { if (await askConfirm("Send this notice to every centre admin now?")) run(false); }} disabled={pending || summary.trim().length < 20} className="rounded-lg bg-teal px-4 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Sending…" : "Send to all centres"}</button>
        {msg ? <span className={`text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</span> : null}
      </div>
    </div>
  );
}
