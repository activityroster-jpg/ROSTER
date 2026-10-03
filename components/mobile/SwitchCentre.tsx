"use client";

import { useState, useTransition } from "react";
import { selectCentreAction } from "@/app/app/actions";

export interface CentreOption { organisationId: string; name: string; slug: string; status: string; current: boolean }

export function SwitchCentre({ centres, joinHref }: { centres: CentreOption[]; joinHref: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const pick = (id: string) => start(async () => {
    const r = await selectCentreAction(id);
    if (r && !r.ok) setErr(r.error ?? "Could not switch");
  });
  return (
    <div>
      <ul className="space-y-2">
        {centres.map((c) => (
          <li key={c.organisationId}>
            {c.status === "active" ? (
              <button type="button" onClick={() => pick(c.organisationId)} disabled={pending} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left ${c.current ? "border-teal bg-teal/5" : "border-slate-200 bg-white"} disabled:opacity-60`}>
                <span><span className="block font-semibold text-navy">{c.name}</span><span className="text-xs text-slate-400">{c.slug}.activityroster.com</span></span>
                <span className="text-sm font-medium text-teal">{c.current ? "Current" : "Open →"}</span>
              </button>
            ) : (
              <div className="flex w-full items-center justify-between rounded-xl border border-dashed border-slate-200 px-4 py-3 text-left opacity-80">
                <span><span className="block font-semibold text-navy">{c.name}</span><span className="text-xs text-slate-400">{c.status === "requested" ? "Waiting for approval" : c.status === "invited" ? "Invited — open to accept" : "Suspended"}</span></span>
              </div>
            )}
          </li>
        ))}
      </ul>
      {err ? <p className="mt-2 text-sm text-port">{err}</p> : null}
      <a href={joinHref} className="mt-4 block rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-600">＋ Join another centre with a code</a>
    </div>
  );
}
