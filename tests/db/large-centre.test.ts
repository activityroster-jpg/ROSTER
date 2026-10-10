import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mail", () => ({ sendEmail: vi.fn(async () => {}), escapeHtml: (s: unknown) => String(s ?? ""), renderEmail: (s: string) => s }));
vi.mock("@/lib/push/fcm", () => ({ sendPush: vi.fn(async () => ({ sent: 0 })) }));
vi.mock("@/lib/security/token-crypto", () => ({ openToken: vi.fn(async (v: string | null) => v), sealToken: vi.fn(async (v: string) => v), isSealed: () => false }));

import { eq } from "drizzle-orm";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { addDays, coverageForCourses, getRotaDays, getSessionEvents, getWeekRota, getWeekSchedule } from "@/lib/services/schedule";
import { getBoard } from "@/lib/services/board";
import { findProblems, problemsForInstructor } from "@/lib/services/problems";
import { getCourseAvailabilityStates, getWeekAvailabilityMatrix, loadInstructorAvailability, setAvailabilityBulk } from "@/lib/services/availability";
import { coursePageScope } from "@/lib/services/course-list";
import { listStaffWithFit } from "@/lib/services/staff";
import { getTeachingMatrix } from "@/lib/services/teaching";
import { getAttendanceBoard } from "@/lib/services/timeclock";
import { listLeave } from "@/lib/services/leave";
import { listOpenShifts } from "@/lib/services/openshifts";
import { getSetupStatus } from "@/lib/services/setup";
import { confirmationSummary, publishedWeeks, publishWeek } from "@/lib/services/roster";
import { getPayrollLines, getInstructorHours } from "@/lib/services/finance";
import { getDaySheet } from "@/lib/services/emergency";
import { listOfficeMembers } from "@/lib/services/office-access";
import { ensureOnboarding, getStaffProfile } from "@/lib/services/hr";
import { getCourseResources, equipmentContextForCourse } from "@/lib/services/course-resources";
import { staffBySession, loadOverrides } from "@/lib/services/session-staff";
import { canDeleteCourse, cancelSessions } from "@/lib/services/cancel";
import { assignStaff } from "@/lib/services/assignment";
import { listForInstructor } from "@/lib/services/notifications";
import { instructorReferences } from "@/lib/services/retire";
import { syncHoursForCourse } from "@/lib/services/hours";
import { courseSession as courseSessionTable, courseStaff as courseStaffTable } from "@/lib/db/schema";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

/**
 * A large centre, bigger than any test file a centre has sent us: 200 staff
 * (150 with logins), a ten-week season of 240 sessions a week (five-day
 * camps and one-day courses, 2,400 sessions), two staff on every course,
 * pay lines for every session, and availability filled in for everyone for
 * every day of the season.
 *
 * Each page's loaders run against it. On Cloudflare a statement may bind at
 * most 100 parameters (the test database enforces that) and one request may
 * make at most 1,000 database queries, so each page's query count is checked
 * against a budget well inside that.
 */
const MONDAY = "2026-06-01";
const WEEKS = 10;
const STAFF = 200;
const QUERY_BUDGET = 250;

