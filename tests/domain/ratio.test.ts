import { describe, expect, it } from "vitest";
import { evaluateRatio, requiredInstructors, type AssignedRole } from "@/lib/domain";

const instructor = (id: string): AssignedRole => ({ instructorId: id, countsTowardRatio: true, isSafetyCover: false });
const safety = (id: string): AssignedRole => ({ instructorId: id, countsTowardRatio: false, isSafetyCover: true });

describe("requiredInstructors", () => {
  it("rounds up students / ratio", () => {
    expect(requiredInstructors(6, 3)).toBe(2);
    expect(requiredInstructors(7, 3)).toBe(3);
    expect(requiredInstructors(0, 3)).toBe(0);
  });
});

describe("evaluateRatio", () => {
  it("flags under-staffed courses", () => {
    const r = evaluateRatio({ groupSize: 6, ratio: 3, requiresSafetyBoat: false, assigned: [instructor("a")] });
    expect(r.understaffed).toBe(true);
    expect(r.requiredStaff).toBe(2);
    expect(r.ok).toBe(false);
  });

  it("passes when enough ratio-counting staff are present", () => {
    const r = evaluateRatio({
      groupSize: 6,
      ratio: 3,
      requiresSafetyBoat: false,
      assigned: [instructor("a"), instructor("b")],
    });
    expect(r.understaffed).toBe(false);
    expect(r.ok).toBe(true);
  });

  it("flags missing safety cover when a safety boat is required", () => {
    const r = evaluateRatio({
      groupSize: 3,
      ratio: 3,
      requiresSafetyBoat: true,
      assigned: [instructor("a")],
    });
    expect(r.missingSafetyCover).toBe(true);
    expect(r.ok).toBe(false);
  });

  it("safety-cover staff do not count toward ratio", () => {
    const r = evaluateRatio({
      groupSize: 6,
      ratio: 3,
      requiresSafetyBoat: true,
      assigned: [instructor("a"), safety("s")],
    });
    // Only one ratio-counting instructor for a group needing two.
    expect(r.understaffed).toBe(true);
    expect(r.missingSafetyCover).toBe(false);
  });

  it("measures an explicit staff total against everyone assigned, and treats 0 as no staff needed", () => {
    const sb: AssignedRole = { instructorId: "s", countsTowardRatio: false, isSafetyCover: true };
    // Two instructors + one safety boat driver fill a listed total of 3.
    const r = evaluateRatio({ groupSize: 12, ratio: 4, requiresSafetyBoat: true, staffRequired: 3, assigned: [instructor("a"), instructor("b"), sb] });
    expect(r.understaffed).toBe(false);
    expect(r.requiredStaff).toBe(3);
    expect(r.ratioCountingStaff).toBe(3);
    // The ratio alone would want 3 instructors here; the office's 2 wins.
    expect(evaluateRatio({ groupSize: 12, ratio: 4, requiresSafetyBoat: false, staffRequired: 2, assigned: [instructor("a"), instructor("b")] }).ok).toBe(true);
    const none = evaluateRatio({ groupSize: 12, ratio: 4, requiresSafetyBoat: true, staffRequired: 0, assigned: [] });
    expect(none.ok).toBe(true);
    expect(none.missingSafetyCover).toBe(false);
  });
});
