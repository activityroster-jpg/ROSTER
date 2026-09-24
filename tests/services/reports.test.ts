import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { getLabourReport } from "@/lib/services/reports";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";
import type { Database as DrizzleDatabase } from "@/lib/db/client";

describe("reports service", () => {
  let db: DrizzleDatabase;
  let repos: Repositories;
  let ctx: SystemTenantContext;

  beforeEach(async () => {
    ({ db } = createTestDb());
    const seeded = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    repos = seeded.repos;
    ctx = seeded.ctx;
  });

  it("computes wage cost and hours from the seeded records", async () => {
    // Fixture: one hours record, 180 min actual, rate 25 -> £75.00; session on 2026-01-05.
    const rep = await getLabourReport(repos, ctx);
    expect(rep.totalCost).toBeCloseTo(75, 2);
    expect(rep.totalActualMinutes).toBe(180);
    expect(rep.instructorsWithHours).toBe(1);
    expect(rep.byInstructor[0]?.minutes).toBe(180);
    expect(rep.byWeek[0]?.week).toBe("2026-01-05"); // Monday of that week
    expect(rep.boats.length).toBeGreaterThan(0); // fixture books one boat
    // Fixture seeds a confirmed £120 booking -> revenue and wage % of revenue.
    expect(rep.totalRevenue).toBeCloseTo(120, 2);
    expect(rep.wagePctOfRevenue).toBe(63); // round(75 / 120 * 100)
  });

  it("falls back to the instructor pay rate when a record has no rate", async () => {
    const instructorId = (await repos.tenant.instructor.list(ctx))[0]!.id;
    const session = (await repos.tenant.courseSession.list(ctx))[0]!;
    await repos.tenant.hoursRecord.insert(ctx, {
      instructorId,
      courseSessionId: session.id,
      scheduledMinutes: 60,
      actualMinutes: 60,
      rate: null, // no explicit rate -> should use payRate (25/h) = £25
      approved: false,
    });
    const rep = await getLabourReport(repos, ctx);
    // 75 (seeded) + 25 (this one via fallback rate) = 100
    expect(rep.totalCost).toBeCloseTo(100, 2);
  });
});
