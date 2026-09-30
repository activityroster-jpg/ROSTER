import { describe, it, expect } from "vitest";
import { qualTeachDiscipline, courseTeachDiscipline, coursesForQuals } from "@/lib/rya/teaching-map";
import { DEFAULT_GRADES, DEFAULT_COURSE_TYPES } from "@/lib/seed/catalogue";

const COURSES = DEFAULT_COURSE_TYPES.map((c, i) => ({ id: String(i), name: c.name, scheme: c.scheme, category: c.category ?? null }));
const idsToNames = (ids: Set<string>) => new Set([...ids].map((id) => COURSES[Number(id)]!.name));
const teachable = (qualName: string) => idsToNames(coursesForQuals([qualName], COURSES));

describe("qualTeachDiscipline", () => {
  it("maps real RYA instructor grades to a discipline", () => {
    expect(qualTeachDiscipline("Dinghy Instructor")).toBe("dinghy");
    expect(qualTeachDiscipline("Keelboat Instructor")).toBe("keelboat");
    expect(qualTeachDiscipline("Windsurfing Instructor")).toBe("windsurf");
    expect(qualTeachDiscipline("Paddleboard (SUP) Instructor")).toBe("sup");
    expect(qualTeachDiscipline("Powerboat Instructor")).toBe("powerboat");
    expect(qualTeachDiscipline("Cruising Instructor")).toBe("cruising");
    expect(qualTeachDiscipline("Shorebased Instructor")).toBe("shorebased");
  });

  it("returns null for non-teaching / uncertain tickets (err on caution)", () => {
    expect(qualTeachDiscipline("Dinghy Assistant Instructor")).toBeNull();
    expect(qualTeachDiscipline("Safety Boat Certificate")).toBeNull();
    expect(qualTeachDiscipline("First Aid Instructor")).toBeNull();
  });
});

describe("courseTeachDiscipline", () => {
  it("classifies core courses by scheme", () => {
    expect(courseTeachDiscipline({ name: "Start Sailing (Level 1)", scheme: "RYA National Sailing", category: "Adult dinghy" })).toBe("dinghy");
    expect(courseTeachDiscipline({ name: "Powerboat Level 2", scheme: "RYA Powerboat", category: "Powerboat" })).toBe("powerboat");
    expect(courseTeachDiscipline({ name: "Start Windsurfing", scheme: "RYA Windsurfing", category: "Windsurfing" })).toBe("windsurf");
    expect(courseTeachDiscipline({ name: "Day Skipper (Practical)", scheme: "RYA Cruising", category: "Yacht cruising" })).toBe("cruising");
    expect(courseTeachDiscipline({ name: "Day Skipper Theory", scheme: "RYA Shorebased", category: "Shorebased theory" })).toBe("shorebased");
  });

  it("does NOT classify racing or sailability (needs a specialist)", () => {
    expect(courseTeachDiscipline({ name: "Club Racing", scheme: "RYA National Sailing", category: "Racing" })).toBeNull();
    expect(courseTeachDiscipline({ name: "Sailability Session", scheme: "RYA Sailability", category: "Sailability" })).toBeNull();
  });
});

describe("coursesForQuals against the real catalogue", () => {
  it("Dinghy Instructor teaches core dinghy courses, not powerboat/racing/sailability", () => {
    const t = teachable("Dinghy Instructor");
    expect(t.has("Start Sailing (Level 1)")).toBe(true);
    expect(t.has("Basic Skills (Level 2)")).toBe(true);
    expect(t.has("Youth Stage 1")).toBe(true);
    expect(t.has("Powerboat Level 1")).toBe(false);
    expect(t.has("Club Racing")).toBe(false);
    expect(t.has("Sailability Session")).toBe(false);
    expect(t.has("Day Skipper Theory")).toBe(false);
  });

  it("Powerboat Instructor teaches powerboat courses only", () => {
    const t = teachable("Powerboat Instructor");
    expect(t.has("Powerboat Level 1")).toBe(true);
    expect(t.has("Safety Boat Course")).toBe(true);
    expect(t.has("Start Sailing (Level 1)")).toBe(false);
  });

  it("Cruising / Shorebased instructors stay in their lane", () => {
    const cruise = teachable("Cruising Instructor");
    expect(cruise.has("Competent Crew")).toBe(true);
    expect(cruise.has("Start Sailing (Level 1)")).toBe(false);
    const shore = teachable("Shorebased Instructor");
    expect(shore.has("Day Skipper Theory")).toBe(true);
    expect(shore.has("Start Sailing (Level 1)")).toBe(false);
  });

  it("Non-teaching tickets preselect nothing", () => {
    expect(teachable("Safety Boat Certificate").size).toBe(0);
    expect(teachable("Dinghy Assistant Instructor").size).toBe(0);
  });
});
