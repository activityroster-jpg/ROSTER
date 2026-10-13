import { describe, expect, it } from "vitest";
import { buildPnl, capitalSummary, capitalWarnings, cashBalance, cashEffect, expenseBreakdown, fyOf, fyRange, monthlySeries, profitBefore, toReporting } from "@/lib/finance/pnl";
import { FINANCE_CATEGORIES } from "@/lib/finance/categories";

const s = { fyStartMonth: 1, reportingCurrency: "GBP" as const, eurToGbp: 0.8, openingCashMinor: 100_00 };

describe("financial year helpers", () => {
  it("ranges and labels", () => {
    expect(fyRange(2026, 1)).toEqual({ from: "2026-01-01", to: "2027-01-01", label: "2026" });
    expect(fyRange(2026, 4)).toEqual({ from: "2026-04-01", to: "2027-04-01", label: "2026/27" });
    expect(fyOf("2026-03-15", 4)).toBe(2025);
    expect(fyOf("2026-04-01", 4)).toBe(2026);
  });
  it("converts EUR into GBP at the settings rate", () => {
    expect(toReporting(100_00, "EUR", s)).toBe(80_00);
    expect(toReporting(80_00, "GBP", s)).toBe(80_00);
    expect(toReporting(80_00, "GBP", { ...s, reportingCurrency: "EUR" })).toBe(100_00);
  });
});

describe("profit and loss", () => {
  const txs = [
    { date: "2026-02-01", category: "subscription_revenue", amountMinor: 650_00, currency: "GBP" as const },
    { date: "2026-02-01", category: "payment_processing", amountMinor: 11_50, currency: "GBP" as const },
    { date: "2026-03-10", category: "setup_revenue", amountMinor: 1000_00, currency: "EUR" as const }, // 800 GBP
    { date: "2026-05-02", category: "marketing", amountMinor: 120_00, currency: "GBP" as const },
    { date: "2026-06-30", category: "depreciation", amountMinor: 50_00, currency: "GBP" as const },
    { date: "2026-12-31", category: "corporation_tax", amountMinor: 100_00, currency: "GBP" as const },
    { date: "2026-12-31", category: "rd_tax_credit", amountMinor: 30_00, currency: "GBP" as const },
    { date: "2027-01-05", category: "marketing", amountMinor: 999_00, currency: "GBP" as const }, // next FY
    { date: "2026-04-01", category: "not_a_category", amountMinor: 1, currency: "GBP" as const },
  ];
  it("sums each line in the reporting currency and rolls up the bottom line", () => {
    const p = buildPnl(txs, s, 2026);
    expect(p.revenueMinor).toBe(650_00 + 800_00);
    expect(p.costOfSalesMinor).toBe(11_50);
    expect(p.grossProfitMinor).toBe(1450_00 - 11_50);
    expect(p.operatingExpensesMinor).toBe(170_00);
    expect(p.operatingProfitMinor).toBe(1450_00 - 11_50 - 170_00);
    expect(p.rdCreditMinor).toBe(30_00);
    expect(p.profitBeforeTaxMinor).toBe(p.operatingProfitMinor + 30_00);
    expect(p.retainedProfitMinor).toBe(p.profitBeforeTaxMinor - 100_00);
  });
  it("monthly series and breakdown", () => {
    const m = monthlySeries(txs, s, 2026);
    expect(m).toHaveLength(12);
    expect(m[1]!.label).toBe("Feb");
    expect(m[1]!.revenueMinor).toBe(650_00);
    expect(m[1]!.expensesMinor).toBe(11_50);
    expect(m[11]!.cumulativeMinor).toBe(1450_00 - 11_50 - 170_00);
    const b = expenseBreakdown(txs, s, 2026);
    expect(b[0]).toMatchObject({ key: "marketing", amountMinor: 120_00 });
  });
  it("cash balance starts from the opening balance and ignores depreciation", () => {
    expect(cashBalance(txs, s, "2026-12-31")).toBe(100_00 + 650_00 - 11_50 + 800_00 - 120_00 - 100_00 + 30_00);
  });
});

