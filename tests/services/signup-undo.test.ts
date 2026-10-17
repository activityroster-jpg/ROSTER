import { beforeEach, describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import type Database from "better-sqlite3";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { undoHalfMadeCentre } from "@/lib/billing/provision";
import { createRepositories, TENANT_TABLES } from "@/lib/db/repositories";
import type { Database as Db } from "@/lib/db/client";

/**
 * A sign-up that fails part-way (the centre row and owner membership exist, the
 * seed or a later step threw) must leave nothing behind: the centre, whatever
 * was seeded into it and the brand-new login all go, so the same email and web
 * address can simply try again. It must never reach an established centre.
 */
describe("sign-up undo", () => {
  let db: Db;
  let raw: Database.Database;
  let a: Awaited<ReturnType<typeof seedFullOrg>>;
  const deleteFiles = async () => 0;

  beforeEach(async () => {
    ({ db, raw } = createTestDb());
    a = await seedFullOrg(db, { name: "Half Made", slug: "halfmade", jurisdiction: "england" });
  });

  it("removes a centre made moments ago, its seeded rows and the owner's login", async () => {
    const repos = createRepositories(db);
    const owner = (await repos.control.userByEmail("owner@halfmade.test"))!;
    await repos.control.reserveSlug("halfmade", 60_000);

    const r = await undoHalfMadeCentre(repos, { slug: "halfmade", ownerUserId: owner.id, deleteFiles });
    expect(r).toEqual({ centreRemoved: true, loginRemoved: true });
    expect(await repos.control.organisationBySlug("halfmade")).toBeNull();
    expect(await repos.control.userByEmail("owner@halfmade.test")).toBeNull();
    expect(await repos.control.slugTaken("halfmade")).toBe(false);
    for (const table of TENANT_TABLES) {
      const n = raw.prepare(`select count(*) as n from "${getTableName(table)}" where organisation_id = ?`).get(a.organisationId) as { n: number };
      expect(n.n, getTableName(table)).toBe(0);
    }
  });

  it("leaves a centre alone once it is older than the sign-up window", async () => {
    const repos = createRepositories(db);
    const owner = (await repos.control.userByEmail("owner@halfmade.test"))!;
    raw.prepare(`update organisation set created_at = ? where id = ?`).run(Date.now() - 2 * 60 * 60 * 1000, a.organisationId);

    const r = await undoHalfMadeCentre(repos, { slug: "halfmade", ownerUserId: owner.id, deleteFiles });
    expect(r).toEqual({ centreRemoved: false, loginRemoved: false });
    expect(await repos.control.organisationBySlug("halfmade")).not.toBeNull();
    expect(await repos.control.userByEmail("owner@halfmade.test")).not.toBeNull();
  });

  it("leaves a centre alone when anyone else is a member", async () => {
    const repos = createRepositories(db);
    const owner = (await repos.control.userByEmail("owner@halfmade.test"))!;
    const other = await repos.control.createUser({ name: "Office", email: "office@halfmade.test" });
    await repos.control.createMembership({ userId: other.id, organisationId: a.organisationId, role: "admin" });

    const r = await undoHalfMadeCentre(repos, { slug: "halfmade", ownerUserId: owner.id, deleteFiles });
    expect(r).toEqual({ centreRemoved: false, loginRemoved: false });
    expect(await repos.control.organisationBySlug("halfmade")).not.toBeNull();
  });

  it("still removes a login that never got a centre at all", async () => {
    const repos = createRepositories(db);
    const lone = await repos.control.createUser({ name: "Lone", email: "lone@nowhere.test" });
    const r = await undoHalfMadeCentre(repos, { slug: "never-made", ownerUserId: lone.id, deleteFiles });
    expect(r).toEqual({ centreRemoved: false, loginRemoved: true });
    expect(await repos.control.userByEmail("lone@nowhere.test")).toBeNull();
  });
});
