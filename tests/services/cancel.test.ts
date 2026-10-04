import { beforeEach, describe, expect, it, vi } from "vitest";

const sent: { to: string; subject: string }[] = [];
vi.mock("@/lib/mail", () => ({
  sendEmail: vi.fn(async (m: { to: string; subject: string }) => { sent.push({ to: m.to, subject: m.subject }); }),
  escapeHtml: (s: unknown) => String(s ?? ""),
  renderEmail: (s: string) => s,
}));
vi.mock("@/lib/push/fcm", () => ({ sendPush: vi.fn(async () => ({ sent: 0 })) }));

import { eq } from "drizzle-orm";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { canDeleteCourse, cancelSessions, restoreSessions } from "@/lib/services/cancel";
import { getWeekRota } from "@/lib/services/schedule";
import { getPayrollLines } from "@/lib/services/finance";
import { purgeOrphanHours, syncHoursForCourse } from "@/lib/services/hours";
import { courseSession as courseSessionTable, hoursRecord as hoursRecordTable } from "@/lib/db/schema";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

describe("cancelling sessions and courses", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let courseId: string;
  let sessionId: string;
  let instructorId: string;

  beforeEach(async () => {
    sent.length = 0;
    const { db } = createTestDb();
    const seeded = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    repos = seeded.repos;
    ctx = seeded.ctx;
    const a = (await repos.tenant.courseStaff.list(ctx))[0]!;
    courseId = a.courseId;
    instructorId = a.instructorId;
    sessionId = (await repos.tenant.courseSession.list(ctx, eq(courseSessionTable.courseId, courseId)))[0]!.id;
  });

  it("a cancelled day leaves the roster, keeps its row, tells the people on it and cancels the course when it was the last day", async () => {
    expect((await getWeekRota(repos, ctx, "2026-01-05")).flatMap((d) => d.sessions)).toHaveLength(1);
    const r = await cancelSessions(repos, ctx, { courseId, sessionIds: [sessionId], reason: "Gale warning", pay: { rule: "rostered" } });
    expect(r).toEqual({ cancelled: 1, courseCancelled: true, notified: 1 });
    expect((await getWeekRota(repos, ctx, "2026-01-05")).flatMap((d) => d.sessions)).toHaveLength(0);
    const s = (await repos.tenant.courseSession.findById(ctx, sessionId))!;
    expect(s.cancelledAt).toBeTruthy();
    expect(s.cancelReason).toBe("Gale warning");
    expect((await repos.tenant.course.findById(ctx, courseId))!.status).toBe("cancelled");
    const notes = await repos.tenant.notification.list(ctx);
    expect(notes.some((n) => n.instructorId === instructorId && /cancelled/.test(n.title))).toBe(true);
    // "Pay as rostered": the line stays, pinned to the rostered minutes.
    const line = (await repos.tenant.hoursRecord.list(ctx, eq(hoursRecordTable.courseSessionId, sessionId)))[0]!;
    expect(line.overrideMinutes).toBe(180);
    expect(line.note).toMatch(/paid as rostered/);
    // A sync afterwards does not resurrect or remove it.
    await syncHoursForCourse(repos, ctx, courseId);
    expect(await repos.tenant.hoursRecord.list(ctx, eq(hoursRecordTable.courseSessionId, sessionId))).toHaveLength(1);
  });

  it("'don't pay' removes untouched lines, sets clocked ones to zero, and never changes an approved line silently", async () => {
    // The seeded line has actual minutes (clocked), so it is kept at zero pay with a note.
    await cancelSessions(repos, ctx, { courseId, reason: "", pay: { rule: "none" } });
    const line = (await repos.tenant.hoursRecord.list(ctx, eq(hoursRecordTable.courseSessionId, sessionId)))[0]!;
    expect(line.overridePay).toBe(0);
    expect(line.note).toMatch(/not paid/);
    const { lines } = await getPayrollLines(repos, ctx);
    expect(lines.find((l) => l.recordId === line.id)?.pay).toBe(0);
  });

  it("a cancellation fee pays the fee instead of the hours", async () => {
    await cancelSessions(repos, ctx, { courseId, reason: "No bookings", pay: { rule: "fee", fee: 30 } });
    const { lines } = await getPayrollLines(repos, ctx);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.pay).toBe(30);
  });

  it("restore brings the day back, clears the cancellation overrides and the course status", async () => {
    await cancelSessions(repos, ctx, { courseId, reason: "Gale", pay: { rule: "rostered" } });
    const r = await restoreSessions(repos, ctx, courseId, [sessionId]);
    expect(r.restored).toBe(1);
    expect((await repos.tenant.courseSession.findById(ctx, sessionId))!.cancelledAt).toBeNull();
    expect((await repos.tenant.course.findById(ctx, courseId))!.status).toBe("scheduled");
    const line = (await repos.tenant.hoursRecord.list(ctx, eq(hoursRecordTable.courseSessionId, sessionId)))[0]!;
    expect(line.overrideMinutes).toBeNull();
    expect(line.note ?? "").not.toMatch(/cancelled/);
    expect((await getWeekRota(repos, ctx, "2026-01-05")).flatMap((d) => d.sessions)).toHaveLength(1);
  });

  it("delete is refused once people are rostered; a fresh draft can go", async () => {
    expect((await canDeleteCourse(repos, ctx, courseId)).ok).toBe(false);
    const ct = (await repos.tenant.courseType.list(ctx))[0]!;
    const draft = await repos.tenant.course.insert(ctx, { courseTypeId: ct.id, name: "Draft", capacity: 6, ratio: 6, status: "draft" });
    expect((await canDeleteCourse(repos, ctx, draft.id)).ok).toBe(true);
  });

  it("purgeOrphanHours removes leftover lines whose session is gone, but keeps approved, edited or clocked ones", async () => {
    await repos.tenant.hoursRecord.insert(ctx, { instructorId, courseSessionId: null, scheduledMinutes: 120, rate: 25, approved: false });
    await repos.tenant.hoursRecord.insert(ctx, { instructorId, courseSessionId: null, scheduledMinutes: 120, rate: 25, approved: true });
    const before = await repos.tenant.hoursRecord.list(ctx);
    expect(before).toHaveLength(3);
    // The payroll page never shows the untouched orphan even before the purge.
    expect((await getPayrollLines(repos, ctx)).lines.filter((l) => l.courseName === "Other")).toHaveLength(1);
    expect(await purgeOrphanHours(repos, ctx)).toBe(1);
    expect(await repos.tenant.hoursRecord.list(ctx)).toHaveLength(2);
  });
});
