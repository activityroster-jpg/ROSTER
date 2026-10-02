import { describe, it, expect } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { importDrafts } from "@/lib/services/integrations";
import { createCourseTypeResolver, TYPE_NEW, TYPE_ONEOFF } from "@/lib/services/course-type-resolve";
import { moveCoursesToType } from "@/lib/services/course-types";
import type { DraftRow } from "@/lib/import/parse";

const draft = (name: string, date = "2099-07-01"): DraftRow =>
  ({ name, date, startTime: "09:00", endTime: "12:00", audience: "all", location: "", staff: "", issues: [] }) as DraftRow;

async function setup() {
  const { db } = createTestDb();
  const org = await seedFullOrg(db, { name: "Match", slug: "match", jurisdiction: "england" });
  const paddle = await org.repos.tenant.courseType.insert(org.ctx, {
    name: "Zeta Paddle Level 3", audience: "all", defaultCapacity: 6, studentsPerInstructor: 3, active: true, listed: true,
  });
  return { ...org, paddle };
}

describe("course type resolution on import", () => {
  it("files an unattended sync under the matching type instead of creating a duplicate", async () => {
    const { repos, ctx, paddle } = await setup();
    const before = (await repos.tenant.courseType.list(ctx)).length;
    await importDrafts(repos, ctx, [draft("RYA Zeta Paddle Lvl 3 – Summer")]);
    const course = (await repos.tenant.course.list(ctx)).find((c) => c.name === "RYA Zeta Paddle Lvl 3 – Summer")!;
    expect(course.courseTypeId).toBe(paddle.id);
    expect((await repos.tenant.courseType.list(ctx)).length).toBe(before);
  });

  it("keeps unmatched imports as one-off types, off the regular list", async () => {
    const { repos, ctx } = await setup();
    await importDrafts(repos, ctx, [draft("Corporate Team Building")]);
    const type = (await repos.tenant.courseType.list(ctx)).find((t) => t.name === "Corporate Team Building")!;
    expect(type.listed).toBe(false);
  });

  it("honours the admin's review choice: a picked type, add-to-list, or one-off", async () => {
    const { repos, ctx, paddle } = await setup();
    const k = (n: string) => `${n.toLowerCase()}|2099-07-01|AM`;
    await importDrafts(repos, ctx, [draft("Mystery Course"), draft("Stand Up Yoga"), draft("Zeta Paddle Level 3")], {
      typeChoices: { [k("Mystery Course")]: paddle.id, [k("Stand Up Yoga")]: TYPE_NEW, [k("Zeta Paddle Level 3")]: TYPE_ONEOFF },
    });
    const courses = await repos.tenant.course.list(ctx);
    const types = await repos.tenant.courseType.list(ctx);
    expect(courses.find((c) => c.name === "Mystery Course")!.courseTypeId).toBe(paddle.id);
    expect(types.find((t) => t.name === "Stand Up Yoga")!.listed).toBe(true);
    // One-off with an exact existing name reuses it rather than duplicating.
    expect(courses.find((c) => c.name === "Zeta Paddle Level 3")!.courseTypeId).toBe(paddle.id);
  });

  it("ignores another centre's type id in a review choice", async () => {
    const { db } = createTestDb();
    const a = await seedFullOrg(db, { name: "A", slug: "a-centre", jurisdiction: "england" });
    const b = await seedFullOrg(db, { name: "B", slug: "b-centre", jurisdiction: "england" });
    const foreign = (await b.repos.tenant.courseType.list(b.ctx))[0]!;
    const resolver = await createCourseTypeResolver(a.repos, a.ctx);
    const type = await resolver.resolve("Odd Thing", "all", foreign.id);
    expect(type.id).not.toBe(foreign.id);
    expect(type.organisationId).toBe(a.organisationId);
  });

  it("moves a one-off type's courses under the right type and removes the duplicate", async () => {
    const { repos, ctx, paddle } = await setup();
    await importDrafts(repos, ctx, [draft("Corporate Team Building")]);
    const oneOff = (await repos.tenant.courseType.list(ctx)).find((t) => t.name === "Corporate Team Building")!;
    const res = await moveCoursesToType(repos, ctx, oneOff.id, paddle.id);
    expect(res?.moved).toBe(1);
    expect(await repos.tenant.courseType.findById(ctx, oneOff.id)).toBeNull();
    expect((await repos.tenant.course.list(ctx)).find((c) => c.name === "Corporate Team Building")!.courseTypeId).toBe(paddle.id);
  });
});
