import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mail", () => ({ sendEmail: vi.fn(async () => {}), queueEmails: vi.fn(async () => ({ queued: 0 })), escapeHtml: (s: unknown) => String(s ?? ""), renderEmail: (s: string) => s }));
vi.mock("@/lib/push/fcm", () => ({ sendPush: vi.fn(async () => ({ sent: 0, dead: [] })) }));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { createCourseWithSessions } from "@/lib/services/courses";
import { getWeekAvailabilityMatrix } from "@/lib/services/availability";
import { assignStaff } from "@/lib/services/assignment";
import { addDays, weekStart } from "@/lib/services/schedule";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

/** The availability grid shows the hours each person is rostered that week, beside their name. */
describe("hours rostered this week", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;

  beforeEach(async () => {
    ({ repos, ctx } = await seedFullOrg(createTestDb().db, { name: "Hours", slug: "hours-week", jurisdiction: "england" }));
  });

  it("adds up their sessions that week; declined ones don't count", async () => {
    const monday = addDays(weekStart(new Date()), 7);
    const roleTypeId = (await repos.tenant.roleType.list(ctx)).find((r) => r.countsTowardRatio)!.id;
    const courseTypeId = (await repos.tenant.courseType.list(ctx))[0]!.id;
    const amy = await repos.tenant.instructor.insert(ctx, { name: "Amy", email: null, employmentType: "freelance", status: "active", managedBy: "office" });
    const { courseId } = await createCourseWithSessions(repos, ctx, { courseTypeId, sessions: [
      { date: monday, slot: "AM", startTime: "09:00", endTime: "12:30" },
      { date: addDays(monday, 1), slot: "PM", startTime: "13:00", endTime: "16:00" },
    ] });
    const { courseId: other } = await createCourseWithSessions(repos, ctx, { courseTypeId, sessions: [{ date: addDays(monday, 2), slot: "AM", startTime: "09:00", endTime: "17:00" }] });
    expect((await assignStaff(repos, ctx, { courseId, instructorId: amy.id, roleTypeId, override: true })).ok).toBe(true);
    const r = await assignStaff(repos, ctx, { courseId: other, instructorId: amy.id, roleTypeId, override: true });
    expect(r.ok).toBe(true);
    if (r.ok) await repos.tenant.courseStaff.update(ctx, r.courseStaffId, { status: "declined" });

    const matrix = await getWeekAvailabilityMatrix(repos, ctx, monday);
    const row = matrix.rows.find((x) => x.instructorId === amy.id)!;
    expect(row.assignedMinutes).toBe(210 + 180); // 3h30 + 3h; the declined 8h day doesn't count
  });
});
