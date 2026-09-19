import { describe, expect, it } from "vitest";
import { findConflicts, hasConflict, overlaps, type ResourceBooking } from "@/lib/domain";

const H = 60 * 60 * 1000;
const base = Date.UTC(2026, 0, 5, 9, 0, 0); // Mon 09:00

function booking(sessionId: string, resourceId: string, startH: number, endH: number): ResourceBooking {
  return { sessionId, resourceId, startAt: base + startH * H, endAt: base + endH * H };
}

describe("overlaps", () => {
  it("half-open: touching intervals do not overlap", () => {
    expect(overlaps({ startAt: 0, endAt: 10 }, { startAt: 10, endAt: 20 })).toBe(false);
  });
  it("detects genuine overlap", () => {
    expect(overlaps({ startAt: 0, endAt: 10 }, { startAt: 5, endAt: 15 })).toBe(true);
  });
});

describe("findConflicts", () => {
  it("flags the same instructor double-booked on overlapping sessions", () => {
    const bookings = [
      booking("s1", "inst-1", 0, 3),
      booking("s2", "inst-1", 2, 5), // overlaps s1
      booking("s3", "inst-2", 0, 3), // different resource, no conflict
    ];
    const conflicts = findConflicts(bookings);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.resourceId).toBe("inst-1");
  });

  it("does not flag back-to-back sessions", () => {
    const bookings = [booking("s1", "inst-1", 0, 3), booking("s2", "inst-1", 3, 6)];
    expect(findConflicts(bookings)).toHaveLength(0);
  });

  it("does not flag the same session appearing twice", () => {
    const bookings = [booking("s1", "inst-1", 0, 3), booking("s1", "inst-1", 0, 3)];
    expect(findConflicts(bookings)).toHaveLength(0);
  });
});

describe("hasConflict", () => {
  it("detects a clash against existing bookings", () => {
    const existing = [booking("s1", "boat-7", 0, 3)];
    expect(hasConflict(booking("s2", "boat-7", 2, 4), existing)).toBe(true);
    expect(hasConflict(booking("s2", "boat-8", 2, 4), existing)).toBe(false);
  });
});
