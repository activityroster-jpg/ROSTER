import { describe, it, expect } from "vitest";
import { applyBreak, describeDefaultSchedule, expandDefaultSchedule, normaliseDefaultSchedule, parseDefaultSchedule } from "@/lib/domain";

describe("default schedules", () => {
  it("normalises, drops invalid rows and sorts", () => {
    const s = normaliseDefaultSchedule([
      { day: 2, start: "09:00", end: "17:00" },
      { day: 1, start: "13:00", end: "16:00" },
      { day: 1, start: "09:00", end: "12:00" },
      { day: 1, start: "12:00", end: "11:00" }, // end before start
      { day: 0, start: "09:00", end: "10:00" }, // bad day
      "junk",
    ]);
    expect(s).toEqual([
      { day: 1, start: "09:00", end: "12:00" },
      { day: 1, start: "13:00", end: "16:00" },
      { day: 2, start: "09:00", end: "17:00" },
    ]);
    expect(parseDefaultSchedule("not json")).toEqual([]);
  });

  it("expands from a start date and describes itself", () => {
    const s = [{ day: 1, start: "09:00", end: "17:00" }, { day: 2, start: "09:00", end: "17:00" }];
    expect(expandDefaultSchedule("2026-12-31", s).map((x) => x.date)).toEqual(["2026-12-31", "2027-01-01"]);
    expect(describeDefaultSchedule(s)).toBe("2 sessions over 2 days · 09:00–17:00");
  });
});

describe("applyBreak", () => {
  const policy = { afterMinutes: 360, breakMinutes: 30, paid: false };
  it("deducts an unpaid break only past the threshold", () => {
    expect(applyBreak(360, policy)).toEqual({ breakMinutes: 0, payableMinutes: 360 });
    expect(applyBreak(480, policy)).toEqual({ breakMinutes: 30, payableMinutes: 450 });
  });
  it("records but doesn't deduct a paid break, and is off at 0 minutes", () => {
    expect(applyBreak(480, { ...policy, paid: true })).toEqual({ breakMinutes: 30, payableMinutes: 480 });
    expect(applyBreak(480, { ...policy, breakMinutes: 0 })).toEqual({ breakMinutes: 0, payableMinutes: 480 });
  });
});
