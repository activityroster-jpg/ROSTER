import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { removeTestCentre } from "@/lib/services/test-centre";
import { eraseOrganisationData } from "@/lib/services/export";
import { createRepositories, TENANT_TABLES } from "@/lib/db/repositories";
import { getTableName } from "drizzle-orm";
import type Database from "better-sqlite3";
import type { Database as Db } from "@/lib/db/client";
import type { AnyTenantContext } from "@/lib/tenant/context";

/**
 * Removing a test centre (Dev Center): everything in it goes straight away, so
 * do the logins that belonged only to it. Logins in another centre, and the
 * platform admin's, stay. Live Stripe subscriptions are refused.
 */
describe("remove test centre", () => {
  let db: Db;
  let raw: Database.Database;
  let a: Awaited<ReturnType<typeof seedFullOrg>>;
  let b: Awaited<ReturnType<typeof seedFullOrg>>;
  const filesDeleted: string[] = [];
  const deleteFiles = async (ctx: AnyTenantContext) => { filesDeleted.push(ctx.organisationId); return 3; };
  const isProtectedEmail = async (e: string) => e === "conor@platform.test";

  beforeEach(async () => {
    filesDeleted.length = 0;
    ({ db, raw } = createTestDb());
    a = await seedFullOrg(db, { name: "Test Centre A", slug: "testa", jurisdiction: "england" });
    b = await seedFullOrg(db, { name: "Real Centre B", slug: "realb", jurisdiction: "england" });
  });

  const run = (over: Partial<Parameters<typeof removeTestCentre>[1]> = {}) =>
    removeTestCentre(createRepositories(db), { organisationId: a.organisationId, confirmSlug: "testa", confirmedTest: true, actorUserId: null, isProtectedEmail, deleteFiles, ...over });

  it("needs the box ticked and the address typed exactly", async () => {
    expect(await run({ confirmedTest: false })).toMatchObject({ ok: false });
    expect(await run({ confirmSlug: "realb" })).toMatchObject({ ok: false });
    expect(await a.repos.control.organisationById(a.organisationId)).not.toBeNull();
  });

  it("refuses a centre with a live Stripe subscription", async () => {
    await a.repos.control.updateOrganisation(a.organisationId, { stripeSubscriptionId: "sub_test", subscriptionStatus: "active" });
    const r = await run();
    expect(r).toMatchObject({ ok: false });
    expect(r.ok ? "" : r.error).toMatch(/Stripe/);
    expect(await a.repos.control.organisationById(a.organisationId)).not.toBeNull();
    await a.repos.control.updateOrganisation(a.organisationId, { subscriptionStatus: "canceled" });
    expect(await run()).toMatchObject({ ok: true });
  });

  it("removes the centre, its rows, files and only-here logins, and frees the emails", async () => {
    const owner = await a.repos.control.userByEmail("owner@testa.test");
    expect(owner).not.toBeNull();
    const r = await run();
    expect(r).toMatchObject({ ok: true, slug: "testa", loginsRemoved: 1, files: 3 });
    expect(filesDeleted).toEqual([a.organisationId]);
    expect(await a.repos.control.organisationById(a.organisationId)).toBeNull();
    expect(await a.repos.control.userByEmail("owner@testa.test")).toBeNull();
    for (const table of TENANT_TABLES) {
      const n = (raw.prepare(`SELECT COUNT(*) AS n FROM "${getTableName(table)}" WHERE organisation_id = ?`).get(a.organisationId) as { n: number }).n;
      expect(n, getTableName(table)).toBe(0);
    }
  });

  it("never touches another centre, a login that is also elsewhere, or the platform admin", async () => {
    const shared = await a.repos.control.createUser({ name: "Shared", email: "shared@both.test" });
    await a.repos.control.createMembership({ userId: shared.id, organisationId: a.organisationId, role: "admin" });
    await a.repos.control.createMembership({ userId: shared.id, organisationId: b.organisationId, role: "admin" });
    const admin = await a.repos.control.createUser({ name: "Conor", email: "conor@platform.test" });
    await a.repos.control.createMembership({ userId: admin.id, organisationId: a.organisationId, role: "admin" });

    const r = await run({ actorUserId: admin.id });
    expect(r).toMatchObject({ ok: true, loginsRemoved: 1, loginsKept: 2 });
    expect(await a.repos.control.userByEmail("shared@both.test")).not.toBeNull();
    expect(await a.repos.control.userByEmail("conor@platform.test")).not.toBeNull();
    expect(await b.repos.control.organisationById(b.organisationId)).not.toBeNull();
    expect(await b.repos.control.userByEmail("owner@realb.test")).not.toBeNull();
    expect((await b.repos.tenant.instructor.list(b.ctx)).length).toBeGreaterThan(0);
    // A record that outlives the centre, on the platform side.
    const ev = raw.prepare("SELECT kind, organisation_id AS org, meta FROM security_event WHERE kind = 'test_centre_removed'").get() as { kind: string; org: string; meta: string };
    expect(ev.org).toBe(a.organisationId);
    expect(JSON.parse(ev.meta)).toMatchObject({ slug: "testa", loginsRemoved: 1, loginsKept: 2 });
  });

  it("customer erasure also removes the centre's uploaded files now", async () => {
    const res = await eraseOrganisationData(createRepositories(db), a.ctx, { deleteFiles });
    expect(res).toMatchObject({ erased: true, files: 3 });
    expect(filesDeleted).toEqual([a.organisationId]);
  });
});
