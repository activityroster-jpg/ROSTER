import { describe, it, expect } from "vitest";
import { tierMeta, tierCap, isWithinTierCap, tierSlotsRemaining, SMALL_CLUB_CAP } from "@/lib/tiers";

describe("tiers", () => {
  it("exposes the two flat tiers", () => {
    expect(tierMeta("small_club").monthlyPrice).toBe(35);
    expect(tierMeta("standard").monthlyPrice).toBe(65);
  });
  it("caps Small Club and leaves Standard unlimited", () => {
    expect(tierCap("small_club")).toBe(SMALL_CLUB_CAP);
    expect(tierCap("standard")).toBeNull();
  });
  it("falls back to Standard for unknown / missing tiers", () => {
    expect(tierMeta(null).id).toBe("standard");
    expect(tierMeta(undefined).userCap).toBeNull();
  });
  it("allows adding up to the cap, then blocks (hard cap at the 11th)", () => {
    expect(isWithinTierCap("small_club", 9)).toBe(true);  // room for the 10th
    expect(isWithinTierCap("small_club", 10)).toBe(false); // no room for the 11th
    expect(isWithinTierCap("standard", 1000)).toBe(true);
  });
  it("reports remaining slots, never negative; null when unlimited", () => {
    expect(tierSlotsRemaining("small_club", 7)).toBe(3);
    expect(tierSlotsRemaining("small_club", 12)).toBe(0);
    expect(tierSlotsRemaining("standard", 500)).toBeNull();
  });
});
