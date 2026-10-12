"use client";

import { useState, useTransition } from "react";
import { startSetupCheckoutAction } from "@/app/(app)/office/billing/actions";

export function SetupServiceCard({
  price, onsitePrice, purchased,
}: { price: string; onsitePrice?: string; purchased: boolean }) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [onsite, setOnsite] = useState(true);

  const buy = () => {
    setErr(null);
    startTransition(async () => {
      const res = await startSetupCheckoutAction(onsite);
      if (res.ok && res.url) window.location.href = res.url;
      else setErr(res.error ?? "Could not start checkout");
    });
  };

  if (purchased) {
    return (
      <p className="text-sm text-slate-600">
        ✅ You&apos;ve bought the custom platform build — we&apos;ll be in touch to plan how you want it to work.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-slate-600">
        Every centre runs differently. For a one-off <span className="font-semibold text-navy">{price}</span> we shape the
        platform to the way yours works: we add the features you need, remove the ones you don&apos;t, and change how
        things behave to fit your workflow, so the roster, checks and app do things your way, not a generic way. Your
        data comes across too. Tell us how you work; we make it work like that. You stay on your normal plan afterwards.
      </p>
      {onsitePrice ? (
        <label className="mb-3 flex items-start gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={onsite} onChange={(e) => setOnsite(e.target.checked)} className="mt-1" />
          <span>Add an on-site day (<span className="font-semibold text-navy">{onsitePrice}</span>) — we come and work with your team in person. <span className="text-slate-400">Recommended.</span></span>
        </label>
      ) : null}
      <button onClick={buy} disabled={pending} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-navy hover:bg-amber-400 disabled:opacity-60">
        {pending ? "Starting…" : `Get the custom build — ${price}${onsite && onsitePrice ? ` + ${onsitePrice}` : ""}`}
      </button>
      {err ? <span className="ml-3 text-sm text-port">{err}</span> : null}
    </div>
  );
}
