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
import { StripePricesPanel, type PriceCheckRow } from "@/components/admin/StripePricesPanel";
import { PRICE_KINDS, priceLabel, resolvePrices } from "@/lib/billing/prices";
import { TIERS } from "@/lib/tiers";
import { ON_SITE_DAY_PRICE } from "@/lib/pricing";
import { Card, StatusPill } from "@/components/ui";
import { fmtBytes, readLastBackup } from "@/lib/ops/backup-status";
import { trialState } from "@/lib/billing/trial";

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

const DAY = 86_400_000;
const ago = (d: Date | undefined, now: number) => {
  if (!d) return "—";
  const days = Math.floor((now - d.getTime()) / DAY);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days}d ago` : days < 365 ? `${Math.floor(days / 30)}mo ago` : `${Math.floor(days / 365)}y ago`;
};

export default async function AdminOverviewPage({ searchParams }: { searchParams: Promise<{ q?: string; show?: string }> }) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();
  const show = sp.show === "attention" ? "attention" : sp.show === "trial" ? "trial" : sp.show === "quiet" ? "quiet" : "all";
  const db = await getDb();
  const platform = new PlatformRepository(db);
  const [allOrgs, usage, pricing, owners, lastActivity] = await Promise.all([platform.listOrganisations(), platform.usageByOrg(), platform.getPricing(), platform.ownerEmailByOrg(), platform.lastActivityByOrg()]);
  const now = Date.now();
  const needsAttention = (o: (typeof allOrgs)[number]) => {
    const tr = trialState(o, pricing.trialDays);
    return o.status === "suspended" || o.subscriptionStatus === "past_due" || o.subscriptionStatus === "unpaid" || tr.kind === "read_only" || tr.kind === "locked" || (tr.kind === "trial" && tr.daysLeft <= 7);
  };
  const quiet = (o: (typeof allOrgs)[number]) => { const d = lastActivity.get(o.id); return !d || now - d.getTime() > 14 * DAY; };
  const orgs = allOrgs.filter((o) => {
    if (q && !`${o.name} ${o.slug} ${owners.get(o.id) ?? ""}`.toLowerCase().includes(q)) return false;
    if (show === "attention") return needsAttention(o);
    if (show === "trial") return trialState(o, pricing.trialDays).kind !== "paid";
    if (show === "quiet") return quiet(o);
    return true;
  });

  // Marketing promo codes (best-effort; needs Stripe configured).
  let promoCodes: PromoCodeRow[] = [];
  let stripeReady = false;
  try {
    const stripe = createStripe(getEnv());
    stripeReady = true;
    promoCodes = await listPromotionCodes(stripe);
  } catch { stripeReady = false; }

  // What each plan/add-on resolves to in Stripe vs what we advertise.
  const resolved = await resolvePrices(getEnv());
  const advertised: Record<string, number | null> = {
    small_club_monthly: TIERS.small_club.monthlyPrice,
    small_club_annual: TIERS.small_club.annualPrice,
    standard_monthly: TIERS.standard.monthlyPrice,
    standard_annual: TIERS.standard.annualPrice,
    setup: pricing.setupPrice,
    onsite_day: ON_SITE_DAY_PRICE,
  };
  const priceRows: PriceCheckRow[] = PRICE_KINDS.map((kind) => {
    const r = resolved[kind];
    return {
      kind,
      label: priceLabel(kind),
      advertised: advertised[kind] ?? null,
      stripeAmount: r?.unitAmount != null ? r.unitAmount / 100 : null,
      currency: r?.currency ?? pricing.currency,
      priceId: r?.id ?? null,
      productName: r?.productName ?? null,
      source: r?.source ?? null,
    };
  });

  const total = allOrgs.length;
  const active = allOrgs.filter((o) => o.subscriptionStatus === "active").length;
  const trialing = allOrgs.filter((o) => o.subscriptionStatus === "trialing").length;
  const suspended = allOrgs.filter((o) => o.status === "suspended").length;
  const attention = allOrgs.filter(needsAttention).length;
  const mrr = allOrgs
    .filter((o) => o.subscriptionStatus === "active")
    .reduce((sum, o) => sum + effectivePricing(o, pricing).monthly, 0);

  const lastBackup = await readLastBackup();
  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-bold text-navy">Overview</h1>
      <p className="mb-6 text-sm text-slate-500">Dev Center · all centres on the platform, their billing and usage.</p>

      <div className="mb-8 grid gap-3 sm:grid-cols-4">
        <Card><p className="text-xs font-semibold text-navy">Centres</p><p className="mt-1 text-2xl font-semibold text-navy">{total}</p></Card>
        <Card><p className="text-xs font-semibold text-navy">Paying</p><p className="mt-1 text-2xl font-semibold text-starboard">{active}</p><p className="text-xs text-slate-400">{trialing} on trial</p></Card>
        <Card><p className="text-xs font-semibold text-navy">Est. MRR</p><p className="mt-1 text-2xl font-semibold text-navy">{fmtMoney(mrr, pricing.currency)}</p><p className="text-xs text-slate-400">{fmtMoney(mrr * 12, pricing.currency)}/yr</p></Card>
        <Card>
          <p className="text-xs font-semibold text-navy">Last backup</p>
          {lastBackup ? (
            <>
              <p className={`mt-1 text-2xl font-semibold ${lastBackup.ok ? "text-starboard" : "text-port"}`}>{lastBackup.ok ? "OK" : "Failed"}</p>
              <p className="text-xs text-slate-400">{new Date(lastBackup.at).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" })} · {fmtBytes(lastBackup.bytes)}{lastBackup.offsite ? " · off-site ✓" : " · no off-site copy"}</p>
            </>
          ) : (
            <>
              <p className="mt-1 text-2xl font-semibold text-slate-400">None yet</p>
              <p className="text-xs text-slate-400">Runs nightly at 02:30 UTC once BACKUP_PASSPHRASE is set in GitHub.</p>
            </>
          )}
        </Card>
        <Card><p className="text-xs font-semibold text-navy">Suspended</p><p className="mt-1 text-2xl font-semibold text-port">{suspended}</p></Card>
      </div>

      <Card className="mb-8">
        <h2 className="mb-1 font-semibold text-navy">Pricing</h2>
        <p className="mb-4 text-xs text-slate-500">The two plans, the free trial and the custom package. Discounts and custom prices live on each centre&apos;s page.</p>
        <GlobalPricingForm currency={pricing.currency} trialDays={pricing.trialDays} freeFirstMonth={Boolean(pricing.freeFirstMonth)} setupPrice={pricing.setupPrice} setupEnabled={Boolean(pricing.setupEnabled)} />
      </Card>

      <Card className="mb-8">
        <h2 className="mb-1 font-semibold text-navy">Stripe prices</h2>
        <p className="mb-3 text-xs text-slate-500">Checkout charges these. They&apos;re found on your Stripe account automatically; this shows what was found next to what the site advertises.</p>
        <StripePricesPanel rows={priceRows} stripeReady={stripeReady} />
      </Card>

      <Card className="mb-8">
        <h2 className="mb-1 font-semibold text-navy">Marketing promo codes</h2>
        <p className="mb-4 text-xs text-slate-500">Shareable codes centres enter at checkout. Per-centre discounts set on a centre&apos;s page apply automatically without a code.</p>
        <PromoCodes codes={promoCodes} stripeReady={stripeReady} />
      </Card>

      <form method="get" className="mb-3 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Search centres, web address or email…" className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-teal" aria-label="Search centres" />
        <div className="flex rounded-lg border border-slate-200 p-0.5 text-sm">
          {([["all", `All (${total})`], ["attention", `Needs attention (${attention})`], ["trial", "On trial"], ["quiet", "Quiet 14d+"]] as const).map(([k, label]) => (
            <button key={k} type="submit" name="show" value={k} className={`rounded-md px-3 py-1 font-medium ${show === k ? "bg-navy text-white" : "text-slate-500 hover:text-navy"}`}>{label}</button>
          ))}
        </div>
        {q || show !== "all" ? <Link href="/admin" className="text-sm text-slate-500 hover:text-navy">Clear</Link> : null}
      </form>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Centre</th>
              <th className="px-4 py-3">Signup email</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Billing</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Trial</th>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Courses</th>
              <th className="px-4 py-3">Bookings</th>
              <th className="px-4 py-3">Last active</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orgs.length === 0 ? (
              <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-400">{allOrgs.length === 0 ? "No centres yet." : "No centres match."}</td></tr>
            ) : (
              orgs.map((o) => {
                const u = usage.get(o.id) ?? { instructors: 0, courses: 0, bookings: 0, sessions: 0 };
                const tr = trialState(o, pricing.trialDays);
                const trialCell = tr.kind === "paid" ? <span className="text-slate-400">—</span>
                  : tr.kind === "trial" ? <span className={tr.daysLeft <= 7 ? "font-medium text-amber" : "text-slate-600"}>{tr.daysLeft}d left</span>
                  : tr.kind === "read_only" ? <StatusPill tone="attention">read-only · {tr.daysUntilLock}d</StatusPill>
                  : <StatusPill tone="conflict">locked</StatusPill>;
                return (
                  <tr key={o.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <Link href={`/admin/centres/${o.id}`} className="font-medium text-teal hover:underline">{o.name}</Link>
                      <span className="block text-xs text-slate-400">{o.slug} · {o.jurisdiction}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {owners.get(o.id)
                        ? <a href={`mailto:${owners.get(o.id)}`} className="text-teal hover:underline">{owners.get(o.id)}</a>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600">{o.plan}</td>
                    <td className="px-4 py-3"><StatusPill tone={subTone(o.subscriptionStatus)}>{o.subscriptionStatus ?? "—"}</StatusPill></td>
                    <td className="px-4 py-3"><StatusPill tone={statusTone(o.status)}>{o.status}</StatusPill></td>
                    <td className="px-4 py-3 text-sm">{trialCell}</td>
                    <td className="px-4 py-3 text-slate-600">{u.instructors}</td>
                    <td className="px-4 py-3 text-slate-600">{u.courses}</td>
                    <td className="px-4 py-3 text-slate-600">{u.bookings}</td>
                    <td className={`px-4 py-3 ${quiet(o) ? "text-slate-400" : "text-slate-600"}`}>{ago(lastActivity.get(o.id), now)}</td>
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
