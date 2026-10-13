import { describe, expect, it } from "vitest";
import { roleAbbrev, welfareLine } from "@/lib/domain/role-abbrev";

describe("role abbreviations on the printed rota", () => {
  it("uses initials", () => {
    expect(roleAbbrev("Assistant Instructor")).toBe("AI");
    expect(roleAbbrev("Senior Instructor")).toBe("SI");
    expect(roleAbbrev("Instructor")).toBe("I");
    expect(roleAbbrev("Safety Boat Driver")).toBe("SBD");
    expect(roleAbbrev("Dive Centre Staff")).toBe("DCS");
    expect(roleAbbrev("Galley / Bar")).toBe("GB");
  });
  it("uses the instructor type's code for a typed place", () => {
    expect(roleAbbrev("Powerboat Instructor", "PBI")).toBe("PBI");
    expect(roleAbbrev("Paddleboard (SUP) Instructor", "SUPI")).toBe("SUPI");
    expect(roleAbbrev("Volunteer", null)).toBe("V");
  });
  it("says 'all day' when one person covers every slot", () => {
    expect(welfareLine({ AM: "Conor", PM: "Conor", EV: "Conor" })).toBe("Conor (all day)");
    expect(welfareLine({ AM: "Conor", PM: "Sam" })).toBe("Morning: Conor   Afternoon: Sam");
    expect(welfareLine({ AM: "Conor" })).toBe("Morning: Conor");
    expect(welfareLine({})).toBe("");
  });
});
