import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { linkInstructorUser } from "@/lib/services/invite";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";
import type { Database as DrizzleDatabase } from "@/lib/db/client";

describe("linkInstructorUser (portal invite)", () => {
  let db: DrizzleDatabase;
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let instructorId: string;
  let orgId: string;

  beforeEach(async () => {
    ({ db } = createTestDb());
    const seeded = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    repos = seeded.repos;
    ctx = seeded.ctx;
    orgId = seeded.organisationId;
    instructorId = (await repos.tenant.instructor.list(ctx))[0]!.id;
  });

  it("creates a user + instructor membership and links the instructor record", async () => {
    const res = await linkInstructorUser(repos, ctx, instructorId);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const user = await repos.control.userByEmail(res.email);
    expect(user).not.toBeNull();
    const membership = await repos.control.activeMembership(user!.id, orgId);
    expect(membership?.role).toBe("instructor");

    const instructor = await repos.tenant.instructor.findById(ctx, instructorId);
    expect(instructor?.userId).toBe(user!.id);
  });

  it("is idempotent and does not duplicate the user or membership", async () => {
    const first = await linkInstructorUser(repos, ctx, instructorId);
    const second = await linkInstructorUser(repos, ctx, instructorId);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok) expect(first.created).toBe(true);
    if (second.ok) expect(second.created).toBe(false);
  });

  it("refuses to invite an instructor with no email", async () => {
    const noEmail = await repos.tenant.instructor.insert(ctx, {
      name: "No Email",
      employmentType: "volunteer",
      status: "active",
    });
    const res = await linkInstructorUser(repos, ctx, noEmail.id);
    expect(res.ok).toBe(false);
  });
});
