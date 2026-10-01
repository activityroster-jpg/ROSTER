import { describe, it, expect } from "vitest";
import { effectivePricing, fmtMoney, competitorMonthly, tierSaving, comparisonRow, COMPETITOR_PRICING, PER_USER_BENCHMARK } from "@/lib/pricing";

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
  it("uses the tier price as the base when the centre has a tier", () => {
    expect(effectivePricing({ ...org({}), tier: "small_club" }, base).monthly).toBe(35);
    expect(effectivePricing({ ...org({}), tier: "standard" }, base).monthly).toBe(65);
  });
  it("applies a discount to the tier base, and a custom price still wins", () => {
    expect(effectivePricing({ ...org({ discountPercent: 20 }), tier: "standard" }, base).monthly).toBe(52);
    expect(effectivePricing({ ...org({ customMonthlyPrice: 40 }), tier: "standard" }, base).monthly).toBe(40);
  });
});

describe("competitor comparison", () => {
  it("prices per seat at the benchmark", () => {
    expect(competitorMonthly(20)).toBe(20 * PER_USER_BENCHMARK);
    expect(competitorMonthly(0)).toBe(0);
  });
  it("computes our saving vs a per-seat tool", () => {
    const s = tierSaving(30, 65); // 30 × £4 = £120 vs £65 flat
    expect(s.theirs).toBe(120);
    expect(s.ours).toBe(65);
    expect(s.save).toBe(55);
    expect(s.pct).toBe(46);
  });
  it("never reports a negative saving", () => {
    const s = tierSaving(5, 65); // tiny team: flat price is dearer
    expect(s.save).toBeLessThan(0);
    expect(s.pct).toBe(0);
  });
  it("builds a per-platform comparison row with a column per competitor", () => {
    const r = comparisonRow(20, 65, "Standard");
    expect(r.competitors.map((c) => c.name)).toEqual(COMPETITOR_PRICING.map((c) => c.name));
    // cheapestRival is the minimum of the per-platform monthlies
    expect(r.cheapestRival).toBe(Math.min(...r.competitors.map((c) => c.monthly)));
    expect(r.save).toBe(r.cheapestRival - 65);
    expect(r.save).toBeGreaterThan(0); // we beat even the cheapest at 20 people
  });
  it("Small Club (£35) is still cheapest at its 10-person cap", () => {
    const r = comparisonRow(10, 35, "Small Club");
    // every competitor charges more than our flat £35 at 10 people
    for (const c of r.competitors) expect(c.monthly).toBeGreaterThan(35);
    expect(r.save).toBeGreaterThan(0);
    expect(r.pct).toBeGreaterThan(0);
  });
});

describe("fmtMoney", () => {
  it("formats with the right symbol", () => {
    expect(fmtMoney(75, "GBP")).toBe("£75");
    expect(fmtMoney(60, "EUR")).toBe("€60");
    expect(fmtMoney(1000, "USD")).toBe("$1,000");
  });
});
