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

  it("orders staffing rows by seniority", () => {
    const slots = buildRoleSlots([
      { roleTypeId: "sb", roleName: "Safety Boat Driver", count: 1 },
      { roleTypeId: "ai", roleName: "Assistant Instructor", count: 2 },
      { roleTypeId: "si", roleName: "Senior Instructor", count: 1 },
    ], []);
    expect(slots.map((s) => s.label)).toEqual(["Senior Instructor", "Assistant Instructor 1", "Assistant Instructor 2", "Safety Boat Driver"]);
  });
});
