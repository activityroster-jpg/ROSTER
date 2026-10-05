import { describe, expect, it } from "vitest";
import { cleanKitRules, describeKitRule, kitFromRules } from "@/lib/domain/kit";

describe("kit rules", () => {
  it("works out a course's kit from the student number, rounding up", () => {
    const rules = [
      { equipmentTypeId: "pico", quantity: 1, perStudents: 2 },
      { equipmentTypeId: "rib", quantity: 1, perStudents: null },
      { equipmentTypeId: "pico", quantity: 1, perStudents: null }, // a spare
    ];
    expect(kitFromRules(rules, 7)).toEqual([{ equipmentTypeId: "pico", quantity: 5 }, { equipmentTypeId: "rib", quantity: 1 }]);
    expect(kitFromRules(rules, 0)).toEqual([{ equipmentTypeId: "pico", quantity: 1 }, { equipmentTypeId: "rib", quantity: 1 }]);
  });

  it("cleans form input: unknown types, zeros and duplicates dropped, numbers capped", () => {
    const known = new Set(["pico", "rib"]);
    expect(cleanKitRules([
      { equipmentTypeId: "pico", quantity: 1, perStudents: 2 },
      { equipmentTypeId: "pico", quantity: 3, perStudents: 2 },
      { equipmentTypeId: "ghost", quantity: 1 },
      { equipmentTypeId: "rib", quantity: 0 },
      { equipmentTypeId: "rib", quantity: 500, perStudents: -1 },
    ], known)).toEqual([{ equipmentTypeId: "pico", quantity: 1, perStudents: 2 }, { equipmentTypeId: "rib", quantity: 100, perStudents: null }]);
    expect(describeKitRule({ equipmentTypeId: "pico", quantity: 1, perStudents: 2 }, "Pico")).toBe("1 × Pico per 2 students");
    expect(describeKitRule({ equipmentTypeId: "rib", quantity: 1, perStudents: null }, "RIB")).toBe("1 × RIB");
  });
});
