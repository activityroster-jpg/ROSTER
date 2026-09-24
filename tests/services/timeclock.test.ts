import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { clockIn, clockOut, getAttendanceBoard, getOpenEntry } from "@/lib/services/timeclock";
import { hoursRecord as hoursRecordTable } from "@/lib/db/schema";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";
import type { Database as DrizzleDatabase } from "@/lib/db/client";

const DAY = "2026-01-05";
const NINE_AM = Date.parse(`${DAY}T09:00:00.000Z`);

describe("timeclock service", () => {
  let db: DrizzleDatabase;
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let instructorId: string;
  let sessionId: string;

  beforeEach(async () => {
    ({ db } = createTestDb());
    const seeded = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    repos = seeded.repos;
    ctx = seeded.ctx;
    instructorId = (await repos.tenant.instructor.list(ctx))[0]!.id;
    sessionId = (await repos.tenant.courseSession.list(ctx))[0]!.id;
  });

  it("opens a single entry and is idempotent on double clock-in", async () => {
    const first = await clockIn(repos, ctx, instructorId, sessionId, NINE_AM);
    const second = await clockIn(repos, ctx, instructorId, sessionId, NINE_AM + 60_000);
    expect(second.id).toBe(first.id); // no second open entry
    const open = await getOpenEntry(repos, ctx, instructorId);
    expect(open?.id).toBe(first.id);
  });

  it("clock-out computes minutes and writes actual onto the hours record", async () => {
    await clockIn(repos, ctx, instructorId, sessionId, NINE_AM);
    const closed = await clockOut(repos, ctx, instructorId, NINE_AM + 2 * 60 * 60 * 1000); // 2h
    expect(closed).not.toBeNull();
    expect(closed!.clockOutAt).not.toBeNull();

    const rec = (
      await repos.tenant.hoursRecord.list(
        ctx,
        and(eq(hoursRecordTable.instructorId, instructorId), eq(hoursRecordTable.courseSessionId, sessionId))!,
      )
    )[0];
    expect(rec?.actualMinutes).toBe(120);
  });

  it("clock-out with nothing open returns null", async () => {
    const res = await clockOut(repos, ctx, instructorId, NINE_AM);
    expect(res).toBeNull();
  });

  it("clock-out creates an hours record when none exists for that session", async () => {
    // A fresh instructor with no seeded hours record.
    const fresh = await repos.tenant.instructor.insert(ctx, {
      name: "Fresh", email: "fresh@alpha.test", employmentType: "employed", status: "active",
    });
    await clockIn(repos, ctx, fresh.id, sessionId, NINE_AM);
    await clockOut(repos, ctx, fresh.id, NINE_AM + 90 * 60 * 1000); // 1.5h
    const recs = await repos.tenant.hoursRecord.list(ctx);
    const created = recs.find((r) => r.instructorId === fresh.id && r.courseSessionId === sessionId);
    expect(created).toBeTruthy();
    expect(created!.actualMinutes).toBe(90);
    expect(created!.scheduledMinutes).toBe(180); // taken from the session (09:00–12:00)
  });

  it("attendance board counts on-water vs done for the day", async () => {
    await clockIn(repos, ctx, instructorId, sessionId, NINE_AM);
    let board = await getAttendanceBoard(repos, ctx, DAY, NINE_AM + 30 * 60 * 1000);
    // Exactly one open entry (the seeded fixture entry is already closed).
    expect(board.onWater).toBe(1);
    expect(board.rows.some((r) => r.instructorId === instructorId && r.status === "on-water")).toBe(true);

    await clockOut(repos, ctx, instructorId, NINE_AM + 60 * 60 * 1000);
    board = await getAttendanceBoard(repos, ctx, DAY, NINE_AM + 90 * 60 * 1000);
    expect(board.onWater).toBe(0);
    expect(board.rows.every((r) => r.status === "done")).toBe(true);
  });
});
