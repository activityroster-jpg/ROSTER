import { describe, expect, it } from "vitest";
import { clashes, clashModeFor, findConflicts, hasConflict, slotTimeOverlaps } from "@/lib/domain/conflict";
import { doubleBookings } from "@/lib/domain/problems";

const t = (hhmm: string) => Date.parse(`2026-10-05T${hhmm}:00Z`);
const b = (id: string, slot: string, from: string, to: string, courseId = id) => ({ sessionId: id, resourceId: "kim", startAt: t(from), endAt: t(to), date: "2026-10-05", slot, courseId });

describe("clashes by slot (AM / PM / EV)", () => {
  it("the session before or after never blocks, even when typed times overlap", () => {
    expect(clashes(b("am", "AM", "09:00", "13:30"), b("pm", "PM", "13:00", "16:30"), "slots")).toBe(false);
    expect(hasConflict(b("pm", "PM", "13:00", "16:30"), [b("am", "AM", "09:00", "13:30")], "slots")).toBe(false);
  });
  it("two sessions in the same slot on the same day do", () => {
    expect(clashes(b("a", "AM", "09:00", "10:00"), b("c", "AM", "11:00", "12:00"), "slots")).toBe(true);
    expect(findConflicts([b("a", "AM", "09:00", "10:00"), b("c", "AM", "11:00", "12:00")], "slots")).toHaveLength(1);
  });
  it("set-times centres compare times, and 13:00 to 13:00 is not an overlap", () => {
    expect(clashes(b("am", "AM", "09:00", "13:00"), b("pm", "PM", "13:00", "16:00"), "times")).toBe(false);
    expect(clashes(b("am", "AM", "09:00", "13:30"), b("pm", "PM", "13:00", "16:00"), "times")).toBe(true);
    expect(clashModeFor("times")).toBe("times");
    expect(clashModeFor("slots")).toBe("slots");
    expect(clashModeFor(null)).toBe("slots");
  });
  it("finds overlapping times across different slots, with the exact overlap", () => {
    const o = slotTimeOverlaps([b("am", "AM", "09:00", "13:30"), b("pm", "PM", "13:00", "16:30")]);
    expect(o).toHaveLength(1);
    expect([o[0]!.from, o[0]!.to]).toEqual([t("13:00"), t("13:30")]);
  });
});

describe("roster problems", () => {
  const sessions = [
    { id: "am", courseId: "c1", date: "2026-10-05", slot: "AM", startAt: t("09:00"), endAt: t("13:30") },
    { id: "pm", courseId: "c2", date: "2026-10-05", slot: "PM", startAt: t("13:00"), endAt: t("16:30") },
  ];
  const assignments = [{ courseId: "c1", instructorId: "kim", status: "confirmed" }, { courseId: "c2", instructorId: "kim", status: "confirmed" }];
  const courses = new Map([["c1", { id: "c1", name: "Stage 1" }], ["c2", { id: "c2", name: "Stage 2" }]]);
  const people = new Map([["kim", { id: "kim", name: "Kim" }]]);
  it("flags the overlap as a warning showing exactly when, not a double booking", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = doubleBookings(sessions as any, assignments as any, courses as any, people as any, "slots");
    expect(p.map((x) => x.kind)).toEqual(["times-overlap"]);
    expect(p[0]!.severity).toBe("warn");
    expect(p[0]!.detail).toContain("overlap 13:00–13:30");
  });
});
