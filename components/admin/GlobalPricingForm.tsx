"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setGlobalPricingAction } from "@/app/admin/actions";

export function GlobalPricingForm({
  monthlyPrice, annualPrice, currency, trialDays, freeFirstMonth,
}: { monthlyPrice: number; annualPrice: number; currency: string; trialDays: number; freeFirstMonth: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [m, setM] = useState(String(monthlyPrice));
  const [a, setA] = useState(String(annualPrice));
  const [cur, setCur] = useState(currency);
  const [trial, setTrial] = useState(String(trialDays));
  const [free, setFree] = useState(freeFirstMonth);

  const save = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await setGlobalPricingAction({ monthlyPrice: Number(m), annualPrice: Number(a), currency: cur, trialDays: Number(trial), freeFirstMonth: free });
      if (res.ok) { setMsg("Saved"); router.refresh(); } else setMsg(res.error ?? "Failed");
    });
  };
  const field = "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs font-semibold text-slate-500">Monthly price
        <input value={m} onChange={(e) => setM(e.target.value)} type="number" min="0" step="0.01" className={field} />
      </label>
      <label className="text-xs font-semibold text-slate-500">Annual price
        <input value={a} onChange={(e) => setA(e.target.value)} type="number" min="0" step="0.01" className={field} />
      </label>
      <label className="text-xs font-semibold text-slate-500">Currency
        <select value={cur} onChange={(e) => setCur(e.target.value)} className={field}>
          <option value="GBP">GBP £</option><option value="EUR">EUR €</option><option value="USD">USD $</option>
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-500">Free trial (days)
        <input value={trial} onChange={(e) => setTrial(e.target.value)} type="number" min="0" className={field} />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2">
        <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
        First month free
      </label>
      <div className="sm:col-span-2 lg:col-span-4">
        <button onClick={save} disabled={pending} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
          {pending ? "Saving…" : "Save pricing"}
        </button>
        {msg ? <span className="ml-3 text-sm text-slate-500">{msg}</span> : null}
        <p className="mt-2 text-xs text-slate-400">This is the default every centre inherits. Set per-centre discounts or custom prices on each centre&apos;s page. When Stripe is connected these values drive checkout.</p>
      </div>
    </div>
  );
}
