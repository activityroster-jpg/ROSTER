import { describe, expect, it } from "vitest";
import { bySeniority, roleRank } from "@/lib/domain/role-rank";
import { buildRoleSlots } from "@/lib/domain/role-slots";

describe("role seniority", () => {
  it("ranks higher levels first and keeps ties in their given order", () => {
    const names = ["Safety Boat Driver", "Assistant Instructor", "Instructor", "Senior Instructor", "Volunteer", "Chief Instructor", "Divemaster"];
    expect(bySeniority(names.map((name) => ({ name }))).map((r) => r.name)).toEqual([
      "Chief Instructor", "Senior Instructor", "Instructor", "Divemaster", "Assistant Instructor", "Safety Boat Driver", "Volunteer",
    ]);
    expect(roleRank("Powerboat Coach")).toBe(roleRank("Instructor"));
    expect(roleRank("Something else")).toBe(40);
  });

  it("orders instructor-type places by their ladder rank, alongside named places", () => {
    const places = [
      { name: "Volunteer" },
      { name: "Keelboat Endorsement", rank: 20 },
      { name: "Assistant Instructor", rank: 10 },
      { name: "Coach/Assessor", rank: 50 },
      { name: "Senior Instructor", rank: 40 },
      { name: "Dinghy Instructor", rank: 20 },
    ];
    expect(bySeniority(places).map((r) => r.name)).toEqual([
      "Coach/Assessor", "Senior Instructor", "Keelboat Endorsement", "Dinghy Instructor", "Assistant Instructor", "Volunteer",
    ]);
  });

  it("orders staffing rows by seniority", () => {
    const slots = buildRoleSlots([
      { roleTypeId: "sb", roleName: "Safety Boat Driver", count: 1 },
      { roleTypeId: "ai", roleName: "Assistant Instructor", count: 2 },
      { roleTypeId: "si", roleName: "Senior Instructor", count: 1 },
    ], []);
    expect(slots.map((s) => s.label)).toEqual(["Senior Instructor", "Assistant Instructor 1", "Assistant Instructor 2", "Safety Boat Driver"]);
  });
});
