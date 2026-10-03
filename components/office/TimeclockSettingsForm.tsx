"use client";

import { useState, useTransition } from "react";
import { updateTimeclockSettingsAction } from "@/app/(app)/office/settings/actions";

export function TimeclockSettingsForm({ timeclockEnabled, paySource }: { timeclockEnabled: boolean; paySource: "roster" | "clock" }) {
  const [pending, start] = useTransition();
  const [on, setOn] = useState(timeclockEnabled);
  const [source, setSource] = useState<"roster" | "clock">(paySource);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = () => start(async () => {
    const r = await updateTimeclockSettingsAction({ timeclockEnabled: on, paySource: source });
    setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Saved" : r.error ?? "Could not save" });
  });
  return (
    <div className="space-y-3 text-sm text-slate-600">
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={on} onChange={(e) => { setOn(e.target.checked); if (!e.target.checked) setSource("roster"); }} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
        <span><span className="font-medium text-navy">Instructors clock in and out</span><span className="block text-xs text-slate-400">Adds a Clock tab to the app; clocked times show next to rostered times on Payroll.</span></span>
      </label>
      <div>
        <p className="text-xs font-medium text-slate-500">Payroll pays on</p>
        <div className="mt-1 flex gap-2">
          {(["roster", "clock"] as const).map((v) => (
            <button key={v} type="button" disabled={v === "clock" && !on} onClick={() => setSource(v)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-40 ${source === v ? "border-teal bg-teal/5 text-navy" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
              {v === "roster" ? "What was rostered" : "What was clocked"}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-400">The default for new payroll lines; any line can be switched on the Payroll page.</p>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
        {msg ? <span role="status" className={`text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</span> : null}
      </div>
    </div>
  );
}
