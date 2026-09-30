import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { effectivePricing, fmtMoney } from "@/lib/pricing";
import { getEnv } from "@/lib/cf/bindings";
import { createStripe } from "@/lib/billing/stripe";
import { listPromotionCodes, type PromoCodeRow } from "@/lib/billing/coupons";
import { GlobalPricingForm } from "@/components/admin/GlobalPricingForm";
import { PromoCodes } from "@/components/admin/PromoCodes";
import { Card, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

const subTone = (s: string | null): "covered" | "attention" | "conflict" | "neutral" => {
  if (s === "active") return "covered";
  if (s === "trialing") return "attention";
  if (s === "past_due" || s === "canceled" || s === "cancelled" || s === "unpaid") return "conflict";
  return "neutral";
};
const statusTone = (s: string): "covered" | "attention" | "conflict" | "neutral" => {
  if (s === "active") return "covered";
  if (s === "suspended" || s === "cancelled") return "conflict";
  if (s === "pending") return "attention";
  return "neutral";
};

export default async function AdminOverviewPage() {
  await requirePlatformAdmin();
  const db = await getDb();
  const platform = new PlatformRepository(db);
  const [orgs, usage, pricing] = await Promise.all([platform.listOrganisations(), platform.usageByOrg(), platform.getPricing()]);

  // Marketing promo codes (best-effort; needs Stripe configured).
  let promoCodes: PromoCodeRow[] = [];
  let stripeReady = false;
  try {
    const stripe = createStripe(getEnv());
    stripeReady = true;
    promoCodes = await listPromotionCodes(stripe);
  } catch { stripeReady = false; }

  const total = orgs.length;
  const active = orgs.filter((o) => o.subscriptionStatus === "active").length;
  const trialing = orgs.filter((o) => o.subscriptionStatus === "trialing").length;
  const suspended = orgs.filter((o) => o.status === "suspended").length;
  const mrr = orgs
    .filter((o) => o.subscriptionStatus === "active")
    .reduce((sum, o) => sum + effectivePricing(o, pricing).monthly, 0);

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-bold text-navy">Overview</h1>
      <p className="mb-6 text-sm text-slate-500">All centres on the platform, their billing and usage.</p>

      <div className="mb-8 grid gap-3 sm:grid-cols-4">
        <Card><p className="text-xs font-semibold text-navy">Centres</p><p className="mt-1 text-2xl font-semibold text-navy">{total}</p></Card>
        <Card><p className="text-xs font-semibold text-navy">Paying</p><p className="mt-1 text-2xl font-semibold text-starboard">{active}</p><p className="text-xs text-slate-400">{trialing} on trial</p></Card>
        <Card><p className="text-xs font-semibold text-navy">Est. MRR</p><p className="mt-1 text-2xl font-semibold text-navy">{fmtMoney(mrr, pricing.currency)}</p><p className="text-xs text-slate-400">{fmtMoney(mrr * 12, pricing.currency)}/yr</p></Card>
        <Card><p className="text-xs font-semibold text-navy">Suspended</p><p className="mt-1 text-2xl font-semibold text-port">{suspended}</p></Card>
      </div>

      <Card className="mb-8">
        <h2 className="mb-1 font-semibold text-navy">Default pricing</h2>
        <p className="mb-4 text-xs text-slate-500">Set once here; every centre inherits it unless you give them a discount or custom price on their page.</p>
        <GlobalPricingForm monthlyPrice={pricing.monthlyPrice} annualPrice={pricing.annualPrice} currency={pricing.currency} trialDays={pricing.trialDays} freeFirstMonth={Boolean(pricing.freeFirstMonth)} setupPrice={pricing.setupPrice} setupEnabled={Boolean(pricing.setupEnabled)} />
      </Card>

      <Card className="mb-8">
        <h2 className="mb-1 font-semibold text-navy">Marketing promo codes</h2>
        <p className="mb-4 text-xs text-slate-500">Shareable codes centres enter at checkout. Per-centre discounts set on a centre&apos;s page apply automatically without a code.</p>
        <PromoCodes codes={promoCodes} stripeReady={stripeReady} />
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Centre</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Billing</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Courses</th>
              <th className="px-4 py-3">Bookings</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orgs.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">No centres yet.</td></tr>
            ) : (
              orgs.map((o) => {
                const u = usage.get(o.id) ?? { instructors: 0, courses: 0, bookings: 0, sessions: 0 };
                return (
                  <tr key={o.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <Link href={`/admin/centres/${o.id}`} className="font-medium text-teal hover:underline">{o.name}</Link>
                      <span className="block text-xs text-slate-400">{o.slug} · {o.jurisdiction}</span>
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600">{o.plan}</td>
                    <td className="px-4 py-3"><StatusPill tone={subTone(o.subscriptionStatus)}>{o.subscriptionStatus ?? "—"}</StatusPill></td>
                    <td className="px-4 py-3"><StatusPill tone={statusTone(o.status)}>{o.status}</StatusPill></td>
                    <td className="px-4 py-3 text-slate-600">{u.instructors}</td>
                    <td className="px-4 py-3 text-slate-600">{u.courses}</td>
                    <td className="px-4 py-3 text-slate-600">{u.bookings}</td>
                    <td className="px-4 py-3 text-slate-500">{o.createdAt.toISOString().slice(0, 10)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
