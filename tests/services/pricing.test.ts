import { describe, it, expect } from "vitest";
import { effectivePricing, fmtMoney } from "@/lib/pricing";

const base = { monthlyPrice: 75, annualPrice: 675, currency: "GBP" } as const;
const org = (over: Partial<{ discountPercent: number; customMonthlyPrice: number | null; customAnnualPrice: number | null; freeMonths: number }>) => ({
  discountPercent: 0, customMonthlyPrice: null, customAnnualPrice: null, freeMonths: 0, ...over,
});

describe("effectivePricing", () => {
  it("returns the base price with no overrides", () => {
    const e = effectivePricing(org({}), base);
    expect(e.monthly).toBe(75);
    expect(e.annual).toBe(675);
    expect(e.custom).toBe(false);
  });
  it("applies a percentage discount", () => {
    const e = effectivePricing(org({ discountPercent: 20 }), base);
    expect(e.monthly).toBe(60);
    expect(e.annual).toBe(540);
    expect(e.discountPercent).toBe(20);
  });
  it("a custom price overrides the discount", () => {
    const e = effectivePricing(org({ discountPercent: 50, customMonthlyPrice: 40 }), base);
    expect(e.monthly).toBe(40); // custom wins
    expect(e.annual).toBe(337.5); // annual still discounted 50%
    expect(e.custom).toBe(true);
  });
  it("clamps discount to 0–100 and carries free months", () => {
    expect(effectivePricing(org({ discountPercent: 150 }), base).monthly).toBe(0);
    expect(effectivePricing(org({ discountPercent: -10 }), base).monthly).toBe(75);
    expect(effectivePricing(org({ freeMonths: 2 }), base).freeMonths).toBe(2);
  });
});

describe("fmtMoney", () => {
  it("formats with the right symbol", () => {
    expect(fmtMoney(75, "GBP")).toBe("£75");
    expect(fmtMoney(60, "EUR")).toBe("€60");
    expect(fmtMoney(1000, "USD")).toBe("$1,000");
  });
});
