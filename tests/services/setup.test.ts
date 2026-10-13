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

  it("reflects the seeded org's data as completed steps, in route order", async () => {
    // The fixture adds an instructor, pay rate, course and a staff assignment, so
    // those steps are done; nobody is invited and no day is confirmed yet.
    const status = await getSetupStatus(repos, ctx);
    expect(status.steps.map((s) => s.key)).toEqual(["signup", "team", "invite", "courses", "roster", "confirm", "pay"]);
    const byKey = Object.fromEntries(status.steps.map((s) => [s.key, s.done]));
    expect(byKey.signup).toBe(true);
    expect(byKey.courses).toBe(true);
    expect(byKey.roster).toBe(true);
    expect(byKey.pay).toBe(true);
    expect(byKey.invite).toBe(false);
    expect(byKey.confirm).toBe(false);
    expect(status.hasStaff).toBe(true);
    expect(status.firstDayConfirmed).toBe(false);
    expect(status.complete).toBe(false);
    expect(status.setupMode).toBe("basic");
  });

  it("adds the plan step when the organisation is passed, and keeps it out of the essentials", async () => {
    const status = await getSetupStatus(repos, ctx, { stripeSubscriptionId: null });
    const plan = status.steps.find((s) => s.key === "plan");
    expect(plan).toMatchObject({ stage: "later", done: false });
  });
});
