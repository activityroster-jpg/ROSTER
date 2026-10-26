import { describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";

/** Dev Center → Users: every login, with its centres, searchable by name or email. */
describe("listAllUsers", () => {
  it("lists logins with their centres and searches name and email literally", async () => {
    const { db } = createTestDb();
    const a = await seedFullOrg(db, { name: "Harbour", slug: "harbour", jurisdiction: "england" });
    const kim = await a.repos.control.createUser({ name: "Kim Taylor", email: "kim_t@both.test" });
    await a.repos.control.createMembership({ userId: kim.id, organisationId: a.organisationId, role: "instructor" }, "active");
    await a.repos.control.createUser({ name: "Sam Lee", email: "kimxt@other.test" });

    const all = await a.repos.control.listAllUsers();
    const k = all.find((u) => u.id === kim.id);
    expect(k?.centres).toEqual([expect.objectContaining({ name: "Harbour", role: "instructor" })]);
    expect(k?.lastActiveAt).toBeNull();

    // "_" is a literal, not a wildcard: kimxt@ must not match.
    expect((await a.repos.control.listAllUsers({ search: "KIM_T" })).map((u) => u.email)).toEqual(["kim_t@both.test"]);
    expect((await a.repos.control.listAllUsers({ search: "sam" })).map((u) => u.email)).toEqual(["kimxt@other.test"]);
  });
});
