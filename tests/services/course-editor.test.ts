import { describe, it, expect } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { getCourseEditorData } from "@/lib/services/course-editor";

describe("getCourseEditorData", () => {
  it("builds the editable course box for a course: sessions, assigned staff, roles and instructors", async () => {
    const { db } = createTestDb();
    const { repos, ctx } = await seedFullOrg(db, { name: "Lake SC", slug: "lake", jurisdiction: "england" });
    const course = (await repos.tenant.course.list(ctx))[0]!;

    const data = await getCourseEditorData(repos, ctx, course.id);
    expect(data).not.toBeNull();
    expect(data!.course.id).toBe(course.id);
    expect(data!.sessions.length).toBeGreaterThan(0);
    expect(data!.assigned.length).toBeGreaterThan(0);
    expect(data!.roles.length).toBeGreaterThan(0);
    expect(data!.instructors.length).toBeGreaterThan(0);
  });

  it("returns null for another centre's course (tenant isolation)", async () => {
    const { db } = createTestDb();
    const a = await seedFullOrg(db, { name: "Lake SC", slug: "lake", jurisdiction: "england" });
    const b = await seedFullOrg(db, { name: "Bay SC", slug: "bay", jurisdiction: "england" });
    const bCourse = (await b.repos.tenant.course.list(b.ctx))[0]!;

    expect(await getCourseEditorData(a.repos, a.ctx, bCourse.id)).toBeNull();
  });
});
