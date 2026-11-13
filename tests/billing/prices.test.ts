import { describe, it, expect } from "vitest";
import { advertisedPence, classifyPrice, pickPrices, priceKindFor, type PriceLike } from "@/lib/billing/prices";

const price = (over: Partial<PriceLike>): PriceLike => ({
  id: "price_x", active: true, unit_amount: 1000, currency: "gbp", recurring: null, productName: "", productActive: true, ...over,
});

describe("Stripe price classification", () => {
  it("recognises the four plan prices by product name + interval, and the two one-offs", () => {
    expect(classifyPrice(price({ productName: "Small Club Plan", recurring: { interval: "month" } }))).toBe("small_club_monthly");
    expect(classifyPrice(price({ productName: "Small Club Plan", recurring: { interval: "year" } }))).toBe("small_club_annual");
    expect(classifyPrice(price({ productName: "Standard Plan", recurring: { interval: "month" } }))).toBe("standard_monthly");
    expect(classifyPrice(price({ productName: "Standard Plan", recurring: { interval: "year" } }))).toBe("standard_annual");
    expect(classifyPrice(price({ productName: "Custom Package" }))).toBe("setup");
    expect(classifyPrice(price({ productName: "UK Onsite Daily Consultancy" }))).toBe("onsite_day");
  });

  it("ignores inactive prices/products and things it doesn't know", () => {
    expect(classifyPrice(price({ productName: "Standard Plan", recurring: { interval: "month" }, active: false }))).toBeNull();
    expect(classifyPrice(price({ productName: "Standard Plan", recurring: { interval: "month" }, productActive: false }))).toBeNull();
    expect(classifyPrice(price({ productName: "Standard Plan" }))).toBeNull(); // one-off standard? not a plan price
    expect(classifyPrice(price({ productName: "Gift voucher" }))).toBeNull();
  });

  it("picks the first (newest) match per kind", () => {
    const picked = pickPrices([
      price({ id: "new", productName: "Standard Plan", recurring: { interval: "month" }, unit_amount: 6500 }),
      price({ id: "old", productName: "Standard Plan", recurring: { interval: "month" }, unit_amount: 7500 }),
      price({ id: "setup", productName: "Custom Package", unit_amount: 85000 }),
    ]);
    expect(picked.standard_monthly?.id).toBe("new");
    expect(picked.setup?.id).toBe("setup");
    expect(picked.small_club_monthly).toBeUndefined();
  });

  it("maps a centre's tier + interval to a price kind (unknown tier → Standard)", () => {
    expect(priceKindFor("small_club", "annual")).toBe("small_club_annual");
    expect(priceKindFor("standard", "monthly")).toBe("standard_monthly");
    expect(priceKindFor(null, "monthly")).toBe("standard_monthly");
  });
});

describe("after a price change", () => {
  it("prefers the Stripe price at the advertised amount over an older one still active", () => {
    const old = price({ id: "price_old", productName: "Small Club", recurring: { interval: "month" }, unit_amount: 3500 });
    const now = price({ id: "price_new", productName: "Small Club", recurring: { interval: "month" }, unit_amount: advertisedPence("small_club_monthly") });
    // Stripe lists newest first, but either order must land on the advertised price.
    expect(pickPrices([old, now]).small_club_monthly?.id).toBe("price_new");
    expect(pickPrices([now, old]).small_club_monthly?.id).toBe("price_new");
  });

  it("advertises the tier prices in pence, and nothing for one-off kinds", () => {
    expect(advertisedPence("small_club_monthly")).toBe(1900);
    expect(advertisedPence("small_club_annual")).toBe(19000);
    expect(advertisedPence("standard_monthly")).toBe(3500);
    expect(advertisedPence("standard_annual")).toBe(35000);
    expect(advertisedPence("setup")).toBeNull();
  });
});
