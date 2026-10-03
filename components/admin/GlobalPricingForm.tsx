"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setGlobalPricingAction } from "@/app/admin/actions";
import { TIERS, TIER_ORDER } from "@/lib/tiers";

/**
 * Platform-wide pricing knobs. Plan prices are the tiers (Small Club / Standard,
 * set in code so the website, checkout and Stripe stay in step); this form holds
 * the rest: currency, trial length, first-month-free and the custom package.
 */
export function GlobalPricingForm({
  currency, trialDays, freeFirstMonth, setupPrice, setupEnabled,
}: { currency: string; trialDays: number; freeFirstMonth: boolean; setupPrice: number; setupEnabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [cur, setCur] = useState(currency);
  const [trial, setTrial] = useState(String(trialDays));
  const [free, setFree] = useState(freeFirstMonth);
  const [setup, setSetup] = useState(String(setupPrice));
  const [setupOn, setSetupOn] = useState(setupEnabled);

  const save = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await setGlobalPricingAction({ currency: cur, trialDays: Number(trial), freeFirstMonth: free, setupPrice: Number(setup), setupEnabled: setupOn });
      if (res.ok) { setMsg("Saved"); router.refresh(); } else setMsg(res.error ?? "Failed");
    });
  };
  const field = "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
  const sym = cur === "EUR" ? "€" : cur === "USD" ? "$" : "£";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap gap-3">
        {TIER_ORDER.map((id) => {
          const t = TIERS[id];
          return (
            <div key={id} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2">
              <p className="text-xs font-semibold text-slate-500">{t.name}{t.userCap ? ` · up to ${t.userCap}` : " · unlimited"}</p>
              <p className="text-lg font-semibold text-navy">{sym}{t.monthlyPrice}<span className="text-xs font-normal text-slate-500">/mo</span> <span className="ml-2 text-sm font-medium text-slate-600">{sym}{t.annualPrice}/yr</span></p>
            </div>
          );
        })}
        <p className="self-center text-xs text-slate-400">Plan prices are fixed per tier. Change them in code (lib/tiers.ts) and in Stripe together; the Stripe prices panel below shows whether they match.</p>
      </div>
      <label className="text-xs font-semibold text-slate-500">Currency
        <select value={cur} onChange={(e) => setCur(e.target.value)} className={field}>
          <option value="GBP">GBP £</option><option value="EUR">EUR €</option><option value="USD">USD $</option>
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-500">Free trial (days)
        <input value={trial} onChange={(e) => setTrial(e.target.value)} type="number" min="0" className={field} />
      </label>
      <label className="text-xs font-semibold text-slate-500">Custom package (one-off)
        <input value={setup} onChange={(e) => setSetup(e.target.value)} type="number" min="0" step="0.01" className={field} />
      </label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-600">
        <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
        First month free
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2 lg:col-span-4">
        <input type="checkbox" checked={setupOn} onChange={(e) => setSetupOn(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
        Offer the custom package on the pricing page
      </label>
      <div className="sm:col-span-2 lg:col-span-4">
        <button onClick={save} disabled={pending} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
          {pending ? "Saving…" : "Save"}
        </button>
        {msg ? <span className="ml-3 text-sm text-slate-500">{msg}</span> : null}
        <p className="mt-2 text-xs text-slate-400">Per-centre discounts, free months and custom prices are set on each centre&apos;s page.</p>
      </div>
    </div>
  );
}
