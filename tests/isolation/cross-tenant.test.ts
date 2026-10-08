import { getTableName } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { TENANT_TABLES, TenantRepository } from "@/lib/db/repositories";
import type { Database as DrizzleDatabase } from "@/lib/db/client";
import type { TenantContext } from "@/lib/tenant/context";
import { availability, instructor } from "@/lib/db/schema";
import { isNotNull, sql } from "drizzle-orm";

/**
 * THE cross-tenant isolation test (Phase 0, before features). It seeds two
 * organisations that hold the same shape of data, then proves that a repository
 * call carrying org A's context cannot read or mutate ANY of org B's rows —
 * across every tenant-owned table — and that inserts are forced into the
 * caller's own org. A failure here blocks release.
 */
describe("cross-tenant isolation", () => {
  let db: DrizzleDatabase;
  let raw: Database.Database;
  let orgA: Awaited<ReturnType<typeof seedFullOrg>>;
  let orgB: Awaited<ReturnType<typeof seedFullOrg>>;
  let ctxA: TenantContext;

  beforeEach(async () => {
    ({ db, raw } = createTestDb());
    orgA = await seedFullOrg(db, { name: "Alpha SC", slug: "alpha", jurisdiction: "england" });
    orgB = await seedFullOrg(db, { name: "Bravo SC", slug: "bravo", jurisdiction: "scotland" });
    ctxA = { organisationId: orgA.organisationId, slug: "alpha", userId: "user-a", role: "admin" };
  });

  it("seeds both orgs with data in every tenant table", () => {
    for (const table of TENANT_TABLES) {
      const name = getTableName(table);
      const countA = (raw
        .prepare(`SELECT COUNT(*) AS n FROM "${name}" WHERE organisation_id = ?`)
        .get(orgA.organisationId) as { n: number }).n;
      const countB = (raw
        .prepare(`SELECT COUNT(*) AS n FROM "${name}" WHERE organisation_id = ?`)
        .get(orgB.organisationId) as { n: number }).n;
      expect(countA, `${name} should have org A rows`).toBeGreaterThan(0);
      expect(countB, `${name} should have org B rows`).toBeGreaterThan(0);
    }
  });

  it("list() returns only the caller's rows, for every table", async () => {
    for (const table of TENANT_TABLES) {
      const name = getTableName(table);
      const repo = new TenantRepository(db, table as never);
      const rows = (await repo.list(ctxA)) as { organisationId: string }[];
      expect(rows.length, `${name} list should be non-empty for A`).toBeGreaterThan(0);
      expect(
        rows.every((r) => r.organisationId === orgA.organisationId),
        `${name} leaked a foreign-org row through list()`,
      ).toBe(true);
    }
  });

  it("findById() cannot read another org's row, for every table", async () => {
    for (const table of TENANT_TABLES) {
      const name = getTableName(table);
      const repo = new TenantRepository(db, table as never);
      const bRow = raw
        .prepare(`SELECT id FROM "${name}" WHERE organisation_id = ? LIMIT 1`)
        .get(orgB.organisationId) as { id: string } | undefined;
      expect(bRow, `${name} should have a B row to probe`).toBeTruthy();
      const fetched = await repo.findById(ctxA, bRow!.id);
      expect(fetched, `${name} leaked a foreign-org row through findById()`).toBeNull();
    }
  });

  it("delete() cannot remove another org's row, for every table", async () => {
    for (const table of TENANT_TABLES) {
      const name = getTableName(table);
      const repo = new TenantRepository(db, table as never);
      const bRow = raw
        .prepare(`SELECT id FROM "${name}" WHERE organisation_id = ? LIMIT 1`)
        .get(orgB.organisationId) as { id: string } | undefined;
      const removed = await repo.delete(ctxA, bRow!.id);
      expect(removed, `${name} allowed a cross-tenant delete`).toBe(0);
      const stillThere = raw
        .prepare(`SELECT COUNT(*) AS n FROM "${name}" WHERE id = ?`)
        .get(bRow!.id) as { n: number };
      expect(stillThere.n, `${name} row was removed cross-tenant`).toBe(1);
    }
  });

  it("update() cannot mutate another org's row", async () => {
    const repo = new TenantRepository(db, instructor);
    const bInstructor = raw
      .prepare(`SELECT id, name FROM instructor WHERE organisation_id = ? LIMIT 1`)
      .get(orgB.organisationId) as { id: string; name: string };

    const result = await repo.update(ctxA, bInstructor.id, { name: "HACKED" });
    expect(result).toBeNull();

    const after = raw.prepare(`SELECT name FROM instructor WHERE id = ?`).get(bInstructor.id) as { name: string };
    expect(after.name).toBe(bInstructor.name);
  });

  it("insert() forces the caller's org id even if a foreign id is smuggled in", async () => {
    const repo = new TenantRepository(db, instructor);
    // Deliberately smuggle org B's id through the payload (cast past the type
    // guard) — the repository must overwrite it with the context's org.
    const created = await repo.insert(ctxA, {
      organisationId: orgB.organisationId,
      name: "Injected",
      email: "x@x.test",
      employmentType: "employed",
      status: "active",
    } as never);
    expect(created.organisationId).toBe(orgA.organisationId);

    // And org B must not be able to see it.
    const ctxB: TenantContext = { organisationId: orgB.organisationId, slug: "bravo", userId: "user-b", role: "admin" };
    const fromB = await repo.findById(ctxB, created.id);
    expect(fromB).toBeNull();
  });

  it("insertMany() forces the caller's org id on every row, in every chunk", async () => {
    const repo = new TenantRepository(db, instructor);
    const rows = Array.from({ length: 23 }, (_, i) => ({
      organisationId: orgB.organisationId, // smuggled; must be overwritten
      name: `Bulk ${i}`,
      email: `bulk${i}@x.test`,
      employmentType: "employed",
      status: "active",
    }));
    const created = await repo.insertMany(ctxA, rows as never);
    expect(created).toHaveLength(23);
    expect(created.every((r) => r.organisationId === orgA.organisationId)).toBe(true);

    const ctxB: TenantContext = { organisationId: orgB.organisationId, slug: "bravo", userId: "user-b", role: "admin" };
    for (const r of created) expect(await repo.findById(ctxB, r.id)).toBeNull();
    const seenByB = await repo.list(ctxB);
    expect(seenByB.some((r) => r.name.startsWith("Bulk "))).toBe(false);
  });

  it("updateWhere() and deleteWhere() only ever touch the caller's rows, for every table", async () => {
    for (const table of TENANT_TABLES) {
      const name = getTableName(table);
      const repo = new TenantRepository(db, table as never);
      const before = (raw.prepare(`SELECT COUNT(*) AS n FROM "${name}" WHERE organisation_id = ?`).get(orgB.organisationId) as { n: number }).n;
      // A condition that matches every row in the table, both orgs.
      await repo.updateWhere(ctxA, sql`1 = 1`, {} as never).catch(() => 0);
      const removed = await repo.deleteWhere(ctxA, sql`1 = 1`).catch(() => -1);
      const after = (raw.prepare(`SELECT COUNT(*) AS n FROM "${name}" WHERE organisation_id = ?`).get(orgB.organisationId) as { n: number }).n;
      expect(after, `${name}: deleteWhere() removed another org's rows (removed ${removed})`).toBe(before);
    }
  });

  it("updateWhere() cannot change another org's row", async () => {
    const repo = new TenantRepository(db, instructor);
    const bInstructor = raw.prepare(`SELECT id, name FROM instructor WHERE organisation_id = ? LIMIT 1`).get(orgB.organisationId) as { id: string; name: string };
    const n = await repo.updateWhere(ctxA, sql`${instructor.id} = ${bInstructor.id}`, { name: "HACKED" });
    expect(n).toBe(0);
    expect((raw.prepare(`SELECT name FROM instructor WHERE id = ?`).get(bInstructor.id) as { name: string }).name).toBe(bInstructor.name);
  });

  it("upsertMany() forces the caller's org id and never updates another org's row on a key clash", async () => {
    const repo = new TenantRepository(db, availability);
    const bRow = raw.prepare(`SELECT instructor_id AS instructorId, date, slot, status FROM availability WHERE organisation_id = ? AND date IS NOT NULL LIMIT 1`).get(orgB.organisationId) as { instructorId: string; date: string; slot: string; status: string };
    const key = { target: [availability.instructorId, availability.date, availability.slot], targetWhere: isNotNull(availability.date) };
    // Same key as org B's row, smuggled org id: must not overwrite B's row.
    await repo.upsertMany(ctxA, [{ organisationId: orgB.organisationId, instructorId: bRow.instructorId, date: bRow.date, weekday: null, slot: bRow.slot, status: "tentative", setBy: "office" }] as never, key, ["status", "setBy"]);
    const after = raw.prepare(`SELECT status, organisation_id AS org FROM availability WHERE instructor_id = ? AND date = ? AND slot = ?`).all(bRow.instructorId, bRow.date, bRow.slot) as { status: string; org: string }[];
    expect(after.find((r) => r.org === orgB.organisationId)!.status).toBe(bRow.status);
    expect(after.every((r) => r.org === orgB.organisationId || r.org === orgA.organisationId)).toBe(true);
    const aRows = await repo.list(ctxA);
    expect(aRows.every((r) => r.organisationId === orgA.organisationId)).toBe(true);
  });
});
