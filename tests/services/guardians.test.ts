import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/security/token-crypto", () => ({ openToken: vi.fn(async (v: string | null) => v), sealToken: vi.fn(async (v: string) => v), isSealed: () => false }));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { childrenFor, inviteGuardian, revokeGuardian } from "@/lib/services/guardians";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

describe("guardian access", () => {
  let repos: Repositories; let ctx: SystemTenantContext; let childId: string;
  beforeEach(async () => {
    const { db } = createTestDb();
    const seeded = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    repos = seeded.repos; ctx = seeded.ctx;
    const kid = await repos.tenant.instructor.insert(ctx, { name: "Young One", email: "young@a.test", employmentType: "volunteer", status: "active", dateOfBirth: "2010-06-01", guardianName: "Pat Parent", guardianEmail: "pat@parents.test" });
    childId = kid.id;
  });

  it("refuses adults and missing guardian emails", async () => {
    const adult = await repos.tenant.instructor.insert(ctx, { name: "Adult", employmentType: "employed", status: "active", dateOfBirth: "1990-01-01" });
    expect((await inviteGuardian(repos, ctx, adult.id, "")).ok).toBe(false);
    await repos.tenant.instructor.update(ctx, childId, { guardianEmail: null });
    expect((await inviteGuardian(repos, ctx, childId, "")).ok).toBe(false);
  });

  it("creates a parent membership and a link with the consent record, then revokes it", async () => {
    const r = await inviteGuardian(repos, ctx, childId, "Signed permission form on file");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.email).toBe("pat@parents.test");
    const m = await repos.control.membershipFor(r.userId, ctx.organisationId);
    expect(m).toMatchObject({ role: "parent", status: "invited" });
    const links = await childrenFor(repos, ctx, r.userId);
    expect(links).toHaveLength(1);
    expect(links[0]!.consentNote).toBe("Signed permission form on file");
    expect(links[0]!.consentGivenAt).not.toBeNull();
    // Re-inviting reuses the link.
    const again = await inviteGuardian(repos, ctx, childId, "updated");
    expect(again.ok && again.linkId).toBe(r.linkId);
    expect(await revokeGuardian(repos, ctx, r.linkId)).toBe(true);
    expect(await childrenFor(repos, ctx, r.userId)).toHaveLength(0);
    expect(await repos.control.membershipFor(r.userId, ctx.organisationId)).toBeNull();
  });
});
