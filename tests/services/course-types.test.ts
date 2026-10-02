import { describe, it, expect } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { deleteOrRetireCourseType } from "@/lib/services/course-types";

describe("deleteOrRetireCourseType", () => {
  it("retires (never deletes) a course type that existing courses use", async () => {
    const { db } = createTestDb();
    const { repos, ctx } = await seedFullOrg(db, { name: "Lake SC", slug: "lake", jurisdiction: "england" });
    const used = (await repos.tenant.course.list(ctx))[0]!.courseTypeId;

    const res = await deleteOrRetireCourseType(repos, ctx, used);
    expect(res.outcome).toBe("retired");
    const after = await repos.tenant.courseType.findById(ctx, used);
    expect(after).not.toBeNull();
    expect(Boolean(after!.active)).toBe(false);
  });

  it("deletes an unused course type", async () => {
    const { db } = createTestDb();
    const { repos, ctx } = await seedFullOrg(db, { name: "Lake SC", slug: "lake", jurisdiction: "england" });
    const fresh = await repos.tenant.courseType.insert(ctx, { name: "Taster Session", audience: "all", defaultCapacity: 6, studentsPerInstructor: 6, active: true });

    const res = await deleteOrRetireCourseType(repos, ctx, fresh.id);
    expect(res.outcome).toBe("deleted");
    expect(await repos.tenant.courseType.findById(ctx, fresh.id)).toBeNull();
  });

  it("can't touch another centre's course type", async () => {
    const { db } = createTestDb();
    const a = await seedFullOrg(db, { name: "Lake SC", slug: "lake", jurisdiction: "england" });
    const b = await seedFullOrg(db, { name: "Bay SC", slug: "bay", jurisdiction: "england" });
    const bType = (await b.repos.tenant.courseType.list(b.ctx))[0]!;

    expect((await deleteOrRetireCourseType(a.repos, a.ctx, bType.id)).outcome).toBe("not_found");
    expect(await b.repos.tenant.courseType.findById(b.ctx, bType.id)).not.toBeNull();
  });
});
