import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { createCourseWithSessions } from "@/lib/services/courses";
import { courseSession as courseSessionTable } from "@/lib/db/schema";

describe("createCourseWithSessions", () => {
  it("creates a course with multiple sessions (recurring builder) and explicit times", async () => {
    const { db } = createTestDb();
    const { repos, ctx } = await seedFullOrg(db, { name: "Lake", slug: "lake", jurisdiction: "england" });
    const ct = (await repos.tenant.courseType.list(ctx))[0]!;

    const { courseId } = await createCourseWithSessions(repos, ctx, {
      courseTypeId: ct.id,
      name: "5-day Camp",
      sessions: [
        { date: "2026-07-13", slot: "AM", startTime: "09:30", endTime: "12:30" },
        { date: "2026-07-14", slot: "AM", startTime: "09:30", endTime: "12:30" },
        { date: "2026-07-15", slot: "AM", startTime: "09:30", endTime: "12:30" },
      ],
    });

    const sessions = await repos.tenant.courseSession.list(ctx, eq(courseSessionTable.courseId, courseId));
    expect(sessions).toHaveLength(3);
    // Explicit times are honoured (09:30 UTC start).
    const first = sessions.find((s) => s.date === "2026-07-13")!;
    const start = first.startAt instanceof Date ? first.startAt : new Date(Number(first.startAt));
    expect(start.getUTCHours()).toBe(9);
    expect(start.getUTCMinutes()).toBe(30);
  });

  it("records staff needed by role, locations and equipment — only this centre's", async () => {
    const { db } = createTestDb();
    const { repos, ctx } = await seedFullOrg(db, { name: "Cove", slug: "cove", jurisdiction: "england" });
    const other = await seedFullOrg(db, { name: "Elsewhere", slug: "elsewhere", jurisdiction: "england" });
    const t = repos.tenant;
    const ct = (await t.courseType.list(ctx))[0]!;
    const [r1, r2] = await t.roleType.list(ctx);
    const loc = (await t.location.list(ctx))[0]!;
    const eq1 = (await t.equipment.list(ctx))[0]!;
    const foreignLoc = (await other.repos.tenant.location.list(other.ctx))[0]!;
    const foreignRole = (await other.repos.tenant.roleType.list(other.ctx))[0]!;

    const { courseId } = await createCourseWithSessions(repos, ctx, {
      courseTypeId: ct.id,
      sessions: [{ date: "2026-07-13", slot: "AM", startTime: "10:15", endTime: "13:45" }],
      roleRequirements: [
        { roleTypeId: r1!.id, count: 2 },
        { roleTypeId: r2!.id, count: 1 },
        { roleTypeId: r1!.id, count: 1 }, // merged with the first
        { roleTypeId: foreignRole.id, count: 5 }, // another centre's — ignored
      ],
      locationIds: [loc.id, foreignLoc.id],
      equipmentIds: [eq1.id, eq1.id],
    });

    const reqs = (await t.courseRoleRequirement.list(ctx)).filter((r) => r.courseId === courseId);
    expect(reqs.map((r) => [r.roleTypeId, r.count]).sort()).toEqual([[r1!.id, 3], [r2!.id, 1]].sort());
    expect((await t.course.findById(ctx, courseId))!.staffRequired).toBe(4);
    expect((await t.courseLocation.list(ctx)).filter((l) => l.courseId === courseId).map((l) => l.locationId)).toEqual([loc.id]);
    expect((await t.courseEquipment.list(ctx)).filter((e) => e.courseId === courseId)).toHaveLength(1);
  });

  it("deletes a course and cascades its sessions", async () => {
    const { db } = createTestDb();
    const { repos, ctx } = await seedFullOrg(db, { name: "Bay", slug: "bay", jurisdiction: "england" });
    const ct = (await repos.tenant.courseType.list(ctx))[0]!;
    const { courseId } = await createCourseWithSessions(repos, ctx, {
      courseTypeId: ct.id, name: "One-off", sessions: [{ date: "2026-08-01", slot: "PM" }],
    });
    expect(await repos.tenant.courseSession.list(ctx, eq(courseSessionTable.courseId, courseId))).toHaveLength(1);

    await repos.tenant.course.delete(ctx, courseId);
    expect(await repos.tenant.course.findById(ctx, courseId)).toBeNull();
    expect(await repos.tenant.courseSession.list(ctx, eq(courseSessionTable.courseId, courseId))).toHaveLength(0);
  });
});
