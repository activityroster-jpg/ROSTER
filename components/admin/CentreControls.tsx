"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setOrgStatusAction, setOrgTierAction, setPlanAction, setSubscriptionStatusAction } from "@/app/admin/actions";
import { TIER_ORDER, tierMeta } from "@/lib/tiers";

const ORG_STATUS = ["active", "suspended", "pending", "cancelled"];
const SUB_STATUS = ["trialing", "active", "past_due", "canceled", "unpaid"];
const PLANS = ["rostering", "full"];

export function CentreControls({
  id,
  status,
  subscriptionStatus,
  plan,
  tier,
}: {
  id: string;
  status: string;
  subscriptionStatus: string | null;
  plan: string;
  tier: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setMsg(res.error ?? "Failed");
      else router.refresh();
    });
  };

  const field = "rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs font-semibold text-slate-500">Pricing tier
        <select defaultValue={tier} disabled={pending} onChange={(e) => run(() => setOrgTierAction(id, e.target.value))} className={`mt-1 block w-full ${field}`}>
          {TIER_ORDER.map((tid) => {
            const m = tierMeta(tid);
            return <option key={tid} value={tid}>{m.name} — £{m.monthlyPrice}/mo{m.userCap ? ` (≤${m.userCap})` : " (unlimited)"}</option>;
          })}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-500">Centre status
        <select defaultValue={status} disabled={pending} onChange={(e) => run(() => setOrgStatusAction(id, e.target.value))} className={`mt-1 block w-full ${field}`}>
          {ORG_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-500">Subscription
        <select defaultValue={subscriptionStatus ?? "trialing"} disabled={pending} onChange={(e) => run(() => setSubscriptionStatusAction(id, e.target.value))} className={`mt-1 block w-full ${field}`}>
          {SUB_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-500">Plan
        <select defaultValue={plan} disabled={pending} onChange={(e) => run(() => setPlanAction(id, e.target.value))} className={`mt-1 block w-full ${field}`}>
          {PLANS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      {msg ? <p className="text-sm text-port sm:col-span-2 lg:col-span-4">{msg}</p> : <p className="text-xs text-slate-400 sm:col-span-2 lg:col-span-4">Changes save immediately. Suspending a centre blocks its members from signing in. Small Club is hard-capped at {tierMeta("small_club").userCap} people.</p>}
    </div>
  );
}
