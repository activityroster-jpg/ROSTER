import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { createBooking, getRevenueSummary, listBookings, setBookingStatus } from "@/lib/services/bookings";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";
import type { Database as DrizzleDatabase } from "@/lib/db/client";

describe("bookings service", () => {
  let db: DrizzleDatabase;
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let courseId: string;

  beforeEach(async () => {
    ({ db } = createTestDb());
    const seeded = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    repos = seeded.repos;
    ctx = seeded.ctx;
    courseId = (await repos.tenant.course.list(ctx))[0]!.id;
  });

  it("prices a booking from the course price × headcount when amount omitted", async () => {
    await repos.tenant.course.update(ctx, courseId, { price: 30 });
    const b = await createBooking(repos, ctx, { courseId, customerName: "Jo", headcount: 2 });
    expect(b.amount).toBe(60);
    expect(b.status).toBe("provisional");
  });

  it("marks paid and records paidAt", async () => {
    const b = await createBooking(repos, ctx, { courseId, customerName: "Jo", headcount: 1, amount: 40 });
    const paid = await setBookingStatus(repos, ctx, b.id, "paid");
    expect(paid?.status).toBe("paid");
    expect(paid?.paidAt).not.toBeNull();
  });

  it("counts only confirmed/paid towards revenue; provisional is outstanding", async () => {
    // Fixture already seeds one confirmed booking of £120.
    const before = await getRevenueSummary(repos, ctx);
    expect(before.total).toBeCloseTo(120, 2);

    await createBooking(repos, ctx, { courseId, customerName: "Prov", headcount: 1, amount: 50 }); // provisional
    const mid = await getRevenueSummary(repos, ctx);
    expect(mid.total).toBeCloseTo(120, 2); // unchanged
    expect(mid.outstanding).toBeCloseTo(50, 2);

    const b = await createBooking(repos, ctx, { courseId, customerName: "Conf", headcount: 1, amount: 80 });
    await setBookingStatus(repos, ctx, b.id, "confirmed");
    const after = await getRevenueSummary(repos, ctx);
    expect(after.total).toBeCloseTo(200, 2); // 120 + 80
  });

  it("excludes cancelled bookings from revenue and outstanding", async () => {
    const b = await createBooking(repos, ctx, { courseId, customerName: "Gone", headcount: 1, amount: 99 });
    await setBookingStatus(repos, ctx, b.id, "cancelled");
    const summary = await getRevenueSummary(repos, ctx);
    // Only the seeded £120 confirmed booking counts; the cancelled £99 is ignored.
    expect(summary.total).toBeCloseTo(120, 2);
    expect(summary.outstanding).toBeCloseTo(0, 2);
  });

  it("lists bookings with the course name", async () => {
    const rows = await listBookings(repos, ctx);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.courseName).toContain("Course");
  });
});
