import { describe, expect, it } from "vitest";
import { elsewhereFor } from "@/lib/domain/clash-note";

describe("on another course at the same time", () => {
  it("names the first clashing course and when", () => {
    const m = elsewhereFor([{ date: "2026-10-12", slot: "AM" }, { date: "2026-10-13", slot: "PM" }], [
      { courseId: "b", courseName: "Youth Stage 3", date: "2026-10-13", slot: "PM", instructorIds: ["ann"] },
      { courseId: "c", courseName: "Powerboat", date: "2026-10-12", slot: "AM", instructorIds: ["ann", "bob"] },
      { courseId: "d", courseName: "Evening theory", date: "2026-10-12", slot: "EV", instructorIds: ["cat"] },
    ]);
    expect(m.get("ann")).toBe("Powerboat (Mon AM)");
    expect(m.get("bob")).toBe("Powerboat (Mon AM)");
    expect(m.has("cat")).toBe(false);
  });
});

describe("indexed lookups", () => {
  it("give the same answer and skip the course itself", async () => {
    const { indexSessions } = await import("@/lib/domain/clash-note");
    const sessions = [
      { courseId: "a", courseName: "Target", date: "2026-10-12", slot: "AM", instructorIds: ["ann"] },
      { courseId: "c", courseName: "Powerboat", date: "2026-10-12", slot: "AM", instructorIds: ["bob"] },
    ];
    const m = elsewhereFor([{ date: "2026-10-12", slot: "AM" }], indexSessions(sessions), "a");
    expect(m.get("bob")).toBe("Powerboat (Mon AM)");
    expect(m.has("ann")).toBe(false);
  });
});
