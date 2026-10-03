import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { Card } from "@/components/ui";
import { CATEGORY_BY_KEY } from "@/lib/finance/categories";
import { buildPnl, cashBalance, expenseBreakdown, fmtMinor, fyOf, fyRange, monthlySeries } from "@/lib/finance/pnl";
import { AddTransactionForm, FinanceSettingsForm, StripeSyncButton, TransactionTable } from "@/components/admin/FinanceForms";
import { BreakdownChart, CumulativeChart, MonthlyChart } from "@/components/admin/FinanceCharts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Finance" };

export default async function AdminFinancePage({ searchParams }: { searchParams: Promise<{ fy?: string; view?: string }> }) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const platform = new PlatformRepository(await getDb());
  const [settings, all] = await Promise.all([platform.getFinanceSettings(), platform.listFinanceTransactions()]);
  const today = new Date().toISOString().slice(0, 10);
  const currentFy = fyOf(today, settings.fyStartMonth);
  const fy = /^\d{4}$/.test(sp.fy ?? "") ? Number(sp.fy) : currentFy;
  const view = sp.view === "pnl" ? "pnl" : sp.view === "settings" ? "settings" : "log";
  const cur = settings.reportingCurrency;
  const range = fyRange(fy, settings.fyStartMonth);
  const pnl = buildPnl(all, settings, fy);
  const months = monthlySeries(all, settings, fy);
  const breakdown = expenseBreakdown(all, settings, fy);
  const cash = cashBalance(all, settings);
  const years = [...new Set([currentFy, ...all.map((t) => fyOf(t.date, settings.fyStartMonth))])].sort((a, b) => b - a);
  const inYear = all.filter((t) => t.date >= range.from && t.date < range.to);
  const rows = inYear.map((t) => ({
    id: t.id, date: t.date, category: t.category, categoryLabel: CATEGORY_BY_KEY[t.category]?.label ?? t.category, group: CATEGORY_BY_KEY[t.category]?.group ?? "operating",
    description: t.description, counterparty: t.counterparty, amountMinor: t.amountMinor, vatMinor: t.vatMinor, currency: t.currency, source: t.source, receiptRef: t.receiptRef, notes: t.notes,
  }));
  const tab = (v: string, label: string) => <Link href={`/admin/finance?fy=${fy}&view=${v}`} className={`rounded-md px-3 py-1 text-sm font-medium ${view === v ? "bg-navy text-white" : "text-slate-500 hover:text-navy"}`}>{label}</Link>;
  const money = (m: number) => fmtMinor(m, cur);
  const tone = (m: number) => (m > 0 ? "text-starboard" : m < 0 ? "text-port" : "text-navy");

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-navy">Finance</h1>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Financial year</label>
          <div className="flex rounded-lg border border-slate-200 p-0.5">
            {years.slice(0, 6).map((y) => <Link key={y} href={`/admin/finance?fy=${y}&view=${view}`} className={`rounded-md px-2.5 py-1 text-sm font-medium ${y === fy ? "bg-navy text-white" : "text-slate-500 hover:text-navy"}`}>{fyRange(y, settings.fyStartMonth).label}</Link>)}
          </div>
        </div>
      </div>
      <p className="mb-5 text-sm text-slate-500">Your own books: every expense typed in here, every payment picked up from Stripe, ready for the accountant. {range.from} to the day before {range.to}, reported in {cur}.</p>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card><p className="text-xs font-semibold text-navy">Revenue</p><p className="mt-1 text-2xl font-semibold text-navy">{money(pnl.revenueMinor)}</p></Card>
        <Card><p className="text-xs font-semibold text-navy">Gross profit</p><p className={`mt-1 text-2xl font-semibold ${tone(pnl.grossProfitMinor)}`}>{money(pnl.grossProfitMinor)}</p><p className="text-xs text-slate-400">after cost of sales {money(pnl.costOfSalesMinor)}</p></Card>
        <Card><p className="text-xs font-semibold text-navy">Operating profit</p><p className={`mt-1 text-2xl font-semibold ${tone(pnl.operatingProfitMinor)}`}>{money(pnl.operatingProfitMinor)}</p><p className="text-xs text-slate-400">opex {money(pnl.operatingExpensesMinor)}</p></Card>
        <Card><p className="text-xs font-semibold text-navy">Retained profit</p><p className={`mt-1 text-2xl font-semibold ${tone(pnl.retainedProfitMinor)}`}>{money(pnl.retainedProfitMinor)}</p><p className="text-xs text-slate-400">after interest, R&amp;D credit, tax</p></Card>
        <Card><p className="text-xs font-semibold text-navy">Cash balance</p><p className={`mt-1 text-2xl font-semibold ${tone(cash)}`}>{money(cash)}</p><p className="text-xs text-slate-400">opening balance + all records</p></Card>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">{tab("log", "Transactions")}{tab("pnl", "Profit & loss")}{tab("settings", "Settings")}</div>
        <div className="flex items-center gap-3 text-sm">
          <a href={`/api/admin/finance/csv?fy=${fy}&kind=transactions`} className="font-medium text-teal hover:underline">Download transactions (CSV)</a>
          <a href={`/api/admin/finance/csv?fy=${fy}&kind=pnl`} className="font-medium text-teal hover:underline">Download P&amp;L (CSV)</a>
        </div>
      </div>

      {view === "log" ? (
        <>
          <Card className="mb-5">
            <h2 className="mb-1 font-semibold text-navy">Add an expense (or other line)</h2>
            <p className="mb-3 text-xs text-slate-500">Subscription payments and Stripe fees arrive on their own when an invoice is paid. Use this for everything else.</p>
            <AddTransactionForm />
          </Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-navy">Transactions · {range.label}</h2>
            <StripeSyncButton />
          </div>
          <TransactionTable rows={rows} />
        </>
      ) : view === "pnl" ? (
        <>
          <div className="mb-5 grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2"><h2 className="mb-2 font-semibold text-navy">Revenue vs expenses, by month</h2><MonthlyChart months={months} currency={cur} /></Card>
            <Card><h2 className="mb-2 font-semibold text-navy">Where the money went</h2><BreakdownChart items={breakdown} currency={cur} /></Card>
          </div>
          <Card className="mb-5"><h2 className="mb-2 font-semibold text-navy">Running profit</h2><CumulativeChart months={months} currency={cur} /></Card>
          <Card className="p-0">
            <table className="w-full text-left text-sm">
              <tbody>
                {pnl.groups.map((g) => (
                  <GroupRows key={g.group} label={g.label} lines={g.lines.map((l) => ({ label: l.label, value: money(l.amountMinor), zero: l.amountMinor === 0 }))} total={money(g.totalMinor)} />
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 text-sm">
                <Total label="Gross profit" value={money(pnl.grossProfitMinor)} tone={tone(pnl.grossProfitMinor)} />
                <Total label="Operating profit" value={money(pnl.operatingProfitMinor)} tone={tone(pnl.operatingProfitMinor)} />
                <Total label="Interest income / (expense)" value={money(pnl.interestMinor)} tone={tone(pnl.interestMinor)} light />
                <Total label="R&D tax credit" value={money(pnl.rdCreditMinor)} tone="text-navy" light />
                <Total label="Profit before tax" value={money(pnl.profitBeforeTaxMinor)} tone={tone(pnl.profitBeforeTaxMinor)} />
                <Total label="Corporation tax" value={money(pnl.corporationTaxMinor)} tone="text-navy" light />
                <Total label="Retained profit" value={money(pnl.retainedProfitMinor)} tone={tone(pnl.retainedProfitMinor)} strong />
                <Total label="Cash balance (today)" value={money(cash)} tone={tone(cash)} light />
              </tfoot>
            </table>
          </Card>
          <p className="mt-2 text-xs text-slate-400">EUR lines are converted at the rate in Settings. Depreciation is included in the P&amp;L but not in cash. This is a management view; your accountant prepares the statutory accounts from the CSV.</p>
        </>
      ) : (
        <Card>
          <h2 className="mb-1 font-semibold text-navy">How the books are presented</h2>
          <p className="mb-4 text-xs text-slate-500">Set the financial year your company uses, the currency to report in, the exchange rate for the other currency, and the bank balance on the day you started recording.</p>
          <FinanceSettingsForm fyStartMonth={settings.fyStartMonth} reportingCurrency={settings.reportingCurrency} eurToGbp={settings.eurToGbp} openingCash={settings.openingCashMinor ? (settings.openingCashMinor / 100).toFixed(2) : ""} openingCashDate={settings.openingCashDate ?? ""} />
        </Card>
      )}
    </div>
  );
}

function GroupRows({ label, lines, total }: { label: string; lines: { label: string; value: string; zero: boolean }[]; total: string }) {
  return (
    <>
      <tr className="bg-slate-50"><td className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500" colSpan={2}>{label}</td></tr>
      {lines.map((l) => <tr key={l.label} className={l.zero ? "text-slate-400" : "text-slate-700"}><td className="px-6 py-1.5">{l.label}</td><td className="px-4 py-1.5 text-right tabular-nums">{l.value}</td></tr>)}
      <tr className="font-semibold text-navy"><td className="px-4 py-2">Total {label.toLowerCase()}</td><td className="px-4 py-2 text-right tabular-nums">{total}</td></tr>
    </>
  );
}
function Total({ label, value, tone, light, strong }: { label: string; value: string; tone: string; light?: boolean; strong?: boolean }) {
  return <tr className={strong ? "bg-slate-50" : ""}><td className={`px-4 py-2 ${light ? "text-slate-600" : "font-semibold text-navy"} ${strong ? "text-base" : ""}`}>{label}</td><td className={`px-4 py-2 text-right tabular-nums ${light ? "" : "font-semibold"} ${tone} ${strong ? "text-base" : ""}`}>{value}</td></tr>;
}
