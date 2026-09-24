import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { decideLeave, listLeave, requestLeave } from "@/lib/services/leave";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";
import type { Database as DrizzleDatabase } from "@/lib/db/client";

describe("leave service", () => {
  let db: DrizzleDatabase;
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let instructorId: string;

  beforeEach(async () => {
    ({ db } = createTestDb());
    const seeded = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    repos = seeded.repos;
    ctx = seeded.ctx;
    instructorId = (await repos.tenant.instructor.list(ctx))[0]!.id;
  });

  it("raises a pending request and lists it with the instructor name", async () => {
    const created = await requestLeave(repos, ctx, instructorId, {
      type: "sick", startDate: "2026-03-01", endDate: "2026-03-01", days: 1, reason: "flu",
    });
    expect(created.status).toBe("pending");
    const rows = await listLeave(repos, ctx);
    const mine = rows.find((r) => r.id === created.id);
    expect(mine?.instructorName).toContain("Instructor");
    expect(mine?.type).toBe("sick");
  });

  it("approves a request and records the decision", async () => {
    const created = await requestLeave(repos, ctx, instructorId, {
      type: "annual", startDate: "2026-04-01", endDate: "2026-04-05", days: 5,
    });
    const decided = await decideLeave(repos, ctx, created.id, "approved");
    expect(decided?.status).toBe("approved");
    expect(decided?.decidedAt).not.toBeNull();
  });
});
