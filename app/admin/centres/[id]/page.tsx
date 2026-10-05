import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { apexDomain } from "@/lib/config";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { effectivePricing } from "@/lib/pricing";
import { tierMeta } from "@/lib/tiers";
import { CentreControls } from "@/components/admin/CentreControls";
import { EraseCentre } from "@/components/admin/EraseCentre";
import { RemoveTestCentre } from "@/components/admin/RemoveTestCentre";
import { leavingDeadline } from "@/lib/services/leaving";
import { PricingControls } from "@/components/admin/PricingControls";
import { Card } from "@/components/ui";
import { GhostModeCard, type GhostSessionRow } from "@/components/admin/GhostModeCard";
import { TrialControls } from "@/components/admin/TrialControls";
import { trialEndsAt, trialState } from "@/lib/billing/trial";
import { getRepositories } from "@/lib/cf/bindings";
import { TransferOwner } from "@/components/admin/TransferOwner";
import { fairUseSettings, headcount } from "@/lib/services/fair-use";

export const dynamic = "force-dynamic";

export default async function CentreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePlatformAdmin();
  const db = await getDb();
  const platform = new PlatformRepository(db);

  const org = await platform.organisationById(id);
  if (!org) {
    return (
      <Card>
        <p className="text-sm text-slate-600">Centre not found.</p>
        <Link href="/admin" className="mt-2 inline-block text-sm font-semibold text-teal hover:underline">← Back to overview</Link>
      </Card>
    );
  }

  const [usage, members, pricing] = await Promise.all([platform.usageByOrg(), platform.membersFor(id), platform.getPricing()]);
  const { control } = await getRepositories();
  const fairUse = await fairUseSettings(db);
  let people: number | null = null;
  try { people = await headcount(db, org); } catch { /* cosmetic */ }
  const officeMembers = await control.officeMembersForOrg(id);
  const ghostRows = await control.listGhostVisits(id, 10);
  const ghostSessions: GhostSessionRow[] = await Promise.all(ghostRows.map(async (r) => ({
    id: r.id,
    kind: r.kind,
    at: r.createdAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }),
    who: (await control.userById(r.userId))?.email ?? null,
  })));
  const u = usage.get(id) ?? { instructors: 0, courses: 0, sessions: 0 };
  const apex = apexDomain();
  const eff = effectivePricing(org, pricing);
  const trial = trialState(org, pricing.trialDays);
  const trialEnds = new Date(trialEndsAt(org, pricing.trialDays));
  const trialLabel = trial.kind === "paid" ? "Paying — the trial clock doesn't apply." : trial.kind === "trial" ? `On trial — ${trial.daysLeft} day${trial.daysLeft === 1 ? "" : "s"} left (ends ${trialEnds.toLocaleDateString("en-GB")}).` : trial.kind === "read_only" ? `Trial ended ${trialEnds.toLocaleDateString("en-GB")} — read-only, locks in ${trial.daysUntilLock} day${trial.daysUntilLock === 1 ? "" : "s"}.` : `Trial ended ${trialEnds.toLocaleDateString("en-GB")} — locked.`;

  const Row = ({ k, v }: { k: string; v: string }) => (
    <div className="flex justify-between border-t border-slate-100 py-2 text-sm first:border-t-0">
      <span className="text-slate-500">{k}</span><span className="font-medium text-navy">{v}</span>
    </div>
  );

  return (
    <div>
      <Link href="/admin" className="text-sm text-slate-400 hover:text-slate-600">← Overview</Link>
      <div className="mb-6 mt-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy">{org.name}</h1>
          <a href={`https://${org.slug}.${apex}`} className="text-sm text-teal hover:underline">{org.slug}.{apex}</a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-semibold text-navy">Billing &amp; subscription</h2>
          <Row k="Tier" v={`${tierMeta(org.tier).name}${tierMeta(org.tier).userCap ? ` (≤${tierMeta(org.tier).userCap})` : " (unlimited)"}`} />
          <Row k="People" v={people == null ? "–" : `${people}${people >= fairUse.fairUsePeople ? ` · over the fair use figure (${fairUse.fairUsePeople})` : people >= fairUse.fairUseAlertAt ? ` · past the alert level (${fairUse.fairUseAlertAt})` : ""}`} />
          <Row k="Plan" v={org.plan} />
          <Row k="Subscription" v={org.subscriptionStatus ?? "—"} />
          <Row k="Centre status" v={org.status} />
          <Row k="Stripe customer" v={org.stripeCustomerId ?? "— (no card on file)"} />
          <Row k="Stripe subscription" v={org.stripeSubscriptionId ?? "—"} />
          <Row k="Joined" v={org.createdAt.toISOString().slice(0, 10)} />
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold text-navy">Usage</h2>
          <Row k="Instructors" v={tierMeta(org.tier).userCap ? `${u.instructors} / ${tierMeta(org.tier).userCap}` : String(u.instructors)} />
          <Row k="Courses" v={String(u.courses)} />
          <Row k="Sessions" v={String(u.sessions)} />
          <Row k="Jurisdiction" v={org.jurisdiction} />
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="mb-1 font-semibold text-navy">Free trial</h2>
        <p className="mb-3 text-xs text-slate-500">After the trial the centre goes read-only for two weeks, then locks until they add payment. Extend it here when you&apos;ve agreed to.</p>
        <TrialControls id={org.id} state={trialLabel} endsIso={trialEnds.toISOString().slice(0, 10)} />
      </Card>

      <Card className="mt-6">
        <h2 className="mb-3 font-semibold text-navy">Ghost Mode</h2>
        <GhostModeCard orgId={org.id} centreName={org.name} sessions={ghostSessions} />
      </Card>

      <Card className="mt-6">
        <h2 className="mb-3 font-semibold text-navy">Manage</h2>
        <CentreControls id={org.id} status={org.status} subscriptionStatus={org.subscriptionStatus} plan={org.plan} tier={org.tier} />
        <EraseCentre id={org.id} slug={org.slug} status={org.status} deadline={leavingDeadline(org)?.toISOString() ?? null} />
        <div className="mt-4">
          <RemoveTestCentre id={org.id} slug={org.slug} members={members.length} liveSubscription={Boolean(org.stripeSubscriptionId) && ["trialing", "active", "past_due", "unpaid", "incomplete"].includes(org.subscriptionStatus ?? "")} />
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="mb-1 font-semibold text-navy">Superadmin</h2>
        <TransferOwner id={org.id} members={officeMembers.map((m) => ({ userId: m.userId, name: m.name, email: m.email, role: m.role as string, status: m.status }))} />
      </Card>

      <Card className="mt-6">
        <h2 className="mb-3 font-semibold text-navy">Pricing &amp; discounts</h2>
        <PricingControls
          id={org.id}
          discountPercent={org.discountPercent}
          customMonthlyPrice={org.customMonthlyPrice}
          customAnnualPrice={org.customAnnualPrice}
          freeMonths={org.freeMonths}
          billingNote={org.billingNote}
          effMonthly={eff.monthly}
          effAnnual={eff.annual}
          currency={eff.currency}
        />
      </Card>

      <Card className="mt-6 p-0">
        <h2 className="px-4 pt-4 font-semibold text-navy">Members</h2>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No members.</td></tr>
            ) : (
              members.map((m) => (
                <tr key={m.email}>
                  <td className="px-4 py-3 font-medium text-navy">{m.name}</td>
                  <td className="px-4 py-3 text-slate-600">{m.email}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{m.role}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{m.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