describe("loans, dividends and capital", () => {
  const g = (date: string, category: string, amountMinor: number) => ({ date, category, amountMinor, currency: "GBP" as const });
  const txs = [
    g("2025-06-01", "directors_loan_in", 2000_00), // last year: the director lent 2,000
    g("2025-06-01", "subscription_revenue", 500_00), // last year's profit 500
    g("2026-02-01", "subscription_revenue", 3000_00),
    g("2026-02-28", "directors_salary", 750_00), // a cost in the P&L
    g("2026-03-01", "directors_loan_repaid", 500_00),
    g("2026-04-01", "directors_loan_out", 300_00),
    g("2026-05-01", "dividend_paid", 1000_00),
    g("2026-05-02", "share_capital", 100_00),
    g("2026-06-01", "loan_received", 5000_00),
    g("2026-07-01", "loan_repayment", 1000_00),
    g("2027-01-10", "dividend_paid", 9999_00), // next year
  ];

  it("keeps them out of the profit and loss, but salary is a cost", () => {
    const p = buildPnl(txs, s, 2026);
    expect(p.groups.map((x) => x.group)).toEqual(["revenue", "cost_of_sales", "operating", "below_the_line"]);
    expect(p.operatingExpensesMinor).toBe(750_00);
    expect(p.retainedProfitMinor).toBe(3000_00 - 750_00);
    expect(monthlySeries(txs, s, 2026)[4]!.expensesMinor).toBe(0); // the May dividend isn't an expense
  });

  it("moves the bank in the right direction", () => {
    expect(cashEffect(g("2026-01-01", "directors_loan_in", 10_00), s)).toBe(10_00);
    expect(cashEffect(g("2026-01-01", "dividend_paid", 10_00), s)).toBe(-10_00);
    expect(cashEffect(g("2026-01-01", "directors_loan_out", 10_00), s)).toBe(-10_00);
    expect(cashBalance(txs, s, "2026-12-31")).toBe(100_00 + 2000_00 + 500_00 + 3000_00 - 750_00 - 500_00 - 300_00 - 1000_00 + 100_00 + 5000_00 - 1000_00);
  });

  it("runs the director's loan, loans, share capital and what's left for dividends", () => {
    const c = capitalSummary(txs, s, 2026);
    expect(c.directorsLoan).toEqual({ openingMinor: 2000_00, closingMinor: 2000_00 - 500_00 - 300_00, putInMinor: 0, repaidMinor: 500_00, takenOutMinor: 300_00 });
    expect(c.dividendsMinor).toBe(1000_00);
    expect(c.keptAfterDividendsMinor).toBe(3000_00 - 750_00 - 1000_00);
    expect(c.businessLoansMinor).toBe(4000_00);
    expect(c.shareCapitalMinor).toBe(100_00);
    expect(c.availableForDividendsMinor).toBe(500_00 + 3000_00 - 750_00 - 1000_00);
    expect(c.lines.find((l) => l.key === "dividend_paid")!.amountMinor).toBe(1000_00);
    expect(profitBefore(txs, s, "2026-01-01")).toBe(500_00);
    expect(capitalWarnings(c, "GBP")).toEqual([]);
  });

  it("warns when the director owes the company or dividends outrun the profit", () => {
    const c = capitalSummary([g("2026-02-01", "directors_loan_out", 400_00), g("2026-03-01", "dividend_paid", 250_00), g("2026-03-01", "subscription_revenue", 100_00)], s, 2026);
    expect(c.directorsLoan.closingMinor).toBe(-400_00);
    expect(c.availableForDividendsMinor).toBe(-150_00);
    const w = capitalWarnings(c, "GBP");
    expect(w).toHaveLength(2);
    expect(w[0]).toContain("owes the company £400.00");
    expect(w[1]).toContain("£150.00 more than the profit");
  });
});

describe("chart of accounts", () => {
  it("every category's effect suits its group, and keys are unique", () => {
    for (const c of FINANCE_CATEGORIES) {
      expect(c.group === "capital" ? ["cash_in", "cash_out"] : ["income", "cost"]).toContain(c.effect);
    }
    expect(new Set(FINANCE_CATEGORIES.map((c) => c.key)).size).toBe(FINANCE_CATEGORIES.length);
  });
});
