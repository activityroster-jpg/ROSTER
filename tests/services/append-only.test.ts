import { describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { eraseOrganisationData } from "@/lib/services/export";
import { writeAudit } from "@/lib/services/audit";

/** Migration 0046: audit_log and security_event can't be changed or deleted while their owner exists. */
describe("append-only logs", () => {
  it("refuses to update or delete an audit entry of a live centre", async () => {
    const { db, raw } = createTestDb();
    const { repos, ctx } = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    await writeAudit(repos, ctx, { action: "update", entity: "org_settings", after: { x: 1 } });
    const rows = await repos.tenant.auditLog.list(ctx);
    expect(rows.length).toBeGreaterThan(0);
    const id = rows[0]!.id;
    expect(() => raw.prepare("UPDATE audit_log SET action = 'tampered' WHERE id = ?").run(id)).toThrow(/append-only/);
    expect(() => raw.prepare("DELETE FROM audit_log WHERE id = ?").run(id)).toThrow(/append-only/);
    await expect(repos.tenant.auditLog.deleteAllForOrg(ctx)).rejects.toThrow(/append-only/);
    expect((await repos.tenant.auditLog.list(ctx)).length).toBe(rows.length);
  });

  it("still lets a whole centre be erased (the cascade runs after the organisation row is gone)", async () => {
    const { db, raw } = createTestDb();
    const { repos, ctx } = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    await writeAudit(repos, ctx, { action: "update", entity: "org_settings", after: { x: 1 } });
    const res = await eraseOrganisationData(repos, ctx);
    expect(res.erased).toBe(true);
    expect(raw.prepare("SELECT count(*) AS n FROM audit_log WHERE organisation_id = ?").get(ctx.organisationId)).toEqual({ n: 0 });
    expect(await repos.control.organisationById(ctx.organisationId)).toBeNull();
  });

  it("protects security events the same way", async () => {
    const { db, raw } = createTestDb();
    const { repos } = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    const owner = await repos.control.userByEmail("owner@alpha.test");
    await repos.control.logSecurityEvent({ userId: owner!.id, kind: "password_changed", ip: null, country: null, userAgent: null, organisationId: null, meta: null });
    const ev = raw.prepare("SELECT id FROM security_event WHERE user_id = ?").get(owner!.id) as { id: string };
    expect(() => raw.prepare("DELETE FROM security_event WHERE id = ?").run(ev.id)).toThrow(/append-only/);
    expect(() => raw.prepare("UPDATE security_event SET kind = 'pin_set' WHERE id = ?").run(ev.id)).toThrow(/append-only/);
    // Deleting the user cascades through.
    expect(await repos.control.deleteOrphanUser(owner!.id)).toBeTypeOf("boolean");
  });
});
