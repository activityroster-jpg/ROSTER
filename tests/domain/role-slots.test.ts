import { describe, expect, it } from "vitest";
import { buildRoleSlots, openPlaces, type SlotPerson } from "@/lib/domain/role-slots";

const person = (name: string, roleTypeId: string, status: SlotPerson["status"] = "assigned"): SlotPerson =>
  ({ assignmentId: `a-${name}`, instructorId: `i-${name}`, name, roleTypeId, roleName: roleTypeId, status });

describe("role slots", () => {
  it("one row per required place, numbered when a role needs more than one", () => {
    const slots = buildRoleSlots([{ roleTypeId: "Instructor", roleName: "Instructor", count: 2 }, { roleTypeId: "Safety", roleName: "Safety Boat Driver", count: 1 }], [person("Ann", "Instructor")]);
    expect(slots.map((s) => [s.label, s.person?.name ?? null])).toEqual([["Instructor 1", "Ann"], ["Instructor 2", null], ["Safety Boat Driver", null]]);
    expect(openPlaces(slots)).toBe(2);
  });

  it("a declined person doesn't hold a place; extra people show as not required", () => {
    const slots = buildRoleSlots([{ roleTypeId: "Instructor", roleName: "Instructor", count: 1 }], [person("Dee", "Instructor", "declined"), person("Vol", "Volunteer")]);
    expect(slots.map((s) => [s.label, s.person?.name ?? null, Boolean(s.extra)])).toEqual([["Instructor", null, false], ["Instructor", "Dee", true], ["Volunteer", "Vol", true]]);
    expect(openPlaces(slots)).toBe(1);
  });

  it("more people than places keeps everyone visible", () => {
    const slots = buildRoleSlots([{ roleTypeId: "Instructor", roleName: "Instructor", count: 1 }], [person("Ann", "Instructor"), person("Bob", "Instructor")]);
    expect(slots.map((s) => [s.label, s.person?.name, Boolean(s.extra)])).toEqual([["Instructor 1", "Ann", false], ["Instructor 2", "Bob", true]]);
  });
});
