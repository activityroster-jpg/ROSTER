import { describe, expect, it } from "vitest";
import { planAutoRoster, type AutoInstructor, type AutoSession } from "@/lib/domain/auto-roster";

const sess = (id: string, date: string, slot: string, missing = 1, extra: Partial<AutoSession> = {}): AutoSession =>
  ({ sessionId: id, courseId: `c-${id}`, courseTypeId: "dinghy", date, slot, open: [{ roleTypeId: "instr", missing }], onSession: [], ...extra });
const person = (id: string, availability: Record<string, "available" | "tentative" | "unavailable" | "unasked">, extra: Partial<AutoInstructor> = {}): AutoInstructor =>
  ({ id, name: id, fit: true, teaches: [], knownQualifications: false, availability, load: 0, ...extra });

describe("planAutoRoster", () => {
  it("spreads sessions evenly across the people who are free", () => {
    const sessions = [sess("s1", "2026-10-12", "AM"), sess("s2", "2026-10-12", "PM"), sess("s3", "2026-10-13", "AM"), sess("s4", "2026-10-13", "PM")];
    const free = { "2026-10-12|AM": "available", "2026-10-12|PM": "available", "2026-10-13|AM": "available", "2026-10-13|PM": "available" } as const;
    const plan = planAutoRoster(sessions, [person("ann", free), person("bob", free)]);
    expect(plan.complete).toBe(true);
    const count = (id: string) => plan.picks.filter((p) => p.instructorId === id).length;
    expect(count("ann")).toBe(2);
    expect(count("bob")).toBe(2);
  });

  it("counts what people already have this week when evening out", () => {
    const sessions = [sess("s1", "2026-10-12", "AM"), sess("s2", "2026-10-12", "PM")];
    const free = { "2026-10-12|AM": "available", "2026-10-12|PM": "available" } as const;
    const plan = planAutoRoster(sessions, [person("ann", free, { load: 3 }), person("bob", free, { load: 0 })]);
    expect(plan.picks.map((p) => p.instructorId)).toEqual(["bob", "bob"]);
  });

  it("never uses someone who is Busy, prefers Free over Maybe, and leaves a role open rather than forcing it", () => {
    const sessions = [sess("s1", "2026-10-12", "AM", 2)];
    const plan = planAutoRoster(sessions, [
      person("busy", { "2026-10-12|AM": "unavailable" }),
      person("maybe", { "2026-10-12|AM": "tentative" }),
    ]);
    expect(plan.picks.map((p) => p.instructorId)).toEqual(["maybe"]);
    expect(plan.complete).toBe(false);
    expect(plan.unfilled).toEqual([{ sessionId: "s1", roleTypeId: "instr", missing: 1, date: "2026-10-12", slot: "AM" }]);
  });

  it("skips people who are not cleared, not qualified for the course type, or already on the session", () => {
    const sessions = [sess("s1", "2026-10-12", "AM", 1, { onSession: ["already"] })];
    const plan = planAutoRoster(sessions, [
      person("already", { "2026-10-12|AM": "available" }),
      person("unfit", { "2026-10-12|AM": "available" }, { fit: false }),
      person("power-only", { "2026-10-12|AM": "available" }, { teaches: ["powerboat"], knownQualifications: true }),
      person("ok", { "2026-10-12|AM": "available" }, { teaches: ["dinghy"], knownQualifications: true }),
    ]);
    expect(plan.picks.map((p) => p.instructorId)).toEqual(["ok"]);
  });

  it("does not put one person on two sessions in the same slot", () => {
    const sessions = [sess("s1", "2026-10-12", "AM"), sess("s2", "2026-10-12", "AM")];
    const plan = planAutoRoster(sessions, [person("ann", { "2026-10-12|AM": "available" })]);
    expect(plan.picks).toHaveLength(1);
    expect(plan.unfilled).toHaveLength(1);
  });

  it("does nothing with nothing open", () => {
    expect(planAutoRoster([sess("s1", "2026-10-12", "AM", 0, { open: [] })], [person("ann", {})])).toEqual({ picks: [], unfilled: [], complete: true });
  });
});
