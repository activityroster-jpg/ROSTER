import { describe, expect, it } from "vitest";
import { candidateTier, courseStateAvailable, groupCandidates, sortCandidates } from "@/lib/domain/assign-order";

const p = (name: string, fit: boolean, qualified: boolean | null, available: boolean) => ({ name, fit, qualified, available });
const facts = (x: ReturnType<typeof p>) => x;

describe("assignment order", () => {
  it("green: qualified and free; orange: qualified but not free; red: not qualified or not cleared", () => {
    expect(candidateTier(p("a", true, true, true))).toBe("ready");
    expect(candidateTier(p("a", true, null, true))).toBe("ready");
    expect(candidateTier(p("a", true, true, false))).toBe("busy");
    expect(candidateTier(p("a", true, false, true))).toBe("blocked");
    expect(candidateTier(p("a", false, true, true))).toBe("blocked");
  });

  it("sorts and groups in that order, names alphabetical within a group", () => {
    const xs = [p("Zed", true, false, true), p("Bob", true, true, false), p("Ann", true, true, true), p("Cat", true, null, true), p("Dee", false, true, true)];
    expect(sortCandidates(xs, facts, (x) => x.name).map((x) => x.name)).toEqual(["Ann", "Cat", "Bob", "Dee", "Zed"]);
    expect(groupCandidates(xs, facts, (x) => x.name).map((g) => [g.tier, g.items.length])).toEqual([["ready", 2], ["busy", 1], ["blocked", 2]]);
  });

  it("treats not-asked as free and Busy, partly busy or unanswered as not", () => {
    expect(courseStateAvailable("available")).toBe(true);
    expect(courseStateAvailable("unset")).toBe(true);
    expect(courseStateAvailable("none")).toBe(true);
    expect(courseStateAvailable("unavailable")).toBe(false);
    expect(courseStateAvailable("partial")).toBe(false);
    expect(courseStateAvailable("silent")).toBe(false);
  });
});
