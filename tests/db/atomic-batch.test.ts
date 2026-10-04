import { describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { runAtomic } from "@/lib/db/batch";
import { createCourseWithSessions } from "@/lib/services/courses";
import type { AnyTenantContext } from "@/lib/tenant/context";

describe("atomic writes for course creation", () => {
  it("uses the driver's batch when there is one, and creates the whole course with its parts", async () => {
    const calls: unknown[][] = [];
    const fakeD1 = { batch: async (q: unknown[]) => { calls.push(q); return []; } };
    await runAtomic(fakeD1 as never, [Promise.resolve(1), Promise.resolve(2)]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveLength(2);

    const { db } = createTestDb();
    const { repos, ctx } = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    const courseTypeId = (await repos.tenant.courseType.list(ctx))[0]!.id;
    const location = (await repos.tenant.location.list(ctx))[0]!;
    const unit = (await repos.tenant.equipment.list(ctx))[0]!;
    const role = (await repos.tenant.roleType.list(ctx))[0]!;
    const { courseId } = await createCourseWithSessions(repos, ctx, {
      courseTypeId, name: "Batch weekend",
      sessions: [{ date: "2027-08-07", slot: "AM" }, { date: "2027-08-08", slot: "PM", startTime: "13:30", endTime: "16:00" }],
      locationIds: [location.id, "not-ours"], equipmentIds: [unit.id], roleRequirements: [{ roleTypeId: role.id, count: 2 }, { roleTypeId: role.id, count: 1 }],
    });
    const course = (await repos.tenant.course.findById(ctx, courseId))!;
    expect([course.name, course.staffRequired]).toEqual(["Batch weekend", 3]);
    expect((await repos.tenant.courseSession.list(ctx)).filter((s) => s.courseId === courseId)).toHaveLength(2);
    expect((await repos.tenant.courseLocation.list(ctx)).filter((s) => s.courseId === courseId)).toHaveLength(1);
    expect((await repos.tenant.courseEquipment.list(ctx)).filter((s) => s.courseId === courseId)).toHaveLength(1);
    expect((await repos.tenant.courseRoleRequirement.list(ctx)).filter((s) => s.courseId === courseId).map((r) => r.count)).toEqual([3]);
  });

  it("a read-only context can't even build a statement", async () => {
    const { db } = createTestDb();
    const { repos, ctx } = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    const ghost = { organisationId: ctx.organisationId, slug: ctx.slug, ghost: true, userId: "u", role: "owner" } as unknown as AnyTenantContext;
    expect(() => repos.tenant.course.insertStatement(ghost, { courseTypeId: "x", name: "n", capacity: 1, ratio: 1, status: "draft" })).toThrow();
  });
});
