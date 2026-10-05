import { describe, expect, it } from "vitest";
import { describeAccess, featureForPermission, ownerName } from "@/lib/auth/rbac";

const members = [
  { name: "Conor", role: "owner", features: [] as string[] },
  { name: "Ellie", role: "admin", features: ["payroll", "roster"] },
  { name: "Sam", role: "admin", features: ["roster"], status: "invited" },
];

describe("who can see this", () => {
  it("names the superadmin and the office admins with the feature ticked", () => {
    expect(describeAccess(members, "payroll").text).toBe("Visible to Conor (superadmin) and Ellie (Payroll).");
    expect(describeAccess(members, "roster").text).toBe("Visible to Conor (superadmin), Ellie (Roster & courses) and Sam (Roster & courses, invited).");
    expect(describeAccess([members[0]!], "exports").text).toBe("Visible to Conor (superadmin).");
  });

  it("maps a refused permission to the tick that unlocks it, and finds who to ask", () => {
    expect(featureForPermission("finance.view")).toBe("payroll");
    expect(featureForPermission("protected.view")).toBe("protected");
    expect(featureForPermission("office.view")).toBeNull();
    expect(featureForPermission("1")).toBeNull();
    expect(ownerName(members)).toBe("Conor");
  });
});
