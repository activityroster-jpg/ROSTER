import { describe, expect, it } from "vitest";
import { can, cleanFeatures, featuresOf, isOfficeRole, landingFor, parseFeatures, OFFICE_FEATURES } from "@/lib/auth/rbac";

describe("roles: owner, office admin with features, instructor, parent", () => {
  it("the owner can do everything in the office", () => {
    for (const p of ["office.view", "rota.view", "roster.edit", "staff.view", "staff.edit", "protected.view", "finance.view", "settings.edit", "billing.manage", "data.export"] as const) {
      expect(can("owner", p)).toBe(true);
    }
  });

  it("an office admin starts with nothing but the door, and each feature unlocks its pages", () => {
    const fresh = { role: "admin" as const, features: [] };
    expect(can(fresh, "office.view")).toBe(true);
    expect(can(fresh, "rota.view")).toBe(false);
    expect(can(fresh, "finance.view")).toBe(false);
    const rota = { role: "admin" as const, features: ["roster"] };
    expect(can(rota, "rota.view")).toBe(true);
    expect(can(rota, "roster.edit")).toBe(true);
    expect(can(rota, "staff.view")).toBe(false);
    const pay = { role: "admin" as const, features: ["payroll", "billing"] };
    expect(can(pay, "finance.view")).toBe(true);
    expect(can(pay, "billing.manage")).toBe(true);
    expect(can(pay, "settings.edit")).toBe(false);
    expect(featuresOf(pay)).toEqual(["payroll", "billing"]);
    expect(featuresOf({ role: "owner" })).toEqual([...OFFICE_FEATURES]);
  });

  it("instructors and the retired parent role never reach the office", () => {
    expect(can("instructor", "office.view")).toBe(false);
    expect(can({ role: "instructor", features: ["roster"] }, "rota.view")).toBe(false); // features mean nothing off the office roles
    expect(can("parent", "office.view")).toBe(false);
    // Legacy roles were migrated to instructor and grant nothing.
    expect(can("senior_instructor", "roster.edit")).toBe(false);
    expect(can("welfare_officer", "protected.view")).toBe(false);
  });

  it("lands each role in the right place", () => {
    expect(landingFor("owner")).toBe("/office");
    expect(landingFor("admin")).toBe("/office");
    expect(landingFor("instructor")).toBe("/portal");
    expect(landingFor("parent")).toBe("/portal");
    expect(isOfficeRole("owner")).toBe(true);
    expect(isOfficeRole("admin")).toBe(true);
    expect(isOfficeRole("instructor")).toBe(false);
  });

  it("drops unknown feature names from client input and bad JSON", () => {
    expect(cleanFeatures(["roster", "nonsense", "billing"])).toEqual(["roster", "billing"]);
    expect(cleanFeatures("roster")).toEqual([]);
    expect(parseFeatures('["payroll"]')).toEqual(["payroll"]);
    expect(parseFeatures("{")).toEqual([]);
    expect(parseFeatures(null)).toEqual([]);
  });
});
