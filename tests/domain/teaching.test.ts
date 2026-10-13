import { describe, expect, it } from "vitest";
import { approvalCourses, canFillPlace, expiredTypesFor, canTeachByRules, coursesTaught, defaultPlaceType, placeFitIssue, rulesByCourse, unsupervised, type TeachRule, type TypeInfo } from "@/lib/domain/teaching";

const type = (id: string, discipline: string | null, rank: number, extra: Partial<TypeInfo> = {}): TypeInfo => ({ id, name: id, discipline, rank, needsSupervision: false, supervises: false, ...extra });
const TYPES = new Map<string, TypeInfo>([
  ["AI", type("AI", "dinghy", 10, { needsSupervision: true })],
  ["DI", type("DI", "dinghy", 20, { needsSupervision: true })],
  ["ADI", type("ADI", "dinghy", 30)],
  ["SI", type("SI", "dinghy", 40, { supervises: true })],
  ["KBI", type("KBI", "keelboat", 20, { needsSupervision: true })],
  ["PBI", type("PBI", "powerboat", 20)],
  ["APBI", type("APBI", "powerboat", 30)],
  ["SBC", type("SBC", null, 15)],
  ["CEND", type("CEND", null, 16)],
  ["SWI", type("SWI", "windsurf", 40, { supervises: true })],
]);
const rule = (q: string, c: string, extra: Partial<TeachRule> = {}): TeachRule => ({ qualificationTypeId: q, courseTypeId: c, alsoRequiresTypeId: null, needsApproval: false, ...extra });
const RULES = [
  rule("AI", "L1"), rule("DI", "L1"), rule("SI", "L1"),
  rule("DI", "DaySailing", { needsApproval: true }), rule("SI", "DaySailing"),
  rule("PBI", "PB1"),
  rule("PBI", "SafetyBoat", { alsoRequiresTypeId: "SBC" }),
  rule("APBI", "Intermediate"), rule("APBI", "Advanced", { alsoRequiresTypeId: "CEND" }),
];
const byCourse = rulesByCourse(RULES);
const held = (...ids: string[]) => new Set(ids);

