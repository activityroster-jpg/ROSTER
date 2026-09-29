"use client";

import { useState, useTransition } from "react";
import { startCheckoutAction } from "@/app/(app)/office/billing/actions";
import { currencySymbol } from "@/lib/pricing";

export function PlanChoice({
  monthly, annual, currency, monthsFree, active,
}: { monthly: number; annual: number; currency: string; monthsFree: number; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [which, setWhich] = useState<string | null>(null);
  const sym = currencySymbol(currency);

  const go = (interval: "monthly" | "annual") => {
    setErr(null); setWhich(interval);
    startTransition(async () => {
      const res = await startCheckoutAction(interval);
      if (res.ok && res.url) window.location.href = res.url;
      else { setErr(res.error ?? "Could not start checkout"); setWhich(null); }
    });
  };

  const btn = "mt-4 w-full rounded-lg bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50";

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-card border border-slate-200 p-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Monthly</p>
          <p className="mt-2"><span className="font-display text-3xl font-bold text-navy">{sym}{monthly}</span><span className="ml-1 text-slate-500">/mo</span></p>
          <button onClick={() => go("monthly")} disabled={pending} className={btn}>
            {pending && which === "monthly" ? "Starting…" : active ? "Switch to monthly" : "Choose monthly"}
          </button>
        </div>
        <div className="relative rounded-card border-2 border-teal p-6 text-center">
          {monthsFree > 0 ? <span className="absolute right-3 top-3 rounded-full bg-starboard/15 px-2 py-0.5 text-[11px] font-semibold text-starboard">{monthsFree} month{monthsFree === 1 ? "" : "s"} free</span> : null}
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Annual</p>
          <p className="mt-2"><span className="font-display text-3xl font-bold text-navy">{sym}{annual}</span><span className="ml-1 text-slate-500">/yr</span></p>
          <button onClick={() => go("annual")} disabled={pending} className={btn}>
            {pending && which === "annual" ? "Starting…" : active ? "Switch to annual" : "Choose annual"}
          </button>
        </div>
      </div>
      {err ? <p className="mt-3 text-sm text-port">{err}</p> : null}
      <p className="mt-3 text-xs text-slate-400">Secure checkout by Stripe. VAT is added at checkout for business customers. A VAT invoice is emailed to you and available to download below after each payment. Promo/discount codes can be entered at checkout.</p>
    </div>
  );
}
