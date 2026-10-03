import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { assignStaff } from "@/lib/services/assignment";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

describe("assignStaff refuses ids that are not this centre's", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let courseId: string;
  let roleId: string;
  let instructorId: string;
  let otherInstructorId: string;

  beforeEach(async () => {
    const { db } = createTestDb();
    const a = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    const b = await seedFullOrg(db, { name: "Beta", slug: "beta", jurisdiction: "england" });
    repos = a.repos;
    ctx = a.ctx;
    courseId = (await repos.tenant.course.list(ctx))[0]!.id;
    roleId = (await repos.tenant.roleType.list(ctx))[0]!.id;
    instructorId = (await repos.tenant.instructor.list(ctx))[0]!.id;
    otherInstructorId = (await b.repos.tenant.instructor.list(b.ctx))[0]!.id;
  });

  it("another centre's instructor id is 'invalid', not assigned", async () => {
    const r = await assignStaff(repos, ctx, { courseId, instructorId: otherInstructorId, roleTypeId: roleId });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid");
    const rows = await repos.tenant.courseStaff.list(ctx);
    expect(rows.some((x) => x.instructorId === otherInstructorId)).toBe(false);
  });

  it("an unknown role id is 'invalid'", async () => {
    const r = await assignStaff(repos, ctx, { courseId, instructorId, roleTypeId: "nope" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid");
  });
});
