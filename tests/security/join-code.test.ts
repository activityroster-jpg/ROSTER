import { describe, it, expect } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { createRepositories } from "@/lib/db/repositories";
import { generateJoinCode, normaliseJoinCode } from "@/lib/db/repositories/control-plane";

describe("company (join) codes", () => {
  it("generates 6-char codes without look-alike characters and normalises typed input", () => {
    for (let i = 0; i < 50; i++) expect(generateJoinCode()).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    expect(normaliseJoinCode(" 7kd-4px ")).toBe("7KD4PX");
    expect(normaliseJoinCode("7KD4P")).toBeNull();
    expect(normaliseJoinCode("")).toBeNull();
  });

  it("issues a code per centre, finds the centre by it, and regenerating retires the old one", async () => {
    const { db } = createTestDb();
    const { control } = createRepositories(db);
    const org = await control.createOrganisation({ name: "Code Club", slug: "codeclub", jurisdiction: "england", plan: "rostering", status: "active" });
    const code = await control.ensureJoinCode(org.id);
    expect(await control.ensureJoinCode(org.id)).toBe(code); // stable
    expect((await control.organisationByJoinCode(code.toLowerCase()))?.id).toBe(org.id);
    const next = await control.regenerateJoinCode(org.id);
    expect(next).not.toBe(code);
    expect(await control.organisationByJoinCode(code)).toBeNull();
    expect((await control.organisationByJoinCode(next))?.id).toBe(org.id);
  });

  it("lists a user's centres with status, and requested → active on approval", async () => {
    const { db } = createTestDb();
    const { control } = createRepositories(db);
    const org = await control.createOrganisation({ name: "A", slug: "a-club", jurisdiction: "england", plan: "rostering", status: "active" });
    const u = await control.createUser({ name: "Pat", email: "pat@x.test" });
    await control.createMembership({ userId: u.id, organisationId: org.id, role: "instructor" }, "requested");
    expect((await control.membershipsForUser(u.id))[0]).toMatchObject({ organisationId: org.id, name: "A", status: "requested" });
    expect(await control.activeMembership(u.id, org.id)).toBeNull();
    await control.setMembershipStatus(u.id, org.id, "active");
    expect((await control.activeMembership(u.id, org.id))?.role).toBe("instructor");
    await control.deleteMembership(u.id, org.id);
    expect(await control.membershipsForUser(u.id)).toHaveLength(0);
  });
});
