import { CATEGORY_BY_KEY, FINANCE_CATEGORIES, GROUP_LABEL, PNL_GROUPS, isInflow, type FinanceGroup } from "./categories";

/** The fields the P&L needs; the DB row satisfies it. */
export interface TxLike {
  date: string;
  category: string;
  amountMinor: number;
  currency: "GBP" | "EUR";
}
export interface ReportingSettings {
  fyStartMonth: number; // 1–12
  reportingCurrency: "GBP" | "EUR";
  eurToGbp: number;
  openingCashMinor: number;
}

/** Financial year `fy` = the calendar year it starts in. Returns [from, to) ISO dates. */
export function fyRange(fy: number, fyStartMonth: number): { from: string; to: string; label: string } {
  const m = Math.min(12, Math.max(1, Math.round(fyStartMonth)));
  const mm = String(m).padStart(2, "0");
  const from = `${fy}-${mm}-01`;
  const to = `${fy + 1}-${mm}-01`;
  return { from, to, label: m === 1 ? `${fy}` : `${fy}/${String(fy + 1).slice(2)}` };
}

/** Which financial year a date falls in. */
export function fyOf(dateIso: string, fyStartMonth: number): number {
  const y = Number(dateIso.slice(0, 4));
  const m = Number(dateIso.slice(5, 7));
  return m >= fyStartMonth ? y : y - 1;
}

/** Convert minor units into the reporting currency (also minor units). */
export function toReporting(amountMinor: number, currency: "GBP" | "EUR", s: ReportingSettings): number {
  if (currency === s.reportingCurrency) return amountMinor;
  const rate = s.eurToGbp > 0 ? s.eurToGbp : 1;
  return Math.round(currency === "EUR" ? amountMinor * rate : amountMinor / rate);
}

export interface PnlLine { key: string; label: string; amountMinor: number }
export interface PnlGroup { group: FinanceGroup; label: string; lines: PnlLine[]; totalMinor: number }
export interface Pnl {
  fy: number;
  from: string;
  to: string;
  groups: PnlGroup[];
  revenueMinor: number;
  costOfSalesMinor: number;
  grossProfitMinor: number;
  operatingExpensesMinor: number;
  operatingProfitMinor: number;
  interestMinor: number; // income − expense
  rdCreditMinor: number;
  profitBeforeTaxMinor: number;
  corporationTaxMinor: number;
  retainedProfitMinor: number;
}

/** Sum a financial year's transactions into the standard statement, in the reporting currency. Loans, dividends and capital stay out. */
export function buildPnl(txs: TxLike[], s: ReportingSettings, fy: number): Pnl {
  const { from, to } = fyRange(fy, s.fyStartMonth);
  const sums = new Map<string, number>();
  for (const t of txs) {
    if (t.date < from || t.date >= to) continue;
    if (!CATEGORY_BY_KEY[t.category]) continue;
    sums.set(t.category, (sums.get(t.category) ?? 0) + toReporting(t.amountMinor, t.currency, s));
  }
  const groups: PnlGroup[] = PNL_GROUPS.map((g) => {
    const lines = FINANCE_CATEGORIES.filter((c) => c.group === g).map((c) => ({ key: c.key, label: c.label, amountMinor: sums.get(c.key) ?? 0 }));
    return { group: g, label: GROUP_LABEL[g], lines, totalMinor: lines.reduce((a, l) => a + l.amountMinor, 0) };
  });
  const total = (g: FinanceGroup) => groups.find((x) => x.group === g)!.totalMinor;
  const revenueMinor = total("revenue");
  const costOfSalesMinor = total("cost_of_sales");
  const grossProfitMinor = revenueMinor - costOfSalesMinor;
  const operatingExpensesMinor = total("operating");
  const operatingProfitMinor = grossProfitMinor - operatingExpensesMinor;
  const interestMinor = (sums.get("interest_income") ?? 0) - (sums.get("interest_expense") ?? 0);
  const rdCreditMinor = sums.get("rd_tax_credit") ?? 0;
  const profitBeforeTaxMinor = operatingProfitMinor + interestMinor + rdCreditMinor;
  const corporationTaxMinor = sums.get("corporation_tax") ?? 0;
  const retainedProfitMinor = profitBeforeTaxMinor - corporationTaxMinor;
  return { fy, from, to, groups, revenueMinor, costOfSalesMinor, grossProfitMinor, operatingExpensesMinor, operatingProfitMinor, interestMinor, rdCreditMinor, profitBeforeTaxMinor, corporationTaxMinor, retainedProfitMinor };
}

/** Net cash effect of one transaction in the reporting currency (income and money in +, costs and money out −). */
export function cashEffect(t: TxLike, s: ReportingSettings): number {
  const cat = CATEGORY_BY_KEY[t.category];
  if (!cat) return 0;
  const v = toReporting(t.amountMinor, t.currency, s);
  return isInflow(cat) ? v : -v;
}

/** Opening balance plus everything recorded so far (depreciation is non-cash and excluded). */
export function cashBalance(txs: TxLike[], s: ReportingSettings, upToIso?: string): number {
  let bal = s.openingCashMinor;
  for (const t of txs) {
    if (upToIso && t.date > upToIso) continue;
    if (t.category === "depreciation") continue;
    bal += cashEffect(t, s);
  }
  return bal;
}

export interface MonthPoint { key: string; label: string; revenueMinor: number; expensesMinor: number; netMinor: number; cumulativeMinor: number }

