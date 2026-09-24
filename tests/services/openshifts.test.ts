import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { claimOpenShift, confirmOpenShift, createOpenShift, listOpenShifts } from "@/lib/services/openshifts";
import { courseStaff as courseStaffTable } from "@/lib/db/schema";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";
import type { Database as DrizzleDatabase } from "@/lib/db/client";

describe("open shifts service", () => {
  let db: DrizzleDatabase;
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let sessionId: string;
  let roleId: string;
  let claimantId: string;

  beforeEach(async () => {
    ({ db } = createTestDb());
    const seeded = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    repos = seeded.repos;
    ctx = seeded.ctx;
    sessionId = (await repos.tenant.courseSession.list(ctx))[0]!.id;
    roleId = (await repos.tenant.roleType.list(ctx))[0]!.id;
    const claimant = await repos.tenant.instructor.insert(ctx, {
      name: "Cover Volunteer", email: "cover@alpha.test", employmentType: "volunteer", status: "active",
    });
    claimantId = claimant.id;
  });

  it("claims then confirms — filling the shift and assigning to the course", async () => {
    const shift = await createOpenShift(repos, ctx, sessionId, roleId, "safety cover");
    expect(shift.status).toBe("open");

    const offered = await claimOpenShift(repos, ctx, shift.id, claimantId);
    expect(offered?.status).toBe("offered");
    expect(offered?.claimedByInstructorId).toBe(claimantId);

    const filled = await confirmOpenShift(repos, ctx, shift.id);
    expect(filled?.status).toBe("filled");
    expect(filled?.filledByInstructorId).toBe(claimantId);

    // Confirmation created a course-staff assignment for the claimant.
    const staff = await repos.tenant.courseStaff.list(ctx, eq(courseStaffTable.instructorId, claimantId));
    expect(staff.length).toBe(1);
    expect(staff[0]!.status).toBe("confirmed");
  });

  it("cannot confirm a shift that was never claimed", async () => {
    const shift = await createOpenShift(repos, ctx, sessionId, roleId);
    const res = await confirmOpenShift(repos, ctx, shift.id);
    expect(res).toBeNull();
  });

  it("onlyClaimable hides filled shifts", async () => {
    const shift = await createOpenShift(repos, ctx, sessionId, roleId);
    await claimOpenShift(repos, ctx, shift.id, claimantId);
    await confirmOpenShift(repos, ctx, shift.id);
    const claimable = await listOpenShifts(repos, ctx, true);
    expect(claimable.find((s) => s.id === shift.id)).toBeUndefined();
  });
});
