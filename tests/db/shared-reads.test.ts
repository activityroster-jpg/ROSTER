import { describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { createRepositories } from "@/lib/db/repositories";
import { courseType } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Small settings tables are read once per request and shared (lib/db/repositories/base.ts):
 * fewer database trips, but a change made in the same request is always seen, and one
 * centre's rows never stand in for another's.
 */
describe("shared reads within a request", () => {
  async function setup() {
    const { db, raw } = createTestDb();
    const a = await seedFullOrg(db, { name: "Alpha SC", slug: "alpha", jurisdiction: "england" });
    const b = await seedFullOrg(db, { name: "Bravo SC", slug: "bravo", jurisdiction: "scotland" });
    let count = 0;
    const prep = raw.prepare.bind(raw);
    raw.prepare = ((q: string) => { count++; return prep(q); }) as typeof raw.prepare;
    return { db, a, b, statements: () => count };
  }

  it("reads a whole small table once, even when several parts ask at the same time", async () => {
    const { db, a, statements } = await setup();
    const repos = createRepositories(db);
    const before = statements();
    const [x, y, z] = await Promise.all([repos.tenant.courseType.list(a.ctx), repos.tenant.courseType.list(a.ctx), repos.tenant.courseType.list(a.ctx)]);
    expect(statements() - before).toBe(1);
    expect(x.length).toBeGreaterThan(0);
    expect(y).toEqual(x);
    expect(z).toEqual(x);
    // Filtered reads still go to the database.
    await repos.tenant.courseType.list(a.ctx, eq(courseType.active, true));
    expect(statements() - before).toBe(2);
  });

  it("hands each caller its own list, so sorting one can't change another", async () => {
    const { db, a } = await setup();
    const repos = createRepositories(db);
    const first = await repos.tenant.courseType.list(a.ctx);
    first.length = 0;
    expect((await repos.tenant.courseType.list(a.ctx)).length).toBeGreaterThan(0);
  });

  it("sees a change made earlier in the same request", async () => {
    const { db, a } = await setup();
    const repos = createRepositories(db);
    const before = await repos.tenant.courseType.list(a.ctx);
    const added = await repos.tenant.courseType.insert(a.ctx, { name: "Shared read test" });
    const after = await repos.tenant.courseType.list(a.ctx);
    expect(after.length).toBe(before.length + 1);
    expect(after.some((c) => c.id === added.id)).toBe(true);
    await repos.tenant.courseType.update(a.ctx, added.id, { name: "Renamed" });
    expect((await repos.tenant.courseType.list(a.ctx)).find((c) => c.id === added.id)?.name).toBe("Renamed");
  });

  it("keeps each centre's rows to that centre", async () => {
    const { db, a, b } = await setup();
    const repos = createRepositories(db);
    const mine = await repos.tenant.courseType.list(a.ctx);
    const theirs = await repos.tenant.courseType.list(b.ctx);
    expect(mine.every((c) => c.organisationId === a.organisationId)).toBe(true);
    expect(theirs.every((c) => c.organisationId === b.organisationId)).toBe(true);
    expect(theirs.length).toBeGreaterThan(0);
  });

  it("starts fresh for each request", async () => {
    const { db, a } = await setup();
    const first = createRepositories(db);
    const n = (await first.tenant.courseType.list(a.ctx)).length;
    await createRepositories(db).tenant.courseType.insert(a.ctx, { name: "Another request" });
    expect((await createRepositories(db).tenant.courseType.list(a.ctx)).length).toBe(n + 1);
  });
});
