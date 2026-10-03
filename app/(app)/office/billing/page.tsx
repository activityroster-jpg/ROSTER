import { requireTenant } from "@/lib/tenant/require";
import { getDb, getEnv } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { effectivePricing, fmtMoney, ON_SITE_DAY_PRICE } from "@/lib/pricing";
import { listInvoices, type InvoiceRow } from "@/lib/billing/invoices";
import { PlanChoice } from "@/components/office/PlanChoice";
import { SetupServiceCard } from "@/components/office/SetupServiceCard";
import { Card, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

const money = (n: number, c: string) => fmtMoney(n, c);
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ status?: string; locked?: string }> }) {
  const { organisation, trial } = await requireTenant({ role: "admin", allowReadOnly: true });
  const sp = await searchParams;
  const pricing = await new PlatformRepository(await getDb()).getPricing();
  const eff = effectivePricing(organisation, pricing);
  const monthsFree = eff.monthly > 0 ? Math.round((eff.monthly * 12 - eff.annual) / eff.monthly) : 0;

  const isPaid = organisation.subscriptionStatus === "active";
  let invoices: InvoiceRow[] = [];
  if (organisation.stripeCustomerId) {
    try { invoices = await listInvoices(getEnv(), organisation.stripeCustomerId); } catch { /* Stripe unavailable */ }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">Billing</h1>
      <p className="mb-5 text-sm text-slate-500">Your plan, payments and VAT invoices.</p>

      {trial.kind === "locked" || sp.locked === "1" ? (
        <Card className="mb-5 border-port/40 bg-port/5"><p className="text-sm font-medium text-port">Your free trial has ended and your centre is locked. Choose a plan below and everything comes straight back — nothing has been deleted.</p></Card>
      ) : trial.kind === "read_only" ? (
        <Card className="mb-5 border-amber/40 bg-amber/10"><p className="text-sm text-slate-700">Your free trial ended. Your centre is read-only for {trial.daysUntilLock} more day{trial.daysUntilLock === 1 ? "" : "s"}, then it locks. Choose a plan to carry on.</p></Card>
      ) : null}
      {sp.status === "success" ? (
        <Card className="mb-5 border-starboard/40 bg-starboard/5"><p className="text-sm font-medium text-starboard">Payment set up — thank you! Your subscription is active and your invoice is below and on its way by email.</p></Card>
      ) : sp.status === "cancelled" ? (
        <Card className="mb-5 border-amber/40 bg-amber/10"><p className="text-sm text-slate-600">Checkout cancelled — no charge was made. You can pick a plan again whenever you&apos;re ready.</p></Card>
      ) : null}

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm text-slate-500">Current status</p>
            <p className="mt-0.5 text-lg font-semibold text-navy capitalize">{organisation.subscriptionStatus ?? "trialing"}</p>
          </div>
          <StatusPill tone={isPaid ? "covered" : organisation.subscriptionStatus === "past_due" ? "conflict" : "attention"}>
            {isPaid ? "Active" : organisation.subscriptionStatus === "past_due" ? "Payment failed" : "On trial"}
          </StatusPill>
        </div>
        {organisation.stripeCustomerId ? (
          <a href="/api/billing/portal" className="mt-4 inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy hover:bg-slate-50">
            Manage billing, card &amp; cancellation →
          </a>
        ) : null}
      </Card>

      {!isPaid ? (
        <Card className="mb-6">
          <h2 className="mb-1 font-semibold text-navy">{organisation.stripeCustomerId ? "Change your plan" : "Choose your plan"}</h2>
          <p className="mb-4 text-xs text-slate-500">Keep your centre running after the free trial. Cancel anytime.</p>
          <PlanChoice monthly={eff.monthly} annual={eff.annual} currency={eff.currency} monthsFree={monthsFree} active={isPaid} />
        </Card>
      ) : null}

      {pricing.setupEnabled || organisation.setupPurchasedAt ? (
        <Card className="mb-6 border-amber/40 bg-amber/5">
          <h2 className="mb-2 font-semibold text-navy">Custom platform — done for you</h2>
          <p className="mb-3 text-sm text-slate-600">
            Short on time, or want it just so? We&apos;ll build the platform around exactly how your centre runs — your
            courses, grades, ratios, checks and session times — import your data, and hand it over ready to go. It&apos;s
            from {money(pricing.setupPrice, pricing.currency)} setup, plus £350 travel if we come and work with your team
            on site (recommended); after that you simply continue on your normal monthly plan.
          </p>
          <SetupServiceCard price={money(pricing.setupPrice, pricing.currency)} onsitePrice={money(ON_SITE_DAY_PRICE, pricing.currency)} purchased={Boolean(organisation.setupPurchasedAt)} />
        </Card>
      ) : null}

      <Card className="p-0">
        <h2 className="px-4 pt-4 font-semibold text-navy">Invoices</h2>
        {invoices.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400">No invoices yet. They&apos;ll appear here — and arrive by email — after your first payment.</p>
        ) : (
          <table className="mt-2 w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">PDF</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-3 font-medium text-navy">{inv.number}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(inv.created)}</td>
                  <td className="px-4 py-3 text-slate-600">{money(inv.amountPaid, inv.currency)}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{inv.status}</td>
                  <td className="px-4 py-3 text-right">
                    {inv.pdfUrl ? <a href={inv.pdfUrl} className="font-semibold text-teal hover:underline">Download</a> : inv.hostedUrl ? <a href={inv.hostedUrl} className="font-semibold text-teal hover:underline">View</a> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
