import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { createRepositories } from "@/lib/db/repositories";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import type { Database as Db } from "@/lib/db/client";

/**
 * The app's join step offers a centre by name when its Instructors list already
 * carries the person's verified email: the admin typing the address is the
 * invitation. Pending or claimed records, and suspended centres, are not offered.
 */
describe("centres offered by name at the join step", () => {
  let db: Db;
  let a: Awaited<ReturnType<typeof seedFullOrg>>;
  let b: Awaited<ReturnType<typeof seedFullOrg>>;

  beforeEach(async () => {
    ({ db } = createTestDb());
    a = await seedFullOrg(db, { name: "Alpha Sailing", slug: "alpha", jurisdiction: "england" });
    b = await seedFullOrg(db, { name: "Bravo Watersports", slug: "bravo", jurisdiction: "england" });
  });

  it("lists every active centre whose instructor list has the email, case-insensitively, once each", async () => {
    await a.repos.tenant.instructor.insert(a.ctx, { name: "Sam Reed", email: "Sam.Reed@Example.com", employmentType: "freelance", status: "active" });
    await a.repos.tenant.instructor.insert(a.ctx, { name: "Sam Reed (dup)", email: "sam.reed@example.com", employmentType: "freelance", status: "active" });
    await b.repos.tenant.instructor.insert(b.ctx, { name: "Sam Reed", email: "sam.reed@example.com", employmentType: "freelance", status: "active" });
    const platform = new PlatformRepository(db);
    const offered = await platform.centresWithStaffEmail("sam.reed@example.com", "user-sam");
    expect(offered.map((c) => c.name)).toEqual(["Alpha Sailing", "Bravo Watersports"]);
  });

  it("skips pending join requests, records claimed by another login, and centres that aren't active", async () => {
    await a.repos.tenant.instructor.insert(a.ctx, { name: "Pending", email: "p@example.com", employmentType: "freelance", status: "pending" });
    await a.repos.tenant.instructor.insert(a.ctx, { name: "Claimed", email: "c@example.com", employmentType: "freelance", status: "active", userId: "someone-else" });
    await a.repos.tenant.instructor.insert(a.ctx, { name: "Mine", email: "m@example.com", employmentType: "freelance", status: "active", userId: "user-m" });
    await b.repos.tenant.instructor.insert(b.ctx, { name: "Sam", email: "s@example.com", employmentType: "freelance", status: "active" });
    await createRepositories(db).control.updateOrganisation(b.organisationId, { status: "suspended" });
    const platform = new PlatformRepository(db);
    expect(await platform.centresWithStaffEmail("p@example.com", "user-p")).toEqual([]);
    expect(await platform.centresWithStaffEmail("c@example.com", "user-c")).toEqual([]);
    expect((await platform.centresWithStaffEmail("m@example.com", "user-m")).map((c) => c.slug)).toEqual(["alpha"]);
    expect(await platform.centresWithStaffEmail("s@example.com", "user-s")).toEqual([]);
    expect(await platform.centresWithStaffEmail("", "user-x")).toEqual([]);
  });
});
