"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setOrgPricingAction } from "@/app/admin/actions";
import { currencySymbol } from "@/lib/pricing";

export function PricingControls({
  id, discountPercent, customMonthlyPrice, customAnnualPrice, freeMonths, billingNote,
  effMonthly, effAnnual, currency,
}: {
  id: string;
  discountPercent: number;
  customMonthlyPrice: number | null;
  customAnnualPrice: number | null;
  freeMonths: number;
  billingNote: string | null;
  effMonthly: number;
  effAnnual: number;
  currency: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [disc, setDisc] = useState(String(discountPercent));
  const [cm, setCm] = useState(customMonthlyPrice != null ? String(customMonthlyPrice) : "");
  const [ca, setCa] = useState(customAnnualPrice != null ? String(customAnnualPrice) : "");
  const [free, setFree] = useState(String(freeMonths));
  const [note, setNote] = useState(billingNote ?? "");
  const sym = currencySymbol(currency);

  const save = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await setOrgPricingAction(id, {
        discountPercent: Number(disc) || 0,
        customMonthlyPrice: cm.trim() === "" ? null : Number(cm),
        customAnnualPrice: ca.trim() === "" ? null : Number(ca),
        freeMonths: Number(free) || 0,
        billingNote: note,
      });
      if (res.ok) { setMsg("Saved"); router.refresh(); } else setMsg(res.error ?? "Failed");
    });
  };
  const field = "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <div>
      <p className="mb-3 rounded-lg bg-canvas px-3 py-2 text-sm text-slate-600">
        This centre currently pays <span className="font-semibold text-navy">{sym}{effMonthly}/mo</span> or <span className="font-semibold text-navy">{sym}{effAnnual}/yr</span>.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs font-semibold text-slate-500">Discount %
          <input value={disc} onChange={(e) => setDisc(e.target.value)} type="number" min="0" max="100" className={field} />
        </label>
        <label className="text-xs font-semibold text-slate-500">Custom monthly ({sym}) — overrides discount
          <input value={cm} onChange={(e) => setCm(e.target.value)} type="number" min="0" step="0.01" placeholder="default" className={field} />
        </label>
        <label className="text-xs font-semibold text-slate-500">Custom annual ({sym})
          <input value={ca} onChange={(e) => setCa(e.target.value)} type="number" min="0" step="0.01" placeholder="default" className={field} />
        </label>
        <label className="text-xs font-semibold text-slate-500">Free months
          <input value={free} onChange={(e) => setFree(e.target.value)} type="number" min="0" className={field} />
        </label>
        <label className="text-xs font-semibold text-slate-500 sm:col-span-2">Billing note
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. launch partner, 3 months free" className={field} />
        </label>
      </div>
      <div className="mt-3">
        <button onClick={save} disabled={pending} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
          {pending ? "Saving…" : "Save pricing"}
        </button>
        {msg ? <span className="ml-3 text-sm text-slate-500">{msg}</span> : null}
      </div>
    </div>
  );
}
