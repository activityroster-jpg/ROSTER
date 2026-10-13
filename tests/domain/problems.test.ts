import { describe, expect, it } from "vitest";
import { availabilityProblems, sessionCoverageProblems, declinedProblems, describeProblem, doubleBookings, equipmentProblems, perAssignmentProblems, sortProblems, type ProblemAssignment, type ProblemCourse, type ProblemInstructor, type ProblemSession } from "@/lib/domain/problems";
import { horizonFor, indexAvailability, type AvailabilityIndex } from "@/lib/domain/availability";

const T = (h: number) => Date.UTC(2026, 0, 6, h); // Tuesday 6 January 2026
const sessions: ProblemSession[] = [
  { id: "s1", courseId: "c1", date: "2026-01-06", slot: "AM", startAt: T(9), endAt: T(12) },
  { id: "s2", courseId: "c2", date: "2026-01-06", slot: "AM", startAt: T(10), endAt: T(13) },
  { id: "s3", courseId: "c3", date: "2026-01-07", slot: "PM", startAt: T(37), endAt: T(40) },
];
const courses = new Map<string, ProblemCourse>([["c1", { id: "c1", name: "Kids camp", courseTypeId: "t1" }], ["c2", { id: "c2", name: "Adult taster", courseTypeId: "t2" }], ["c3", { id: "c3", name: "Powerboat", courseTypeId: "t3" }]]);
const instructors = new Map<string, ProblemInstructor>([["i1", { id: "i1", name: "Sam" }], ["i2", { id: "i2", name: "Jo" }]]);
const H = horizonFor("2026-01-05", 4);

