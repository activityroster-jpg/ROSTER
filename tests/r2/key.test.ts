import { describe, expect, it } from "vitest";
import { tenantKey } from "@/lib/r2";
import type { TenantContext } from "@/lib/tenant/context";

const ctx: TenantContext = { organisationId: "org-abc", slug: "alpha", userId: "u", role: "admin" };

describe("tenantKey (R2 org scoping)", () => {
  it("prefixes every key with the org namespace", () => {
    expect(tenantKey(ctx, "instructor_1/compliance/x/file.pdf")).toBe(
      "org_org-abc/instructor_1/compliance/x/file.pdf",
    );
  });

  it("strips leading slashes so a key cannot escape the namespace", () => {
    expect(tenantKey(ctx, "/etc/passwd")).toBe("org_org-abc/etc/passwd");
  });

  it("rejects path traversal", () => {
    expect(() => tenantKey(ctx, "../org_other/secret")).toThrow();
  });
});
