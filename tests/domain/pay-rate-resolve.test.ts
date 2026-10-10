import { describe, expect, it } from "vitest";
import { resolvePayRate, type PayRateRule } from "@/lib/domain";

const rule = (r: Partial<PayRateRule> & { rate: number }): PayRateRule => ({ instructorId: null, roleTypeId: null, courseTypeId: null, unit: "hour", ...r });

describe("which pay rate applies", () => {
  const rules: PayRateRule[] = [
    rule({ rate: 10 }),                                                    // centre: everyone else
    rule({ roleTypeId: "inst", rate: 15 }),                                // centre: instructors
    rule({ roleTypeId: "inst", courseTypeId: "pb2", rate: 20, unit: "session" }), // centre: instructors on Powerboat 2
    rule({ courseTypeId: "camp", rate: 90, unit: "day" }),                 // centre: anyone on camps
    rule({ instructorId: "amy", rate: 17 }),                               // Amy's own rate
    rule({ instructorId: "amy", courseTypeId: "pb2", rate: 25, unit: "session" }), // Amy on Powerboat 2
    rule({ instructorId: "ben", roleTypeId: "sbd", rate: 13 }),            // Ben as safety boat driver (older role rate)
  ];

  it("uses the centre's rate for the role, else the general rate", () => {
    expect(resolvePayRate(rules, { instructorId: "cat", roleTypeId: "inst", courseTypeId: "dinghy" })).toMatchObject({ rate: 15, source: "centre-role" });
    expect(resolvePayRate(rules, { instructorId: "cat", roleTypeId: "asst", courseTypeId: "dinghy" })).toMatchObject({ rate: 10, source: "centre" });
  });

  it("a course rate beats a role rate, and a role on a course beats both", () => {
    expect(resolvePayRate(rules, { instructorId: "cat", roleTypeId: "asst", courseTypeId: "camp" })).toMatchObject({ rate: 90, unit: "day", source: "centre-course" });
    expect(resolvePayRate(rules, { instructorId: "cat", roleTypeId: "inst", courseTypeId: "pb2" })).toMatchObject({ rate: 20, unit: "session", source: "centre-course" });
  });

  it("a person's own rate beats every centre rate; their course rate beats their own rate", () => {
    expect(resolvePayRate(rules, { instructorId: "amy", roleTypeId: "inst", courseTypeId: "camp" })).toMatchObject({ rate: 17, source: "person" });
    expect(resolvePayRate(rules, { instructorId: "amy", roleTypeId: "inst", courseTypeId: "pb2" })).toMatchObject({ rate: 25, unit: "session", source: "person-course" });
    expect(resolvePayRate(rules, { instructorId: "ben", roleTypeId: "sbd", courseTypeId: "dinghy" })).toMatchObject({ rate: 13, source: "person-role" });
    expect(resolvePayRate(rules, { instructorId: "ben", roleTypeId: "inst", courseTypeId: "dinghy" })).toMatchObject({ rate: 15, source: "centre-role" });
  });

  it("nothing set means pay is unknown, not zero", () => {
    expect(resolvePayRate([], { instructorId: "amy", roleTypeId: "inst", courseTypeId: "pb2" })).toBeNull();
    expect(resolvePayRate([rule({ instructorId: "amy", rate: 17 })], { instructorId: "zed", roleTypeId: null, courseTypeId: null })).toBeNull();
  });

  it("pence come from the stored pence when there are any", () => {
    expect(resolvePayRate([rule({ rate: 14.5, ratePence: 1450 })], { instructorId: "x", roleTypeId: null, courseTypeId: null })?.ratePence).toBe(1450);
    expect(resolvePayRate([rule({ rate: 14.555 })], { instructorId: "x", roleTypeId: null, courseTypeId: null })?.ratePence).toBe(1456);
  });
});