describe("who can teach what", () => {
  it("follows the course map, with the Principal's approval and also-required certificates", () => {
    expect(canTeachByRules(byCourse.get("L1"), held("AI"), held())).toBe(true);
    expect(canTeachByRules(byCourse.get("PB1"), held("DI"), held())).toBe(false);
    // A DI teaches Day Sailing only once approved; an SI always can.
    expect(canTeachByRules(byCourse.get("DaySailing"), held("DI"), held())).toBe(false);
    expect(canTeachByRules(byCourse.get("DaySailing"), held("DI"), held("DaySailing"))).toBe(true);
    expect(canTeachByRules(byCourse.get("DaySailing"), held("SI"), held())).toBe(true);
    // Safety Boat needs the Safety Boat certificate too; Advanced needs the commercial endorsement.
    expect(canTeachByRules(byCourse.get("SafetyBoat"), held("PBI"), held())).toBe(false);
    expect(canTeachByRules(byCourse.get("SafetyBoat"), held("PBI", "SBC"), held())).toBe(true);
    expect(canTeachByRules(byCourse.get("Advanced"), held("APBI"), held())).toBe(false);
    expect(canTeachByRules(byCourse.get("Intermediate"), held("APBI"), held())).toBe(true);
    // A course nobody has mapped falls back to the caller.
    expect(canTeachByRules(byCourse.get("Unmapped"), held("DI"), held())).toBeNull();
  });

  it("lets a higher type on the same ladder fill a lower place, never a lower or another ladder's", () => {
    expect(canFillPlace(held("SI"), "DI", TYPES)).toBe(true);
    expect(canFillPlace(held("ADI"), "DI", TYPES)).toBe(true);
    expect(canFillPlace(held("AI"), "DI", TYPES)).toBe(false);
    expect(canFillPlace(held("DI"), "SI", TYPES)).toBe(false);
    expect(canFillPlace(held("SI"), "KBI", TYPES)).toBe(false); // keelboat needs its own endorsement
    expect(canFillPlace(held("APBI"), "PBI", TYPES)).toBe(true);
    expect(canFillPlace(held(), null, TYPES)).toBe(true); // Volunteer: anyone
  });

  it("defaults a course's places to its lead type on its own ladder, not an assistant", () => {
    expect(defaultPlaceType(byCourse.get("L1"), TYPES, "dinghy")).toBe("DI");
    expect(defaultPlaceType(byCourse.get("PB1"), TYPES, "powerboat")).toBe("PBI");
    expect(defaultPlaceType(byCourse.get("Advanced"), TYPES, "powerboat")).toBe("APBI");
    expect(defaultPlaceType(undefined, TYPES, "dinghy")).toBeNull();
  });

  it("warns about a supervised instructor only when no supervisor for their ladder is on in the slot", () => {
    const ai = { instructorId: "a", name: "Ann", placeTypeId: "AI", held: held("AI") };
    const si = { instructorId: "s", name: "Sam", placeTypeId: "DI", held: held("SI") };
    const swi = { instructorId: "w", name: "Wes", placeTypeId: null, held: held("SWI") };
    expect(unsupervised([ai], TYPES).map((x) => x.person.instructorId)).toEqual(["a"]);
    expect(unsupervised([ai, si], TYPES)).toEqual([]); // an SI on duty anywhere in the slot covers it
    expect(unsupervised([ai, swi], TYPES).map((x) => x.person.instructorId)).toEqual(["a"]); // a windsurf SI doesn't supervise dinghy
    expect(unsupervised([si], TYPES)).toEqual([]); // an SI in a DI place supervises themselves
  });

  it("judges a pick for a place the way the server does, and nobody with nothing on file", () => {
    const di = { id: "pDI", name: "Dinghy Instructor", countsTowardRatio: true, qualificationTypeId: "DI" };
    const vol = { id: "pVol", name: "Volunteer", countsTowardRatio: false, qualificationTypeId: null };
    const sam = { knownQualifications: true, teaches: ["L1"], fills: ["pDI", "pVol"] };
    const ann = { knownQualifications: true, teaches: ["L1"], fills: ["pVol"] }; // an AI: teaches Level 1, can't fill a DI place
    const newbie = { knownQualifications: false, teaches: [], fills: [] };
    expect(placeFitIssue(sam, "L1", di)).toBeNull();
    expect(placeFitIssue(sam, "PB1", di)).toBe("course");
    expect(placeFitIssue(ann, "L1", di)).toBe("place");
    expect(placeFitIssue(ann, "PB1", vol)).toBeNull(); // a Volunteer place isn't a teaching place
    expect(placeFitIssue(newbie, "PB1", di)).toBeNull();
  });

  it("lists the courses someone teaches: the map first, then the fallbacks for unmapped courses", () => {
    const courses = [
      { id: "L1", discipline: "dinghy" }, { id: "DaySailing", discipline: "dinghy" }, { id: "PB1", discipline: "powerboat" },
      { id: "OwnDinghy", discipline: "dinghy" }, { id: "Ticked", discipline: null }, { id: "Staffed", discipline: null },
    ];
    const staffing = new Map([["Staffed", ["PBI"]]]);
    const di = coursesTaught(courses, byCourse, held("DI"), held("Ticked"), TYPES, staffing);
    expect([...di.keys()].sort()).toEqual(["L1", "OwnDinghy", "Ticked"]);
    expect(di.get("L1")).toBe(true); // from the course map
    expect(di.get("OwnDinghy")).toBe(false); // unmapped: by activity only
    expect([...coursesTaught(courses, byCourse, held("DI"), held("DaySailing"), TYPES).keys()]).toContain("DaySailing");
    expect([...coursesTaught(courses, byCourse, held("PBI"), held(), TYPES, staffing).keys()].sort()).toEqual(["PB1", "Staffed"]);
  });

  it("offers the Principal's approval only where it is someone's only way in", () => {
    expect(approvalCourses(byCourse, held("DI"))).toEqual(["DaySailing"]);
    expect(approvalCourses(byCourse, held("DI", "SI"))).toEqual([]); // an SI teaches it outright
    expect(approvalCourses(byCourse, held("AI"))).toEqual([]);
  });
});

describe("expiredTypesFor: an expired instructor type only warns", () => {
  const ty = (id: string, discipline: string | null, rank: number) => ({ id, name: id, discipline, rank, needsSupervision: false, supervises: false });
  const types = new Map([["DI", ty("DI", "dinghy", 20)], ["SI", ty("SI", "dinghy", 40)], ["PBI", ty("PBI", "powerboat", 20)], ["FA", ty("FA", null, 0)]]);
  const rules = new Map([["stage1", [{ qualificationTypeId: "DI", courseTypeId: "stage1", alsoRequiresTypeId: null, needsApproval: false }]]]);

  it("flags the place's ladder at or above the place, once past the session date", () => {
    const expiry = new Map<string, string | null>([["SI", "2026-05-01"], ["PBI", "2026-01-01"], ["FA", "2026-01-01"]]);
    expect(expiredTypesFor(expiry, "2026-06-01", "DI", "stage1", rules, types).map((t) => t.id)).toEqual(["SI"]);
    expect(expiredTypesFor(expiry, "2026-04-30", "DI", "stage1", rules, types)).toEqual([]);
  });
  it("without a typed place, looks at the types that teach the course", () => {
    expect(expiredTypesFor(new Map([["DI", "2026-01-01"]]), "2026-06-01", null, "stage1", rules, types).map((t) => t.id)).toEqual(["DI"]);
    expect(expiredTypesFor(new Map([["DI", null]]), "2026-06-01", null, "stage1", rules, types)).toEqual([]);
  });
});
