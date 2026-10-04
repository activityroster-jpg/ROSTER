import { describe, expect, it } from "vitest";
import { can, landingFor, isOfficeRole, GRANTABLE_ROLES } from "@/lib/auth/rbac";

describe("permission matrix", () => {
  it("admin can do everything but is not a parent", () => {
    expect(can("admin", "settings.edit")).toBe(true);
    expect(can("admin", "protected.view")).toBe(true);
    expect(can("admin", "parent.view")).toBe(false);
  });
  it("senior instructor rosters but sees no money, settings or protected contacts", () => {
    expect(can("senior_instructor", "roster.edit")).toBe(true);
    expect(can("senior_instructor", "rota.view")).toBe(true);
    expect(can("senior_instructor", "staff.view")).toBe(true);
    for (const p of ["finance.view", "settings.edit", "protected.view", "staff.edit"] as const) expect(can("senior_instructor", p)).toBe(false);
  });
  it("welfare officer sees protected contacts but cannot roster", () => {
    expect(can("welfare_officer", "protected.view")).toBe(true);
    expect(can("welfare_officer", "roster.edit")).toBe(false);
    expect(can("welfare_officer", "finance.view")).toBe(false);
  });
  it("instructors and parents stay out of the office", () => {
    expect(can("instructor", "office.view")).toBe(false);
    expect(can("parent", "office.view")).toBe(false);
    expect(can("parent", "parent.view")).toBe(true);
    expect(landingFor("parent")).toBe("/parent");
    expect(landingFor("instructor")).toBe("/portal");
    expect(landingFor("welfare_officer")).toBe("/office");
    expect(isOfficeRole("senior_instructor")).toBe(true);
    expect(GRANTABLE_ROLES).not.toContain("admin");
  });
});