describe("a large centre: every page loads within Cloudflare's limits", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let queries = 0;
  let instructorIds: string[] = [];
  let courseIds: string[] = [];
  let roleId = "";

  /** Run one page's loaders; returns how many queries they made. */
  const page = async (fn: () => Promise<unknown>): Promise<number> => {
    const before = queries;
    await fn();
    if (process.env.SCALE_REPORT) console.log(`queries: ${queries - before}`); // SCALE_REPORT=1 npx vitest run tests/db/large-centre.test.ts --reporter=verbose
    return queries - before;
  };

  beforeAll(async () => {
    const { db, raw } = createTestDb();
    const prepare = raw.prepare.bind(raw);
    raw.prepare = ((source: string) => { queries++; return prepare(source); }) as typeof raw.prepare;

    const seeded = await seedFullOrg(db, { name: "Large", slug: "large", jurisdiction: "england" });
    repos = seeded.repos; ctx = seeded.ctx;
    const t = repos.tenant;
    const [roles, courseTypes, grades, complianceTypes] = await Promise.all([t.roleType.list(ctx), t.courseType.list(ctx), t.qualificationType.list(ctx), t.complianceType.list(ctx)]);
    roleId = roles.find((r) => r.countsTowardRatio)!.id;
    const settings = (await t.orgSettings.list(ctx))[0]!;
    await t.orgSettings.update(ctx, settings.id, { enforceConflictChecks: true, enforceAvailabilityChecks: true, enforceRatioChecks: true, enforceLicenceChecks: true });

    // People: 200 staff, 150 of them with a login.
    const people = Array.from({ length: STAFF }, (_, i) => ({ name: `Staff ${String(i).padStart(3, "0")}`, email: `staff${i}@large.test`, employmentType: (["employed", "freelance", "volunteer"] as const)[i % 3], status: "active" as const }));
    const instructors = await t.instructor.insertMany(ctx, people);
    instructorIds = instructors.map((i) => i.id);
    for (const [i, ins] of instructors.slice(0, 150).entries()) {
      const user = await repos.control.createUser({ name: ins.name, email: ins.email! });
      await repos.control.createMembership({ userId: user.id, organisationId: ctx.organisationId, role: i < 3 ? "admin" : "instructor" });
      await t.instructor.update(ctx, ins.id, { userId: user.id });
    }
    await t.qualification.insertMany(ctx, instructors.map((ins) => ({ instructorId: ins.id, qualificationTypeId: grades[0]!.id, issueDate: "2024-01-01", expiryDate: null, verified: true })));
    await t.instructorCourseType.insertMany(ctx, instructors.flatMap((ins) => courseTypes.slice(0, 5).map((c) => ({ instructorId: ins.id, courseTypeId: c.id }))));
    await t.complianceItem.insertMany(ctx, instructors.flatMap((ins) => complianceTypes.map((c) => ({ instructorId: ins.id, complianceTypeId: c.id, expiryDate: c.expiryTracked ? "2030-01-01" : null, verified: true }))));
    await t.payRate.insertMany(ctx, instructors.map((ins) => ({ instructorId: ins.id, rate: 15, ratePence: 1500, unit: "hour" as const })));

    // Availability: everyone, every day of the season, both slots.
    const avail = [];
    for (let d = 0; d < WEEKS * 7; d++) {
      const date = addDays(MONDAY, d);
      for (const [n, id] of instructorIds.entries()) for (const slot of ["AM", "PM"] as const) avail.push({ instructorId: id, date, slot, status: (n + d) % 9 === 0 ? ("unavailable" as const) : ("available" as const) });
    }
    await t.availability.insertMany(ctx, avail);

    // The season: each week 20 five-day camps plus 20 one-day courses a day.
    const courses: Parameters<typeof t.course.insertMany>[1] = [];
    const sessions: Parameters<typeof t.courseSession.insertMany>[1] = [];
    const staff: Parameters<typeof t.courseStaff.insertMany>[1] = [];
    const hours: Parameters<typeof t.hoursRecord.insertMany>[1] = [];
    let who = 0;
    const addCourse = (name: string, days: string[], slot: "AM" | "PM") => {
      const courseId = crypto.randomUUID();
      courses.push({ id: courseId, courseTypeId: courseTypes[courses.length % 5]!.id, name, capacity: 8, ratio: 4, status: "scheduled" as const });
      const pair = [instructorIds[who++ % STAFF]!, instructorIds[who++ % STAFF]!];
      for (const instructorId of pair) staff.push({ courseId, instructorId, roleTypeId: roleId, status: "assigned" as const, isOverride: false, overrideNote: null, overriddenBy: null });
      for (const date of days) {
        const id = crypto.randomUUID();
        const h = slot === "AM" ? 9 : 13;
        sessions.push({ id, courseId, date, slot, startAt: new Date(`${date}T${String(h).padStart(2, "0")}:00:00.000Z`), endAt: new Date(`${date}T${String(h + 3).padStart(2, "0")}:00:00.000Z`) });
        for (const instructorId of pair) hours.push({ instructorId, courseSessionId: id, scheduledMinutes: 180, actualMinutes: null, rate: 15, ratePence: 1500, payUnit: "hour" as const, source: "roster" as const, approved: false });
      }
    };
    for (let w = 0; w < WEEKS; w++) {
      const monday = addDays(MONDAY, w * 7);
      for (let c = 0; c < 20; c++) addCourse(`Camp ${w}-${c}`, [0, 1, 2, 3, 4].map((d) => addDays(monday, d)), "AM");
      for (let d = 0; d < 7; d++) for (let c = 0; c < 20; c++) addCourse(`Day ${w}-${d}-${c}`, [addDays(monday, d)], "PM");
    }
    courseIds = courses.map((c) => c.id!);
    await t.course.insertMany(ctx, courses);
    await t.courseSession.insertMany(ctx, sessions);
    await t.courseStaff.insertMany(ctx, staff);
    await t.hoursRecord.insertMany(ctx, hours);
    await t.leaveRequest.insertMany(ctx, instructorIds.slice(0, 40).map((instructorId, i) => ({ instructorId, type: "annual" as const, startDate: addDays(MONDAY, i), endDate: addDays(MONDAY, i + 2), days: 3, status: (i % 2 ? "approved" : "pending") as "approved" | "pending" })));
    expect(await t.courseSession.count(ctx)).toBeGreaterThanOrEqual(2400);
  }, 300_000);

  const week = () => addDays(MONDAY, 21);
  const today = () => addDays(MONDAY, 23);

  it("Dashboard", async () => {
    const n = await page(async () => {
      await Promise.all([
        listStaffWithFit(repos, ctx), getWeekSchedule(repos, ctx, week()), getAttendanceBoard(repos, ctx, today()), listLeave(repos, ctx),
        listOpenShifts(repos, ctx, true), getSetupStatus(repos, ctx), getWeekRota(repos, ctx, week()), getSessionEvents(repos, ctx, addDays(week(), -7), addDays(week(), 7 * 12)),
        listOfficeMembers(repos, ctx),
      ]);
      await Promise.all([confirmationSummary(repos, ctx, today()), findProblems(repos, ctx, { from: today(), to: addDays(today(), 28) })]);
      await coverageForCourses(repos, ctx, (await coursePageScope(repos, ctx, { view: "upcoming", today: today() })).ids);
    });
    expect(n).toBeLessThan(QUERY_BUDGET);
  });

  it("Roster: board, print view and problems", async () => {
    const n = await page(async () => {
      const board = await getBoard(repos, ctx, week());
      expect(board.days.flatMap((d) => d.sessions).length).toBe(240);
      await Promise.all([getWeekRota(repos, ctx, week()), publishedWeeks(repos, ctx), findProblems(repos, ctx, { from: week(), to: addDays(week(), 7) })]);
    });
    expect(n).toBeLessThan(QUERY_BUDGET);
  });

  it("Emergency sheet", async () => {
    const n = await page(async () => { await getDaySheet(repos, ctx, today()); await listOfficeMembers(repos, ctx); });
    expect(n).toBeLessThan(QUERY_BUDGET);
  });

  it("Availability", async () => {
    const n = await page(async () => {
      const m = await getWeekAvailabilityMatrix(repos, ctx, week());
      expect(m.rows.length).toBe(STAFF + 1);
    });
    expect(n).toBeLessThan(QUERY_BUDGET);
  });

  it("Courses", async () => {
    const n = await page(async () => {
      const scope = await coursePageScope(repos, ctx, { view: "upcoming", today: today() });
      await coverageForCourses(repos, ctx, scope.ids);
      const sessions = await repos.tenant.courseSession.listIn(ctx, courseSessionTable.courseId, scope.ids);
      await getCourseAvailabilityStates(repos, ctx, sessions);
    });
    expect(n).toBeLessThan(QUERY_BUDGET);
  });

  it("A course's own page", async () => {
    const id = courseIds[300]!;
    const n = await page(async () => {
      const [sessions, assignments] = await Promise.all([
        repos.tenant.courseSession.list(ctx, eq(courseSessionTable.courseId, id)),
        repos.tenant.courseStaff.list(ctx, eq(courseStaffTable.courseId, id)),
        listStaffWithFit(repos, ctx), getCourseResources(repos, ctx, id), getTeachingMatrix(repos, ctx),
      ]);
      await staffBySession(repos, ctx, sessions, assignments);
      await Promise.all([equipmentContextForCourse(repos, ctx, id), getCourseAvailabilityStates(repos, ctx), canDeleteCourse(repos, ctx, id)]);
    });
    expect(n).toBeLessThan(QUERY_BUDGET);
  });

  it("Staff list", async () => {
    const n = await page(async () => {
      const staff = await listStaffWithFit(repos, ctx);
      expect(staff.length).toBe(STAFF + 1);
      await getTeachingMatrix(repos, ctx);
      await Promise.all([repos.control.membershipStatusByUser(ctx.organisationId), repos.control.inviteSentByUser(ctx.organisationId), repos.control.inviteQueuedUsers(ctx.organisationId), listOfficeMembers(repos, ctx)]);
    });
    expect(n).toBeLessThan(QUERY_BUDGET);
  });

  it("A staff member's page", async () => {
    const id = instructorIds[7]!;
    const n = await page(async () => {
      await ensureOnboarding(repos, ctx, id);
      await getStaffProfile(repos, ctx, id);
      await instructorReferences(repos, ctx, id);
    });
    expect(n).toBeLessThan(QUERY_BUDGET);
  });

  it("Payroll for a month", async () => {
    const n = await page(async () => {
      const { lines } = await getPayrollLines(repos, ctx, { from: MONDAY, to: addDays(MONDAY, 30) });
      expect(lines.length).toBeGreaterThan(1000);
    });
    expect(n).toBeLessThan(QUERY_BUDGET);
  });

  it("Last sign-in for everyone with a login", async () => {
    const n = await page(async () => {
      const userIds = [...(await repos.control.membershipStatusByUser(ctx.organisationId)).keys()];
      expect(userIds.length).toBeGreaterThan(100);
      await repos.control.sessionSummaries(userIds);
    });
    expect(n).toBeLessThan(QUERY_BUDGET);
  });

  it("Instructor app: home, availability, hours, notifications", async () => {
    const me = instructorIds[11]!;
    const n = await page(async () => {
      const events = await getSessionEvents(repos, ctx, today(), addDays(today(), 28));
      await loadOverrides(repos, ctx, events.map((e) => e.id));
      await problemsForInstructor(repos, ctx, me, { from: today(), to: addDays(today(), 28) });
      await loadInstructorAvailability(repos, ctx, me);
      await getInstructorHours(repos, ctx, me);
      await listForInstructor(repos, ctx, me);
      await getRotaDays(repos, ctx, today(), 28);
    });
    expect(n).toBeLessThan(QUERY_BUDGET);
  });

  it("Assigning someone to a camp", async () => {
    const n = await page(async () => {
      const r = await assignStaff(repos, ctx, { courseId: courseIds[25]!, instructorId: instructorIds[199]!, roleTypeId: roleId, override: true, overrideNote: "Scale test" });
      expect(r.ok).toBe(true);
    });
    expect(n).toBeLessThan(QUERY_BUDGET);
  });

  it("Publishing a busy week tells everyone on it", async () => {
    const n = await page(async () => {
      const r = await publishWeek(repos, ctx, week(), { notify: true });
      expect(r).toBeTruthy();
    });
    expect(n).toBeLessThan(QUERY_BUDGET);
  });

  it("Cancelling a camp and resyncing its pay lines", async () => {
    const n = await page(async () => {
      await cancelSessions(repos, ctx, { courseId: courseIds[40]!, reason: "Weather", pay: { rule: "none" } });
      await syncHoursForCourse(repos, ctx, courseIds[41]!);
    });
    expect(n).toBeLessThan(QUERY_BUDGET);
  });

  it("The office marks everyone busy for a whole week in one go", async () => {
    const days = [0, 1, 2, 3, 4, 5, 6].map((d) => addDays(week(), d));
    const entries = instructorIds.flatMap((instructorId) => days.flatMap((date) => (["AM", "PM", "EV"] as const).map((slot) => ({ instructorId, date, slot, status: "unavailable" as const }))));
    const n = await page(async () => {
      const r = await setAvailabilityBulk(repos, ctx, entries);
      expect(r.set + r.keptLeave).toBe(entries.length);
    });
    expect(n).toBeLessThan(20);
  });
});
