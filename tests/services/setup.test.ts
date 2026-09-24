import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { getSetupStatus } from "@/lib/services/setup";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";
import type { Database as DrizzleDatabase } from "@/lib/db/client";

describe("setup status", () => {
  let db: DrizzleDatabase;
  let repos: Repositories;
  let ctx: SystemTenantContext;

  beforeEach(async () => {
    ({ db } = createTestDb());
    const seeded = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    repos = seeded.repos;
    ctx = seeded.ctx;
  });

  it("reflects the seeded org's data as completed steps", async () => {
    // The fixture adds an instructor, pay rate, course and booking, so those
    // steps are done; nobody is invited to the app yet, so that step is not.
    const status = await getSetupStatus(repos, ctx);
    const byLabel = Object.fromEntries(status.steps.map((s) => [s.label, s.done]));
    expect(byLabel["Add your staff"]).toBe(true);
    expect(byLabel["Set pay rates"]).toBe(true);
    expect(byLabel["Create your first course"]).toBe(true);
    expect(byLabel["Take a booking"]).toBe(true);
    expect(byLabel["Invite an instructor to the app"]).toBe(false);
    expect(status.complete).toBe(false);
    expect(status.setupMode).toBe("basic");
  });
});
