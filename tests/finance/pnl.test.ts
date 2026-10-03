import { describe, expect, it } from "vitest";
import { buildPnl, cashBalance, expenseBreakdown, fyOf, fyRange, monthlySeries, toReporting } from "@/lib/finance/pnl";

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
