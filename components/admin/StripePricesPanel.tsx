"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refreshStripePricesAction } from "@/app/admin/actions";

export interface PriceCheckRow {
  kind: string;
  label: string;
  /** What the site/platform advertises, in major units (e.g. 35), or null if not advertised. */
  advertised: number | null;
  /** What Stripe will charge, in major units, or null if unknown / not found. */
  stripeAmount: number | null;
  currency: string | null;
  priceId: string | null;
  productName: string | null;
  source: "env" | "stripe" | null;
}

const fmt = (n: number | null, cur: string | null) => (n == null ? "—" : `${cur?.toUpperCase() === "EUR" ? "€" : cur?.toUpperCase() === "USD" ? "$" : "£"}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);

/**
 * Which Stripe price each plan/add-on resolves to, with Stripe's amount beside
 * what we advertise. Red = not found or amounts differ; fix in Stripe (or set
 * the STRIPE_PRICE_* override) rather than here.
 */
export function StripePricesPanel({ rows, stripeReady }: { rows: PriceCheckRow[]; stripeReady: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const refresh = () => start(async () => {
    const r = await refreshStripePricesAction();
    setMsg(r.ok ? r.message ?? "Refreshed" : r.error ?? "Could not refresh");
    router.refresh();
  });
  const problems = rows.filter((r) => !r.priceId || (r.advertised != null && r.stripeAmount != null && Math.abs(r.advertised - r.stripeAmount) > 0.005)).length;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        {!stripeReady ? <span className="text-xs text-port">Stripe isn&apos;t configured (STRIPE_SECRET_KEY).</span>
          : problems ? <span className="rounded-full bg-port/15 px-2 py-0.5 text-xs font-semibold text-port">{problems} to fix</span>
          : <span className="rounded-full bg-starboard/15 px-2 py-0.5 text-xs font-semibold text-starboard">All prices match</span>}
        <button type="button" onClick={refresh} disabled={pending} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">{pending ? "…" : "Re-check Stripe"}</button>
        {msg ? <span className="text-xs text-slate-500">{msg}</span> : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="py-2 pr-3">Plan / add-on</th><th className="py-2 pr-3">We advertise</th><th className="py-2 pr-3">Stripe charges</th><th className="py-2 pr-3">Stripe product</th><th className="py-2 pr-3">Price id</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const missing = !r.priceId;
              const mismatch = !missing && r.advertised != null && r.stripeAmount != null && Math.abs(r.advertised - r.stripeAmount) > 0.005;
              return (
                <tr key={r.kind} className={missing || mismatch ? "bg-port/5" : ""}>
                  <td className="py-2 pr-3 font-medium text-navy">{r.label}</td>
                  <td className="py-2 pr-3 text-slate-600">{fmt(r.advertised, r.currency ?? "gbp")}</td>
                  <td className={`py-2 pr-3 ${mismatch ? "font-semibold text-port" : "text-slate-600"}`}>{missing ? <span className="text-port">Not found in Stripe</span> : fmt(r.stripeAmount, r.currency)}</td>
                  <td className="py-2 pr-3 text-slate-600">{r.productName ?? "—"}{r.source === "env" ? <span className="ml-1 text-[10px] text-slate-400">(env)</span> : null}</td>
                  <td className="py-2 pr-3 font-mono text-[11px] text-slate-400">{r.priceId ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400">Prices are matched by product name (“Small Club Plan”, “Standard Plan”, “Custom Package”, “UK Onsite Daily Consultancy”) and billing interval, and cached for an hour. Checkout always charges the Stripe amount — if it differs from what we advertise, change one of them.</p>
    </div>
  );
}
