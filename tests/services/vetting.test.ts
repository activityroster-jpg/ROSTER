import { beforeEach, describe, expect, it, vi } from "vitest";

const deleted: string[] = [];
vi.mock("@/lib/r2", () => ({
  deleteDocument: vi.fn(async (_c: unknown, key: string) => { deleted.push(key); }),
  putDocument: vi.fn(async (_c: unknown, rel: string) => `org_x/${rel}`),
}));
const sent: { to: string; subject: string; html: string }[] = [];
vi.mock("@/lib/mail", () => ({ sendEmail: vi.fn(async (m: { to: string; subject: string; html: string }) => { sent.push(m); }), escapeHtml: (s: unknown) => String(s ?? "") }));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { attachDocument } from "@/lib/services/documents";
import { removeVettingFiles, sendExpiryDigest } from "@/lib/services/retention";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext, TenantContext } from "@/lib/tenant/context";
import type { CloudflareEnv } from "@/lib/cf/bindings";

const env = { APP_APEX_DOMAIN: "activityroster.com" } as unknown as CloudflareEnv;

describe("vetting checks (decision C5) and expiry emails", () => {
  let repos: Repositories; let sys: SystemTenantContext; let ctx: TenantContext; let instructorId: string; let dbsTypeId: string; let firstAidTypeId: string;
  beforeEach(async () => {
    deleted.length = 0; sent.length = 0;
    const { db } = createTestDb();
    const seeded = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    repos = seeded.repos; sys = seeded.ctx;
    const owner = (await repos.control.userByEmail("owner@alpha.test"))!;
    ctx = { organisationId: sys.organisationId, slug: sys.slug, userId: owner.id, role: "admin" } as TenantContext;
    instructorId = (await repos.tenant.instructor.list(sys))[0]!.id;
    const types = await repos.tenant.complianceType.list(sys);
    dbsTypeId = types.find((t) => t.code === "DBS")!.id;
    firstAidTypeId = types.find((t) => t.code === "FIRST_AID")!.id;
  });

  it("seeds the jurisdiction's vetting check as status-only", async () => {
    const types = await repos.tenant.complianceType.list(sys);
    expect(types.find((t) => t.code === "DBS")?.isVetting).toBe(true);
    expect(types.find((t) => t.code === "FIRST_AID")?.isVetting).toBe(false);
  });

  it("refuses a certificate upload against a vetting check but accepts one for first aid", async () => {
    const dbs = await repos.tenant.complianceItem.insert(sys, { instructorId, complianceTypeId: dbsTypeId, reference: null, expiryDate: null, verified: false });
    const fa = await repos.tenant.complianceItem.insert(sys, { instructorId, complianceTypeId: firstAidTypeId, reference: null, expiryDate: null, verified: false });
    const body = new ArrayBuffer(8);
    const r1 = await attachDocument(repos, ctx, { kind: "compliance", itemId: dbs.id, filename: "dbs.pdf", contentType: "application/pdf", body, expiryDate: null });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error).toMatch(/not stored/);
    const r2 = await attachDocument(repos, ctx, { kind: "compliance", itemId: fa.id, filename: "fa.pdf", contentType: "application/pdf", body, expiryDate: null });
    expect(r2.ok).toBe(true);
  });

  it("removes any certificate still attached to a vetting check", async () => {
    await repos.tenant.complianceItem.insert(sys, { instructorId, complianceTypeId: dbsTypeId, reference: null, expiryDate: null, verified: true, docKey: `org_${sys.organisationId}/old-dbs.pdf` });
    expect(await removeVettingFiles(repos, sys)).toBe(1);
    expect(deleted).toHaveLength(1);
    expect((await repos.tenant.complianceItem.list(sys)).every((c) => c.complianceTypeId !== dbsTypeId || !c.docKey)).toBe(true);
    expect(await removeVettingFiles(repos, sys)).toBe(0);
  });

  it("emails admins a digest of expiring and expired certs", async () => {
    const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    await repos.tenant.complianceItem.insert(sys, { instructorId, complianceTypeId: firstAidTypeId, reference: null, expiryDate: soon, verified: true });
    await repos.tenant.complianceItem.insert(sys, { instructorId, complianceTypeId: dbsTypeId, reference: null, expiryDate: "2020-01-01", verified: true });
    expect(await sendExpiryDigest(repos, sys, env)).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("owner@alpha.test");
    expect(sent[0]!.html).toMatch(/expired 2020-01-01/);
    expect(sent[0]!.html).toMatch(new RegExp(`expires ${soon}`));
  });
});