/** Twelve months of the financial year: revenue vs expenses, with a running net. */
export function monthlySeries(txs: TxLike[], s: ReportingSettings, fy: number): MonthPoint[] {
  const { from } = fyRange(fy, s.fyStartMonth);
  const points: MonthPoint[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  for (let i = 0; i < 12; i++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
    points.push({ key, label, revenueMinor: 0, expensesMinor: 0, netMinor: 0, cumulativeMinor: 0 });
    m++; if (m > 12) { m = 1; y++; }
  }
  const byKey = new Map(points.map((p) => [p.key, p]));
  for (const t of txs) {
    const p = byKey.get(t.date.slice(0, 7));
    const cat = CATEGORY_BY_KEY[t.category];
    if (!p || !cat) continue;
    const v = toReporting(t.amountMinor, t.currency, s);
    if (cat.group === "revenue") p.revenueMinor += v;
    else if (cat.group === "cost_of_sales" || cat.group === "operating") p.expensesMinor += v;
  }
  let run = 0;
  for (const p of points) { p.netMinor = p.revenueMinor - p.expensesMinor; run += p.netMinor; p.cumulativeMinor = run; }
  return points;
}

/** Expense totals by category for the year, largest first. */
export function expenseBreakdown(txs: TxLike[], s: ReportingSettings, fy: number): { key: string; label: string; amountMinor: number }[] {
  const pnl = buildPnl(txs, s, fy);
  return pnl.groups
    .filter((g) => g.group === "cost_of_sales" || g.group === "operating")
    .flatMap((g) => g.lines)
    .filter((l) => l.amountMinor !== 0)
    .sort((a, b) => b.amountMinor - a.amountMinor);
}

/** Profit after tax from every P&L line dated before `beforeIso` (all years recorded). */
export function profitBefore(txs: TxLike[], s: ReportingSettings, beforeIso: string): number {
  let total = 0;
  for (const t of txs) {
    const cat = CATEGORY_BY_KEY[t.category];
    if (!cat || cat.group === "capital" || t.date >= beforeIso) continue;
    const v = toReporting(t.amountMinor, t.currency, s);
    total += cat.effect === "income" ? v : -v;
  }
  return total;
}

export interface DirectorsLoan {
  /** Balances: + the company owes the director, − the director owes the company. */
  openingMinor: number;
  closingMinor: number;
  /** The year's movements, each as entered (positive). */
  putInMinor: number;
  repaidMinor: number;
  takenOutMinor: number;
}
export interface CapitalSummary {
  /** The year's loans, dividends and capital, one line per category (amounts as entered). */
  lines: PnlLine[];
  dividendsMinor: number;
  /** The year's profit after tax, less the dividends paid in it. */
  keptAfterDividendsMinor: number;
  directorsLoan: DirectorsLoan;
  /** Owed to lenders at the year end. */
  businessLoansMinor: number;
  /** Paid in for shares, all years to the year end. */
  shareCapitalMinor: number;
  /** Profit after tax recorded to the year end, less every dividend paid to then: roughly what is left to pay dividends from. */
  availableForDividendsMinor: number;
}

/**
 * Loans, dividends and capital for a financial year: none of it is profit or
 * loss, but it moves the bank and what the company owes. Balances run from
 * the first record to the year end.
 */
export function capitalSummary(txs: TxLike[], s: ReportingSettings, fy: number): CapitalSummary {
  const { from, to } = fyRange(fy, s.fyStartMonth);
  const year = new Map<string, number>();
  const before = new Map<string, number>();
  for (const t of txs) {
    const cat = CATEGORY_BY_KEY[t.category];
    if (!cat || cat.group !== "capital" || t.date >= to) continue;
    const bucket = t.date < from ? before : year;
    bucket.set(t.category, (bucket.get(t.category) ?? 0) + toReporting(t.amountMinor, t.currency, s));
  }
  const y = (k: string) => year.get(k) ?? 0;
  const all = (k: string) => (before.get(k) ?? 0) + y(k);
  const dla = (m: (k: string) => number) => m("directors_loan_in") - m("directors_loan_repaid") - m("directors_loan_out");
  const lines = FINANCE_CATEGORIES.filter((c) => c.group === "capital").map((c) => ({ key: c.key, label: c.label, amountMinor: y(c.key) }));
  const dividendsMinor = y("dividend_paid");
  return {
    lines,
    dividendsMinor,
    keptAfterDividendsMinor: buildPnl(txs, s, fy).retainedProfitMinor - dividendsMinor,
    directorsLoan: {
      openingMinor: dla((k) => before.get(k) ?? 0),
      closingMinor: dla(all),
      putInMinor: y("directors_loan_in"),
      repaidMinor: y("directors_loan_repaid"),
      takenOutMinor: y("directors_loan_out"),
    },
    businessLoansMinor: all("loan_received") - all("loan_repayment"),
    shareCapitalMinor: all("share_capital"),
    availableForDividendsMinor: profitBefore(txs, s, to) - all("dividend_paid"),
  };
}

/** Plain-English warnings about the director's loan and dividends, for the top of the page. */
export function capitalWarnings(c: CapitalSummary, currency: "GBP" | "EUR"): string[] {
  const out: string[] = [];
  if (c.directorsLoan.closingMinor < 0) {
    out.push(`The director owes the company ${fmtMinor(-c.directorsLoan.closingMinor, currency)} on the director's loan. Pay it back, or clear it with salary or a dividend, before the year end: an overdrawn director's loan can mean extra tax for the company and the director. Check with your accountant.`);
  }
  if (c.dividendsMinor > 0 && c.availableForDividendsMinor < 0) {
    out.push(`Dividends are ${fmtMinor(-c.availableForDividendsMinor, currency)} more than the profit after tax recorded here. A dividend paid without enough profit to cover it is unlawful and may have to be paid back: check with your accountant before paying more.`);
  }
  return out;
}

export const fmtMinor = (minor: number, currency: "GBP" | "EUR") =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: 2 }).format(minor / 100);
