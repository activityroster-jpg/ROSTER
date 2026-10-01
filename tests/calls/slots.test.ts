import { describe, it, expect } from "vitest";
import { openSlots, hhmmToMinutes, minutesToHHMM, type AvailabilityWindow } from "@/lib/calls/slots";

// A fixed reference time: Wed 1 Jan 2025 00:00 UTC.
const NOW = new Date(Date.UTC(2025, 0, 1, 0, 0, 0));

describe("openSlots", () => {
  it("generates 30-min slots within an availability window", () => {
    const windows: AvailabilityWindow[] = [
      { dayOfWeek: 3, startMinute: 9 * 60, endMinute: 11 * 60, active: true }, // Wednesday 09:00–11:00
    ];
    const slots = openSlots(windows, [], { now: NOW, horizonDays: 0, leadMinutes: 0 });
    // 09:00, 09:30, 10:00, 10:30 → 4 slots (10:30+30 = 11:00 fits; 11:00 would need to end 11:30)
    expect(slots.length).toBe(4);
    expect(slots[0]!.toISOString()).toBe("2025-01-01T09:00:00.000Z");
    expect(slots[3]!.toISOString()).toBe("2025-01-01T10:30:00.000Z");
  });

  it("excludes already-booked slots", () => {
    const windows: AvailabilityWindow[] = [
      { dayOfWeek: 3, startMinute: 9 * 60, endMinute: 10 * 60, active: true },
    ];
    const booked = [new Date(Date.UTC(2025, 0, 1, 9, 0))];
    const slots = openSlots(windows, booked, { now: NOW, horizonDays: 0, leadMinutes: 0 });
    expect(slots.map((s) => s.toISOString())).toEqual(["2025-01-01T09:30:00.000Z"]);
  });

  it("respects the lead time", () => {
    const windows: AvailabilityWindow[] = [
      { dayOfWeek: 3, startMinute: 0, endMinute: 3 * 60, active: true },
    ];
    // 2h lead → the 00:00, 00:30, 01:00, 01:30 slots are too soon; first bookable is 02:00.
    const slots = openSlots(windows, [], { now: NOW, horizonDays: 0, leadMinutes: 120 });
    expect(slots[0]!.toISOString()).toBe("2025-01-01T02:00:00.000Z");
  });

  it("limits to the next N working days and skips weekends", () => {
    // Availability every day 09:00–09:30 (one slot/day).
    const windows: AvailabilityWindow[] = Array.from({ length: 7 }, (_, dow) => ({
      dayOfWeek: dow, startMinute: 9 * 60, endMinute: 9 * 60 + 30, active: true,
    }));
    // NOW = Wed 1 Jan 2025. Next 5 working days: Wed, Thu, Fri, Mon, Tue.
    const slots = openSlots(windows, [], { now: NOW, leadMinutes: 0, maxWorkingDays: 5 });
    expect(slots.length).toBe(5);
    // No weekend (Sat=6, Sun=0) days present.
    expect(slots.every((s) => s.getUTCDay() !== 0 && s.getUTCDay() !== 6)).toBe(true);
    // Last one is the following Tuesday.
    expect(slots[4]!.toISOString().slice(0, 10)).toBe("2025-01-07");
  });

  it("ignores inactive windows", () => {
    const windows: AvailabilityWindow[] = [
      { dayOfWeek: 3, startMinute: 9 * 60, endMinute: 11 * 60, active: false },
    ];
    expect(openSlots(windows, [], { now: NOW, horizonDays: 0, leadMinutes: 0 })).toEqual([]);
  });
});

describe("hhmm helpers", () => {
  it("round-trips", () => {
    expect(hhmmToMinutes("09:30")).toBe(570);
    expect(minutesToHHMM(570)).toBe("09:30");
    expect(hhmmToMinutes("24:00")).toBeNull();
    expect(hhmmToMinutes("bad")).toBeNull();
  });
});
