"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPromoCodeAction } from "@/app/admin/actions";
import type { PromoCodeRow } from "@/lib/billing/coupons";

export function PromoCodes({ codes, stripeReady }: { codes: PromoCodeRow[]; stripeReady: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [code, setCode] = useState("");
  const [kind, setKind] = useState("free_months");
  const [value, setValue] = useState("2");
  const [max, setMax] = useState("");

  const create = (payload: { code: string; kind: string; value: number; maxRedemptions?: number }) => {
    setMsg(null);
    startTransition(async () => {
      const res = await createPromoCodeAction(payload);
      if (res.ok) { setMsg({ ok: true, text: `Created code ${res.code}` }); setCode(""); router.refresh(); }
      else setMsg({ ok: false, text: res.error ?? "Failed" });
    });
  };

  const field = "rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <div>
      {!stripeReady ? (
        <p className="mb-3 rounded-lg bg-amber/10 px-3 py-2 text-sm text-slate-600">Connect Stripe (set the secret key) to create and list promo codes.</p>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={() => create({ code: "2MONTHSFREE", kind: "free_months", value: 2 })} disabled={pending} className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
          Quick-create “2MONTHSFREE” (2 months free)
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-5 sm:items-end">
        <label className="text-xs font-semibold text-slate-500 sm:col-span-2">Code
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SUMMER25" className={`mt-1 block w-full ${field}`} />
        </label>
        <label className="text-xs font-semibold text-slate-500">Type
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={`mt-1 block w-full ${field}`}>
            <option value="free_months">Months free</option>
            <option value="percent">% off</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-500">{kind === "free_months" ? "Months" : "Percent"}
          <input value={value} onChange={(e) => setValue(e.target.value)} type="number" min="1" className={`mt-1 block w-full ${field}`} />
        </label>
        <label className="text-xs font-semibold text-slate-500">Max uses (blank = ∞)
          <input value={max} onChange={(e) => setMax(e.target.value)} type="number" min="1" className={`mt-1 block w-full ${field}`} />
        </label>
        <div className="sm:col-span-5">
          <button onClick={() => create({ code, kind, value: Number(value), maxRedemptions: max ? Number(max) : undefined })} disabled={pending || !code} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50">
            {pending ? "Creating…" : "Create code"}
          </button>
          {msg ? <span className={`ml-3 text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</span> : null}
        </div>
      </div>

      {codes.length > 0 ? (
        <table className="mt-5 w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Discount</th><th className="px-3 py-2">Used</th><th className="px-3 py-2">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {codes.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-2 font-mono font-semibold text-navy">{c.code}</td>
                <td className="px-3 py-2 text-slate-600">{c.coupon}</td>
                <td className="px-3 py-2 text-slate-600">{c.timesRedeemed}{c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ""}</td>
                <td className="px-3 py-2">{c.active ? <span className="text-starboard">Active</span> : <span className="text-slate-400">Inactive</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
