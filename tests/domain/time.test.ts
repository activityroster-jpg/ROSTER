import { describe, expect, it } from "vitest";
import { fmtWallTime, hourIn, wallClockFromDevice, wallClockMs, wallDateIso } from "@/lib/domain/time";

/**
 * The one rule for times: what was typed is what is shown, in any season and
 * any country. A session stored as 09:00Z prints 09:00 in July and in January.
 */
describe("times as typed", () => {
  it("formats stored wall-clock values without any zone shift, summer or winter", () => {
    expect(fmtWallTime(Date.parse("2026-07-04T09:00:00.000Z"))).toBe("09:00");
    expect(fmtWallTime(Date.parse("2026-01-05T09:00:00.000Z"))).toBe("09:00");
    expect(fmtWallTime(Date.parse("2026-07-04T00:30:00.000Z"))).toBe("00:30");
    expect(wallDateIso(Date.parse("2026-07-04T23:30:00.000Z"))).toBe("2026-07-04");
  });

  it("turns a real instant into the centre's wall-clock, so a clock-in reads what the phone showed", () => {
    // 08:02 UTC on a July morning is 09:02 in London and 11:02 in Athens (UTC+3 in summer).
    const real = Date.parse("2026-07-04T08:02:00.000Z");
    expect(fmtWallTime(wallClockMs("Europe/London", real))).toBe("09:02");
    expect(fmtWallTime(wallClockMs("Europe/Athens", real))).toBe("11:02");
    expect(wallDateIso(wallClockMs("Europe/London", Date.parse("2026-07-04T23:30:00.000Z")))).toBe("2026-07-05");
    expect(hourIn("Europe/London", real)).toBe(9);
  });

  it("trusts the device's local time only when it agrees with the centre's clock", () => {
    const real = Date.parse("2026-07-04T08:02:00.000Z");
    expect(fmtWallTime(wallClockFromDevice("2026-07-04T09:05", "Europe/London", real)!)).toBe("09:05");
    expect(wallClockFromDevice("2026-07-04T11:05", "Europe/London", real)).toBeNull(); // two hours out: ignored
    expect(wallClockFromDevice("garbage", "Europe/London", real)).toBeNull();
    expect(wallClockFromDevice(null, "Europe/London", real)).toBeNull();
  });
});
