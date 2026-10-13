import { describe, expect, it } from "vitest";
import { missingExpiry } from "@/lib/domain/roster-day";

const places = new Map<string, string | null>([["place-di", "type-di"], ["place-vol", null]]);

describe("missingExpiry", () => {
  it("flags someone with no expiry date on any ticket", () => {
    expect(missingExpiry([{ instructorId: "a", roleTypeId: "place-di" }], places, [{ instructorId: "a", qualificationTypeId: "type-di", expiryDate: null }])).toEqual(["a"]);
  });
  it("is quiet when the ticket has a date", () => {
    expect(missingExpiry([{ instructorId: "a", roleTypeId: "place-di" }], places, [{ instructorId: "a", qualificationTypeId: "type-di", expiryDate: "2027-05-01" }])).toEqual([]);
  });
  it("does not check places with no instructor type", () => {
    expect(missingExpiry([{ instructorId: "a", roleTypeId: "place-vol" }], places, [])).toEqual([]);
  });
  it("one dated ticket is enough: flagged only when none of their tickets is dated", () => {
    const staff = [{ instructorId: "a", roleTypeId: "place-di" }, { instructorId: "b", roleTypeId: "place-di" }];
    const held = [
      { instructorId: "a", qualificationTypeId: "type-si", expiryDate: "2027-01-01" },
      { instructorId: "b", qualificationTypeId: "type-si", expiryDate: null },
    ];
    expect(missingExpiry(staff, places, held)).toEqual(["b"]);
  });
  it("lists each person once however many sessions they're on", () => {
    const staff = [{ instructorId: "a", roleTypeId: "place-di" }, { instructorId: "a", roleTypeId: "place-di" }];
    expect(missingExpiry(staff, places, [])).toEqual(["a"]);
  });
});
