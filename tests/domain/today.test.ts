import { describe, expect, it } from "vitest";
import { summariseToday } from "@/lib/domain/today";

const T = (h: number) => Date.UTC(2026, 9, 10, h);

describe("the Today strip", () => {
  it("counts sessions, distinct people, uncovered sessions, declines and unconfirmed", () => {
    const s = summariseToday([
      { sessionId: "a", courseName: "Stage 1", startAt: T(9), endAt: T(12), coverageOk: true, staff: [{ instructorId: "sam", name: "Sam", status: "confirmed" }, { instructorId: "jo", name: "Jo", status: "assigned" }] },
      { sessionId: "b", courseName: "Taster", startAt: T(13), endAt: T(16), coverageOk: false, staff: [{ instructorId: "sam", name: "Sam", status: "confirmed" }, { instructorId: "kim", name: "Kim", status: "declined" }] },
      { sessionId: "c", courseName: "Powerboat", startAt: T(14), endAt: T(17), coverageOk: true, staff: [] },
    ]);
    expect(s).toEqual({ sessions: 3, people: 2, uncovered: 2, declined: 1, unconfirmed: 1, firstStart: T(9), lastEnd: T(17), declinedNames: ["Kim"] });
  });

  it("an empty day is quiet", () => {
    expect(summariseToday([])).toEqual({ sessions: 0, people: 0, uncovered: 0, declined: 0, unconfirmed: 0, firstStart: null, lastEnd: null, declinedNames: [] });
  });
});
