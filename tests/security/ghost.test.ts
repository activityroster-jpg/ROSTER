import { describe, it, expect } from "vitest";
import { signGhostToken, verifyGhostToken, cookieFromHeader, GhostReadOnlyError } from "@/lib/auth/ghost";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import type { TenantContext } from "@/lib/tenant/context";
import { writeAudit } from "@/lib/services/audit";

const SECRET = "a-test-secret-that-is-long-enough-123";

describe("ghost token", () => {
  it("round-trips, and rejects tampering, the wrong secret and expiry", async () => {
    const claims = { organisationId: "org1", adminUserId: "u1", exp: Math.floor(Date.now() / 1000) + 60 };
    const token = await signGhostToken(SECRET, claims);
    expect(await verifyGhostToken(SECRET, token)).toEqual(claims);
    expect(await verifyGhostToken("another-secret-that-is-long-enough", token)).toBeNull();
    expect(await verifyGhostToken(SECRET, token.replace(/.$/, (c) => (c === "a" ? "b" : "a")))).toBeNull();
    const expired = await signGhostToken(SECRET, { ...claims, exp: Math.floor(Date.now() / 1000) - 1 });
    expect(await verifyGhostToken(SECRET, expired)).toBeNull();
    expect(await verifyGhostToken(SECRET, undefined)).toBeNull();
  });

  it("reads a cookie out of a Cookie header", () => {
    expect(cookieFromHeader("a=1; ar_ghost=abc.def; b=2", "ar_ghost")).toBe("abc.def");
    expect(cookieFromHeader("a=1", "ar_ghost")).toBeNull();
    expect(cookieFromHeader(null, "ar_ghost")).toBeNull();
  });
});

describe("ghost context is read-only, structurally", () => {
  it("can read every tenant table but no repository write succeeds, and audit is silent", async () => {
    const { db } = createTestDb();
    const { repos, ctx: sys } = await seedFullOrg(db, { name: "Ghosted", slug: "ghosted", jurisdiction: "england" });
    const ghost: TenantContext = { organisationId: sys.organisationId, slug: sys.slug, userId: "owner", role: "admin", ghost: true };
    const t = repos.tenant;

    const courses = await t.course.list(ghost);
    expect(courses.length).toBeGreaterThan(0);
    expect(await t.course.findById(ghost, courses[0]!.id)).not.toBeNull();

    await expect(t.course.update(ghost, courses[0]!.id, { name: "changed" })).rejects.toBeInstanceOf(GhostReadOnlyError);
    await expect(t.course.delete(ghost, courses[0]!.id)).rejects.toBeInstanceOf(GhostReadOnlyError);
    await expect(t.location.insert(ghost, { name: "x", locationTypeId: null, active: true })).rejects.toBeInstanceOf(GhostReadOnlyError);
    await expect(t.auditLog.deleteAllForOrg(ghost)).rejects.toBeInstanceOf(GhostReadOnlyError);

    const before = await t.auditLog.count(sys);
    await writeAudit(repos, ghost, { action: "peek", entity: "course" }); // must not throw, must not write
    expect(await t.auditLog.count(sys)).toBe(before);
    expect((await t.course.findById(sys, courses[0]!.id))!.name).not.toBe("changed");
  });
});
