"use client";

import { askConfirm } from "@/lib/ui/ask-confirm";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCampaignAction, launchCampaignAction, researchNowAction, sendDueNowAction, setCampaignStatusAction, type OutreachResult } from "@/app/admin/outreach/actions";
import type { OutreachCampaignStatus } from "@/lib/db/schema";

const btn = "rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-50";
const primary = "rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50";

/** Launch / pause / resume / finish / delete plus the two manual "run now" buttons for one campaign. */
export function CampaignControls({ id, status, hasNew, hasDue }: { id: string; status: OutreachCampaignStatus; hasNew: boolean; hasDue: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<OutreachResult | null>(null);
  const del = async () => {
    if (!await askConfirm("Delete this campaign and all its leads and message history? This cannot be undone.")) return;
    start(async () => { const r = await deleteCampaignAction(id); if (r.ok) router.push("/admin/outreach"); else setMsg(r); });
  };
  const run = async (fn: () => Promise<OutreachResult>, confirmText?: string) => {
    if (confirmText && !await askConfirm(confirmText)) return;
    setMsg(null);
    start(async () => { const r = await fn(); setMsg(r); if (r.ok) router.refresh(); });
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {status === "draft" ? <button disabled={pending} onClick={() => run(() => launchCampaignAction(id), "Launch this campaign? Matching centres from your Marketing list are added and the agent starts researching them. Emails go out only inside the sending hours and daily cap.")} className={primary}>Launch</button> : null}
        {status === "running" ? <button disabled={pending} onClick={() => run(() => setCampaignStatusAction(id, "paused"))} className={btn}>Pause</button> : null}
        {status === "paused" ? <button disabled={pending} onClick={() => run(() => setCampaignStatusAction(id, "running"))} className={primary}>Resume</button> : null}
        {status === "running" || status === "paused" ? <button disabled={pending} onClick={() => run(() => launchCampaignAction(id), "Add any newly matching centres from your Marketing list to this campaign?")} className={btn}>Add new matches</button> : null}
        {status === "running" ? <>
          <button disabled={pending || !hasNew} onClick={() => run(() => researchNowAction(id, 10))} className={btn}>{pending ? "Working…" : "Research next 10"}</button>
          <button disabled={pending || !hasDue} onClick={() => run(() => sendDueNowAction(id, false))} className={btn}>Send what&rsquo;s due</button>
        </> : null}
        {status !== "finished" && status !== "draft" ? <button disabled={pending} onClick={() => run(() => setCampaignStatusAction(id, "finished"), "Mark this campaign finished? Nothing more will be sent.")} className={btn}>Finish</button> : null}
        {status !== "running" ? <button disabled={pending} onClick={del} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-port hover:bg-red-50 disabled:opacity-50">Delete</button> : null}
      </div>
      {msg ? <p role="status" className={`mt-2 text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.ok ? msg.message : msg.error}</p> : null}
    </div>
  );
}

/** Overview-level "run the agent now" button (all running campaigns). */
export function RunAgentButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<OutreachResult | null>(null);
  return (
    <div className="flex items-center gap-3">
      <button disabled={pending} onClick={() => { setMsg(null); start(async () => { const r = await sendDueNowAction(undefined, false); setMsg(r); router.refresh(); }); }} className={primary}>{pending ? "Running…" : "Run the agent now"}</button>
      {msg ? <span className={`text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.ok ? msg.message : msg.error}</span> : null}
    </div>
  );
}
