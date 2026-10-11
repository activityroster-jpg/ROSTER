import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { getTeachingMatrix } from "@/lib/services/teaching";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

/** A PADI dive centre is the same platform with a different starting set: seed it and check the core reads it. */
describe("PADI dive centre pack", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;
  beforeEach(async () => {
    const { db } = createTestDb();
    ({ repos, ctx } = await seedFullOrg(db, { name: "Blue Reef Divers", slug: "bluereef", jurisdiction: "england", activityType: "padi_centre" }));
  });

  it("seeds PADI courses, ratings, checks and dive kit instead of the RYA lists", async () => {
    const [courses, grades, checks, kit, roles] = await Promise.all([
      repos.tenant.courseType.list(ctx), repos.tenant.qualificationType.list(ctx), repos.tenant.complianceType.list(ctx), repos.tenant.equipmentType.list(ctx), repos.tenant.roleType.list(ctx),
    ]);
    expect(courses.map((c) => c.name)).toContain("Open Water Diver");
    expect(courses.map((c) => c.name)).not.toContain("Youth Stage 1");
    expect(grades.map((g) => g.name)).toContain("Open Water Scuba Instructor");
    expect(checks.map((c) => c.code)).toEqual(expect.arrayContaining(["PADI_RENEWAL", "DIVE_MEDICAL", "FIRST_AID", "DBS"]));
    expect(kit.map((k) => k.name)).toContain("Cylinder");
    expect(roles.find((r) => r.isSafetyCover)?.name).toBe("Boat Skipper");
  });

  it("an instructor holding a PADI rating is matched to PADI courses", async () => {
    const [grades, instructors] = await Promise.all([repos.tenant.qualificationType.list(ctx), repos.tenant.instructor.list(ctx)]);
    const owsi = grades.find((g) => g.code === "OWSI")!;
    const person = await repos.tenant.instructor.insert(ctx, { name: "Dee Diver", email: "dee@bluereef.test", status: "active", employmentType: instructors[0]?.employmentType ?? "freelance" });
    await repos.tenant.qualification.insert(ctx, { instructorId: person.id, qualificationTypeId: owsi.id, verified: true });
    const matrix = await getTeachingMatrix(repos, ctx);
    const names = (matrix.get(person.id) ?? []).map((c) => c.name);
    expect(names).toContain("Open Water Diver");
    expect(names).toContain("Rescue Diver");
  });
});
