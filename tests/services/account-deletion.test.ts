import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("@/lib/mail", () => ({ sendEmail: vi.fn(async () => {}), escapeHtml: (s: unknown) => String(s ?? "") }));
vi.mock("@/lib/r2", () => ({ deleteDocument: vi.fn(async () => {}), listDocuments: vi.fn(async () => []), putDocument: vi.fn(async () => {}), tenantKey: (...a: string[]) => a.join("/") }));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { deleteMyAccount } from "@/lib/services/account-deletion";
import { instructor as instructorTable } from "@/lib/db/schema";
import type { Database as Db } from "@/lib/db/client";

/**
 * Deleting your own account from the app: the login goes, every centre's copy
 * of you is anonymised (roster history stays as "Former staff member"), and
 * the owner of a live centre is refused until the centre has another owner.
 */
describe("delete my account", () => {
  let db: Db;
  let a: Awaited<ReturnType<typeof seedFullOrg>>;
  let b: Awaited<ReturnType<typeof seedFullOrg>>;

  beforeEach(async () => {
    ({ db } = createTestDb());
    a = await seedFullOrg(db, { name: "Harbour", slug: "harbour", jurisdiction: "england" });
    b = await seedFullOrg(db, { name: "Lakeside", slug: "lakeside", jurisdiction: "england" });
  });

  /** An instructor with a login at both centres. */
  const makeKim = async () => {
    const u = await a.repos.control.createUser({ name: "Kim Taylor", email: "kim@both.test" });
    for (const o of [a, b]) {
      await o.repos.control.createMembership({ userId: u.id, organisationId: o.organisationId, role: "instructor" }, "active");
      await o.repos.tenant.instructor.insert(o.ctx, { name: "Kim Taylor", email: "kim@both.test", phone: "07700 900001", employmentType: "employed", status: "active", userId: u.id });
    }
    return u;
  };

  it("removes the login and anonymises the person in every centre, keeping the roster record", async () => {
    const kim = await makeKim();
    const r = await deleteMyAccount(a.repos, kim.id);
    expect(r).toMatchObject({ ok: true, centres: 2 });
    expect(await a.repos.control.userById(kim.id)).toBeNull();
    expect(await a.repos.control.membershipsForUser(kim.id)).toEqual([]);
    for (const o of [a, b]) {
      const rows = await o.repos.tenant.instructor.list(o.ctx, eq(instructorTable.email, "kim@both.test"));
      expect(rows).toEqual([]);
      const former = (await o.repos.tenant.instructor.list(o.ctx)).filter((i) => i.anonymisedAt);
      expect(former).toHaveLength(1);
      expect(former[0]!.name).toBe("Former staff member");
      expect(former[0]!.userId).toBeNull();
    }
    // The centres' own people are untouched.
    expect((await a.repos.tenant.instructor.list(a.ctx)).filter((i) => !i.anonymisedAt).length).toBeGreaterThan(0);
  });

  it("refuses the owner of a live centre, and a platform admin", async () => {
    const owner = (await a.repos.control.userByEmail("owner@harbour.test"))!;
    const r = await deleteMyAccount(a.repos, owner.id);
    expect(r).toMatchObject({ ok: false, reason: "owner" });
    expect(await a.repos.control.userById(owner.id)).not.toBeNull();
    const kim = await makeKim();
    expect(await deleteMyAccount(a.repos, kim.id, { isPlatformAdmin: true })).toMatchObject({ ok: false, reason: "platform_admin" });
  });

  it("deletes an office-only admin (no instructor record) cleanly", async () => {
    const u = await a.repos.control.createUser({ name: "Office Only", email: "office@harbour.test" });
    await a.repos.control.createMembership({ userId: u.id, organisationId: a.organisationId, role: "admin" }, "active");
    expect(await deleteMyAccount(a.repos, u.id)).toMatchObject({ ok: true, centres: 1 });
    expect(await a.repos.control.userById(u.id)).toBeNull();
  });
});
