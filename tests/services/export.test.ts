import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { eraseOrganisation, exportOrganisationData } from "@/lib/services/export";
import type { Repositories } from "@/lib/db/repositories";
import type { TenantContext } from "@/lib/tenant/context";
import type { Database as DrizzleDatabase } from "@/lib/db/client";

describe("data export & erasure", () => {
  let db: DrizzleDatabase;
  let repos: Repositories;
  let ctxA: TenantContext;
  let orgAId: string;
  let orgBId: string;

  beforeEach(async () => {
    ({ db } = createTestDb());
    const a = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    const b = await seedFullOrg(db, { name: "Bravo", slug: "bravo", jurisdiction: "scotland" });
    repos = a.repos;
    orgAId = a.organisationId;
    orgBId = b.organisationId;
    ctxA = { organisationId: orgAId, slug: "alpha", userId: "u", role: "admin" };
  });

  it("exports only the caller's org data", async () => {
    const data = await exportOrganisationData(repos, ctxA);
    const instructors = data.instructor as { organisationId: string; name: string }[];
    expect(instructors.length).toBeGreaterThan(0);
    expect(instructors.every((i) => i.organisationId === orgAId)).toBe(true);
    expect((data.organisation as { id: string }).id).toBe(orgAId);
  });

  it("refuses erasure without a matching slug confirmation", async () => {
    await expect(eraseOrganisation(repos, ctxA, "wrong")).rejects.toThrow();
  });

  it("refuses erasure for a non-admin", async () => {
    const instructorCtx: TenantContext = { ...ctxA, role: "instructor" };
    await expect(eraseOrganisation(repos, instructorCtx, "alpha")).rejects.toThrow();
  });

  it("erases the org and cascades, leaving other orgs intact", async () => {
    const res = await eraseOrganisation(repos, ctxA, "alpha");
    expect(res.erased).toBe(true);

    expect(await repos.control.organisationById(orgAId)).toBeNull();
    // Org A's tenant rows are gone (cascade).
    const ctxAafter: TenantContext = { ...ctxA };
    expect((await repos.tenant.instructor.list(ctxAafter)).length).toBe(0);

    // Org B is untouched.
    expect(await repos.control.organisationById(orgBId)).not.toBeNull();
    const ctxB: TenantContext = { organisationId: orgBId, slug: "bravo", userId: "u2", role: "admin" };
    expect((await repos.tenant.instructor.list(ctxB)).length).toBeGreaterThan(0);
  });
});
