import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { DEFAULT_ONBOARDING, ensureOnboarding, getStaffProfile, toggleOnboarding } from "@/lib/services/hr";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";
import type { Database as DrizzleDatabase } from "@/lib/db/client";

describe("hr service", () => {
  let db: DrizzleDatabase;
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let seededInstructorId: string;

  beforeEach(async () => {
    ({ db } = createTestDb());
    const seeded = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    repos = seeded.repos;
    ctx = seeded.ctx;
    seededInstructorId = (await repos.tenant.instructor.list(ctx))[0]!.id;
  });

  it("seeds the default onboarding checklist once (idempotent)", async () => {
    const fresh = await repos.tenant.instructor.insert(ctx, {
      name: "New Starter", email: "new@alpha.test", employmentType: "employed", status: "active",
    });
    const first = await ensureOnboarding(repos, ctx, fresh.id);
    expect(first.length).toBe(DEFAULT_ONBOARDING.length);
    const second = await ensureOnboarding(repos, ctx, fresh.id);
    expect(second.length).toBe(DEFAULT_ONBOARDING.length); // no duplicates
  });

  it("toggles an onboarding step and records completion", async () => {
    const fresh = await repos.tenant.instructor.insert(ctx, {
      name: "Two", email: "two@alpha.test", employmentType: "employed", status: "active",
    });
    const items = await ensureOnboarding(repos, ctx, fresh.id);
    const toggled = await toggleOnboarding(repos, ctx, items[0]!.id, true);
    expect(toggled?.done).toBe(true);
    expect(toggled?.completedAt).not.toBeNull();
  });

  it("builds a profile with documents and fit status", async () => {
    const profile = await getStaffProfile(repos, ctx, seededInstructorId);
    expect(profile).not.toBeNull();
    // Seed gives the instructor 1 qualification + a compliance item per type.
    expect(profile!.documents.length).toBeGreaterThan(1);
    expect(profile!.fit.fit).toBe(true); // all mandatory checks current in the fixture
  });
});
