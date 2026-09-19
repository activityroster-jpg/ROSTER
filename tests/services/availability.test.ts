import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { getWeekAvailability, setAvailability } from "@/lib/services/availability";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";
import type { Database as DrizzleDatabase } from "@/lib/db/client";

const MONDAY = "2026-01-05";

describe("availability service", () => {
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

  it("inserts, then updates the same slot in place", async () => {
    await setAvailability(repos, ctx, instructorId, "2026-01-06", "AM", "available");
    let week = await getWeekAvailability(repos, ctx, instructorId, MONDAY);
    expect(week["2026-01-06|AM"]).toBe("available");

    await setAvailability(repos, ctx, instructorId, "2026-01-06", "AM", "unavailable");
    week = await getWeekAvailability(repos, ctx, instructorId, MONDAY);
    expect(week["2026-01-06|AM"]).toBe("unavailable");

    // No duplicate row was created for the same date+slot.
    const rows = await repos.tenant.availability.list(ctx);
    const forSlot = rows.filter((r) => r.date === "2026-01-06" && r.slot === "AM");
    expect(forSlot.length).toBe(1);
  });

  it("clears a slot when status is null", async () => {
    await setAvailability(repos, ctx, instructorId, "2026-01-07", "PM", "tentative");
    await setAvailability(repos, ctx, instructorId, "2026-01-07", "PM", null);
    const week = await getWeekAvailability(repos, ctx, instructorId, MONDAY);
    expect(week["2026-01-07|PM"]).toBeUndefined();
  });

  it("only returns availability within the requested week", async () => {
    await setAvailability(repos, ctx, instructorId, "2026-01-06", "AM", "available"); // in week
    await setAvailability(repos, ctx, instructorId, "2026-01-20", "AM", "available"); // next fortnight
    const week = await getWeekAvailability(repos, ctx, instructorId, MONDAY);
    expect(week["2026-01-06|AM"]).toBe("available");
    expect(week["2026-01-20|AM"]).toBeUndefined();
  });
});
