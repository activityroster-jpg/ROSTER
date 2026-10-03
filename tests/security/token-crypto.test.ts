import { describe, expect, it } from "vitest";
import { isSealed, openToken, sealToken } from "@/lib/security/token-crypto";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { exportOrganisationData } from "@/lib/services/export";
import type { TenantContext } from "@/lib/tenant/context";

const SECRET = "test-secret-that-is-long-enough-123";

describe("integration token encryption", () => {
  it("round-trips and never stores the plaintext", async () => {
    const sealed = await sealToken("bw_live_abc123", SECRET);
    expect(isSealed(sealed)).toBe(true);
    expect(sealed).not.toContain("abc123");
    expect(await openToken(sealed, SECRET)).toBe("bw_live_abc123");
    // Fresh IV every time.
    expect(await sealToken("bw_live_abc123", SECRET)).not.toBe(sealed);
  });

  it("legacy plaintext passes through; the wrong key or tampering yields null", async () => {
    expect(await openToken("plain-old-token", SECRET)).toBe("plain-old-token");
    expect(await openToken(null, SECRET)).toBeNull();
    const sealed = await sealToken("secret-value", SECRET);
    expect(await openToken(sealed, "another-secret-that-is-long-enough")).toBeNull();
    expect(await openToken(sealed.slice(0, -2) + "zz", SECRET)).toBeNull();
  });

  it("the data export redacts integration tokens", async () => {
    const { db } = createTestDb();
    const { repos, ctx } = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    await repos.tenant.integration.insert(ctx, { provider: "bookwhen", kind: "api", token: await sealToken("bw_live_abc123", SECRET), status: "connected" });
    const out = await exportOrganisationData(repos, ctx as unknown as TenantContext);
    const rows = out.integration as { token: string | null }[];
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.token === null || r.token === "[redacted]").toBe(true);
    expect(JSON.stringify(out)).not.toContain("abc123");
  });
});