describe("problems: pure detectors", () => {
  it("finds the same instructor on two overlapping sessions, dated by the earlier one, ignoring declines", () => {
    const a: ProblemAssignment[] = [{ id: "a1", courseId: "c1", instructorId: "i1", status: "assigned" }, { id: "a2", courseId: "c2", instructorId: "i1", status: "confirmed" }, { id: "a3", courseId: "c2", instructorId: "i2", status: "declined" }, { id: "a4", courseId: "c1", instructorId: "i2", status: "assigned" }];
    const out = doubleBookings(sessions, a, courses, instructors);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "double-booked", severity: "block", date: "2026-01-06", courseId: "c1", instructorName: "Sam", sessionId: "s1" });
    expect(out[0]!.detail).toMatch(/Adult taster/);
  });

  it("flags Busy, leave and never-answered slots against assignments", () => {
    const a: ProblemAssignment[] = [{ id: "a1", courseId: "c1", instructorId: "i1", status: "assigned" }, { id: "a2", courseId: "c3", instructorId: "i1", status: "assigned" }, { id: "a3", courseId: "c2", instructorId: "i2", status: "assigned" }];
    const avail = new Map<string, { index: AvailabilityIndex; setBy: Record<string, string> }>([
      ["i1", { index: indexAvailability([{ date: "2026-01-06", weekday: null, slot: "AM", status: "unavailable" }]), setBy: { "2026-01-06|AM": "leave" } }],
      ["i2", { index: indexAvailability([{ date: null, weekday: 2, slot: "AM", status: "unavailable" }]), setBy: {} }],
    ]);
    const out = sortProblems(availabilityProblems(sessions, a, courses, instructors, avail, H));
    // Same day: blocks before warnings, then by course name.
    expect(out.map((p) => [p.kind, p.instructorName, p.courseId])).toEqual([["busy", "Jo", "c2"], ["on-leave", "Sam", "c1"], ["not-answered", "Sam", "c3"]]);
    expect(out[0]!.detail).toMatch(/usual week/);
    expect(out[2]!.severity).toBe("warn");
    // Beyond the window nothing is flagged.
    const far: ProblemSession[] = [{ id: "s9", courseId: "c1", date: "2026-03-11", slot: "AM", startAt: 0, endAt: 1 }]; // a Wednesday: no usual-week answer, beyond the window
    expect(availabilityProblems(far, [{ id: "a", courseId: "c1", instructorId: "i2", status: "assigned" }], courses, instructors, avail, H)).toEqual([]);
  });

  it("lists declines, per-instructor findings, coverage and equipment", () => {
    const a: ProblemAssignment[] = [{ id: "a1", courseId: "c1", instructorId: "i1", status: "declined" }, { id: "a2", courseId: "c2", instructorId: "i2", status: "assigned" }];
    expect(declinedProblems(sessions, a, courses, instructors)[0]).toMatchObject({ kind: "declined", courseName: "Kids camp", instructorName: "Sam", date: "2026-01-06" });
    const nq = perAssignmentProblems("not-qualified", "warn", sessions, a, courses, instructors, (id, c) => (id === "i2" && c.courseTypeId === "t2" ? "No powerboat ticket" : null));
    expect(nq).toHaveLength(1);
    expect(nq[0]).toMatchObject({ kind: "not-qualified", instructorName: "Jo", courseId: "c2", detail: "No powerboat ticket" });
    const roles = new Map([["in", { countsTowardRatio: true, isSafetyCover: false }], ["sb", { countsTowardRatio: false, isSafetyCover: true }]]);
    const cov = sessionCoverageProblems(sessions, [{ id: "a2", courseId: "c1", instructorId: "i2", status: "assigned", roleTypeId: "in" }, { id: "a5", courseId: "c2", instructorId: "i1", status: "assigned", roleTypeId: "in" }], courses, new Map([
      ["c1", { capacity: 12, ratio: 6, staffRequired: null, requiresSafetyBoat: true, lines: [] }],
      ["c2", { capacity: 6, ratio: 6, staffRequired: null, requiresSafetyBoat: false, lines: [] }],
    ]), roles);
    expect(cov.map((p) => p.kind)).toEqual(["no-safety-cover", "unstaffed"]);
    expect(cov[1]!.detail).toBe("1 of 2 instructors rostered");
    const eq = equipmentProblems(sessions, [{ courseId: "c1", equipmentId: "e1" }, { courseId: "c2", equipmentId: "e1" }, { courseId: "c3", equipmentId: "e2" }, { courseId: "c3", equipmentId: null }], new Map([["e1", { name: "RIB 1", status: "available" }], ["e2", { name: "Laser 4", status: "maintenance" }]]), courses);
    expect(eq.map((p) => p.kind).sort()).toEqual(["equipment-clash", "equipment-maintenance"]);
    expect(eq.find((p) => p.kind === "equipment-clash")!.detail).toMatch(/RIB 1 is also on Adult taster/);
    expect(describeProblem(eq.find((p) => p.kind === "equipment-maintenance")!)).toBe("equipment in maintenance on Powerboat, 2026-01-07 PM (Laser 4 is in maintenance)");
  });

  it("cover is judged per session: a day skip leaves that day short, a day add fills it, role lines decide when set", () => {
    const week: ProblemSession[] = [
      { id: "mon", courseId: "w", date: "2026-01-05", slot: "AM", startAt: 1, endAt: 2 },
      { id: "tue", courseId: "w", date: "2026-01-06", slot: "AM", startAt: 3, endAt: 4 },
      { id: "wed", courseId: "w", date: "2026-01-07", slot: "AM", startAt: 5, endAt: 6 },
    ];
    const cs = new Map<string, ProblemCourse>([["w", { id: "w", name: "Week", courseTypeId: "t" }]]);
    const roles = new Map([["in", { countsTowardRatio: true, isSafetyCover: false }]]);
    const people: ProblemAssignment[] = [
      { id: "a", courseId: "w", instructorId: "i1", status: "assigned", roleTypeId: "in", skipSessionIds: ["tue", "wed"] },
      { id: "d", courseId: "w", instructorId: "i2", status: "assigned", roleTypeId: "in", onlySessionIds: ["wed"] },
    ];
    const ratio = sessionCoverageProblems(week, people, cs, new Map([["w", { capacity: 6, ratio: 6, staffRequired: null, requiresSafetyBoat: false, lines: [] }]]), roles);
    expect(ratio.map((p) => p.sessionId)).toEqual(["tue"]);
    const lines = sessionCoverageProblems(week, people, cs, new Map([["w", { capacity: 6, ratio: 6, staffRequired: null, requiresSafetyBoat: false, lines: [{ roleTypeId: "in", count: 2 }] }]]), roles);
    expect(lines.map((p) => [p.sessionId, p.detail])).toEqual([["mon", "1 of 2 places filled"], ["tue", "0 of 2 places filled"], ["wed", "1 of 2 places filled"]]);
  });
});
