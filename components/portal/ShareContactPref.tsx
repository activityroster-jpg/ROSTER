"use client";

import { useState, useTransition } from "react";
import { setShareContactAction } from "@/app/(app)/portal/notifications/actions";

export function ShareContactPref({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const toggle = () => {
    const next = !on; setOn(next); setErr(null);
    start(async () => { const r = await setShareContactAction(next); if (!r.ok) { setOn(!next); setErr(r.error ?? "Could not save"); } });
  };
  return (
    <label className="flex items-start gap-3 text-sm text-slate-700">
      <input type="checkbox" checked={on} onChange={toggle} disabled={pending} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
      <span>Let colleagues at this centre see my phone and email <span className="block text-xs text-slate-400">Off by default. Switch it on if you are happy for the team to contact you about cover and swaps; you appear in everyone's Team contacts list.</span>{err ? <span className="block text-xs text-port">{err}</span> : null}</span>
    </label>
  );
}
