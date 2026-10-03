import { describe, expect, it } from "vitest";
import { ageOn, eighteenthBirthday, isUnder18, plausibleStaffDob } from "@/lib/domain/age";

describe("age rules", () => {
  const today = new Date("2026-10-03T12:00:00Z");
  it("computes whole years and handles the birthday edge", () => {
    expect(ageOn("2008-10-03", today)).toBe(18);
    expect(ageOn("2008-10-04", today)).toBe(17);
    expect(ageOn("2010-02-28", today)).toBe(16);
    expect(ageOn(null, today)).toBeNull();
    expect(ageOn("nonsense", today)).toBeNull();
  });
  it("flags under-18s only when the date is known", () => {
    expect(isUnder18("2009-06-01", today)).toBe(true);
    expect(isUnder18("2008-10-03", today)).toBe(false);
    expect(isUnder18(null, today)).toBe(false);
  });
  it("gives the 18th birthday and a plausibility check", () => {
    expect(eighteenthBirthday("2009-06-01")).toBe("2027-06-01");
    expect(plausibleStaffDob("2015-01-01", today)).toBe(false); // 11
    expect(plausibleStaffDob("2012-01-01", today)).toBe(true);  // 14
    expect(plausibleStaffDob("1930-01-01", today)).toBe(false); // 96
  });
});
