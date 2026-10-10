"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NO_ACTION_LABEL, OUTREACH_TICKS, PROSPECT_STATUS_META, isNoAction, toggleOutreach, type OutreachTick } from "@/lib/marketing";
import { setProspectTickAction } from "@/app/admin/marketing/actions";
import type { ProspectStatus } from "@/lib/db/schema";

const CHIP: Record<OutreachTick, string> = {
  ready_to_send: "bg-slate-200 text-slate-700",
  letter_sent: "bg-amber/15 text-amber",
  flyer_sent: "bg-amber/15 text-amber",
  booklet_sent: "bg-teal/15 text-teal",
  rejected: "bg-port/15 text-port",
};

/**
 * The outreach tickboxes: No action, Ready to send, Letter sent, Flyer sent,
 * Booklet sent, Rejected. Several can be ticked; "No action" clears the rest.
 * `compact` shows the ticked ones as chips that open the boxes (the list);
 * otherwise the boxes show in a row (a centre's page).
 */
export function StatusTicks({ id, name, statuses: initial, compact = false }: { id: string; name: string; statuses: ProspectStatus[]; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [statuses, setStatuses] = useState(initial);
  useEffect(() => setStatuses(initial), [initial]);
  const [err, setErr] = useState<string | null>(null);

  const change = (tick: OutreachTick | null, on: boolean) => {
    const before = statuses;
    setStatuses(toggleOutreach(statuses, tick, on));
    setErr(null);
    start(async () => {
      const r = await setProspectTickAction(id, tick, on);
      if (!r.ok) { setStatuses(before); setErr(r.error ?? "Couldn't save"); }
      router.refresh();
    });
  };

  const none = isNoAction(statuses);
  const box = (label: string, checked: boolean, onChange: (on: boolean) => void, key: string) => (
    <label key={key} className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded px-1.5 py-1 text-xs text-navy hover:bg-slate-50">
      <input type="checkbox" checked={checked} disabled={pending} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-teal focus:ring-teal" />
      {label}
    </label>
  );
  const boxes = [
    box(NO_ACTION_LABEL, none, (on) => { if (on) change(null, true); }, "none"),
    ...OUTREACH_TICKS.map((t) => box(PROSPECT_STATUS_META[t].label, statuses.includes(t), (on) => change(t, on), t)),
  ];

  if (!compact) {
    return (
      <div>
        <div className="flex flex-wrap gap-x-1 gap-y-0.5" role="group" aria-label={`Outreach for ${name}`}>{boxes}</div>
        {err ? <p className="mt-1 text-xs text-port">{err}</p> : null}
      </div>
    );
  }

  const ticked = OUTREACH_TICKS.filter((t) => statuses.includes(t));
  return (
    <details className="relative">
      <summary className={`flex cursor-pointer list-none flex-wrap gap-1 rounded border border-transparent px-1 py-0.5 hover:border-slate-300 ${pending ? "opacity-60" : ""}`} aria-label={`Outreach for ${name}`} title="Click to tick">
        {ticked.length === 0
          ? <span className="rounded bg-slate-100 px-1.5 py-px text-[10px] font-semibold text-slate-500">{NO_ACTION_LABEL}</span>
          : ticked.map((t) => <span key={t} className={`rounded px-1.5 py-px text-[10px] font-semibold ${CHIP[t]}`}>{PROSPECT_STATUS_META[t].short}</span>)}
      </summary>
      <div className="absolute left-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg" role="group" aria-label={`Outreach for ${name}`}>
        {boxes}
        {err ? <p className="px-1.5 text-[11px] text-port">{err}</p> : null}
      </div>
    </details>
  );
}
