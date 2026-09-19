import { beforeEach, describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import { createTestDb } from "@/tests/helpers/test-db";
import { createRepositories, TENANT_TABLES } from "@/lib/db/repositories";
import { provisionCentre } from "@/lib/billing/provision";
import type { CloudflareEnv } from "@/lib/cf/bindings";
import type { Database as DrizzleDatabase } from "@/lib/db/client";
import type BetterSqlite from "better-sqlite3";

const fakeEnv = { APP_APEX_DOMAIN: "activityroster.com", APP_ENV: "test" } as unknown as CloudflareEnv;

const params = {
  slug: "alpha",
  centreName: "Alpha SC",
  ownerEmail: "owner@alpha.test",
  jurisdiction: "scotland",
  plan: "rostering",
  stripeCustomerId: "cus_123",
  stripeSubscriptionId: "sub_123",
};

describe("provisionCentre", () => {
  let db: DrizzleDatabase;
  let raw: BetterSqlite.Database;

  beforeEach(() => {
    ({ db, raw } = createTestDb());
  });

  it("creates org, owner, admin membership and seeds RYA defaults", async () => {
    const repos = createRepositories(db);
    const result = await provisionCentre(repos, fakeEnv, params);
    expect(result.created).toBe(true);

    const org = await repos.control.organisationBySlug("alpha");
    expect(org?.name).toBe("Alpha SC");
    expect(org?.status).toBe("active");
    expect(org?.jurisdiction).toBe("scotland");

    const owner = await repos.control.userByEmail("owner@alpha.test");
    expect(owner).not.toBeNull();
    const membership = await repos.control.activeMembership(owner!.id, org!.id);
    expect(membership?.role).toBe("admin");

    // Scotland → PVG vetting seeded (jurisdiction-driven config).
    const ctx = { organisationId: org!.id, slug: "alpha", system: true as const, reason: "test" };
    const compliance = await repos.tenant.complianceType.list(ctx);
    expect(compliance.some((c) => c.code === "PVG")).toBe(true);
  });

  it("is idempotent: a second call does not duplicate the org or its config", async () => {
    const repos = createRepositories(db);
    const first = await provisionCentre(repos, fakeEnv, params);
    const second = await provisionCentre(repos, fakeEnv, params);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.organisationId).toBe(first.organisationId);

    const orgCount = (raw.prepare(`SELECT COUNT(*) AS n FROM organisation WHERE slug = 'alpha'`).get() as { n: number }).n;
    expect(orgCount).toBe(1);

    // Config seeded exactly once.
    const ctx = { organisationId: first.organisationId, slug: "alpha", system: true as const, reason: "test" };
    const slots = await repos.tenant.sessionSlot.list(ctx);
    expect(slots.length).toBe(3);
  });

  it("seeds every tenant config table without leaking across orgs", async () => {
    const repos = createRepositories(db);
    await provisionCentre(repos, fakeEnv, params);
    await provisionCentre(repos, fakeEnv, {
      ...params,
      slug: "bravo",
      ownerEmail: "owner@bravo.test",
      jurisdiction: "england",
      stripeCustomerId: "cus_456",
      stripeSubscriptionId: "sub_456",
    });

    for (const table of TENANT_TABLES) {
      const name = getTableName(table);
      const rows = raw
        .prepare(`SELECT organisation_id FROM "${name}"`)
        .all() as { organisation_id: string }[];
      // No row should be missing its org discriminator.
      expect(rows.every((r) => r.organisation_id && r.organisation_id.length > 0)).toBe(true);
    }
  });
});
