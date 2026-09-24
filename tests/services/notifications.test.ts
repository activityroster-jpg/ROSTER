import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { listForInstructor, markRead, notifyInstructor, unreadCount } from "@/lib/services/notifications";
import { decideLeave, requestLeave } from "@/lib/services/leave";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";
import type { Database as DrizzleDatabase } from "@/lib/db/client";

describe("notifications service", () => {
  let db: DrizzleDatabase;
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let freshId: string;

  beforeEach(async () => {
    ({ db } = createTestDb());
    const seeded = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    repos = seeded.repos;
    ctx = seeded.ctx;
    // Fresh instructor with no seeded notifications, for clean counts.
    const fresh = await repos.tenant.instructor.insert(ctx, {
      name: "Fresh", email: "fresh@alpha.test", employmentType: "employed", status: "active",
    });
    freshId = fresh.id;
  });

  it("creates an unread in-app notification, then marks it read", async () => {
    const n = await notifyInstructor(repos, ctx, freshId, { title: "Hello", body: "world" });
    expect(n).not.toBeNull();
    expect(await unreadCount(repos, ctx, freshId)).toBe(1);

    const list = await listForInstructor(repos, ctx, freshId);
    expect(list[0]!.title).toBe("Hello");
    expect(list[0]!.readAt).toBeNull();

    await markRead(repos, ctx, n!.id);
    expect(await unreadCount(repos, ctx, freshId)).toBe(0);
  });

  it("notifies the instructor when their leave is decided", async () => {
    const leave = await requestLeave(repos, ctx, freshId, {
      type: "annual", startDate: "2026-05-01", endDate: "2026-05-02", days: 2,
    });
    await decideLeave(repos, ctx, leave.id, "approved");

    const list = await listForInstructor(repos, ctx, freshId);
    expect(list.some((n) => n.title === "Leave approved")).toBe(true);
  });
});
