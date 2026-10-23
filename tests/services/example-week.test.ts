import { beforeEach, describe, expect, it } from "vitest";
import { eq, isNull } from "drizzle-orm";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { clearExampleWeek, EXAMPLE_SOURCE, exampleWeekState, loadExampleWeek } from "@/lib/services/example-week";
import { course, courseStaff, hoursRecord, instructor, qualification, rosterDay } from "@/lib/db/schema";
import { packFor } from "@/lib/packs";
import { getSetupStatus } from "@/lib/services/setup";

/**
 * The example week: six made-up people and a week of sessions a new centre can
 * put on the roster to see it working, and take off again with one click,
 * leaving everything it added itself exactly as it was.
 */
describe("example week", () => {
  let a: Awaited<ReturnType<typeof seedFullOrg>>;
  let b: Awaited<ReturnType<typeof seedFullOrg>>;
  const common = packFor("rya_centre").commonCourses ?? [];
  const MON = "2026-07-06";

  beforeEach(async () => {
    const { db } = createTestDb();
    a = await seedFullOrg(db, { name: "Harbour", slug: "harbour", jurisdiction: "england" });
    b = await seedFullOrg(db, { name: "Lakeside", slug: "lakeside", jurisdiction: "england" });
  });

  it("puts six made-up people and a filled week of sessions on the roster, once", async () => {
    const checklist = async () => (await getSetupStatus(a.repos, a.ctx)).steps.map((s) => [s.key, s.done]);
    const setupBefore = await checklist();
    const r = await loadExampleWeek(a.repos, a.ctx, { preferredCourseNames: common, today: MON });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r).toMatchObject({ instructors: 6, courses: 4, sessions: 13, from: MON, to: "2026-07-12" });
    expect(r.filled).toBeGreaterThan(0);
    const state = await exampleWeekState(a.repos, a.ctx);
    expect(state).toMatchObject({ loaded: true, instructors: 6, courses: 4, sessions: 13, from: MON, to: "2026-07-12" });

    const people = await a.repos.tenant.instructor.list(a.ctx, eq(instructor.source, EXAMPLE_SOURCE));
    expect(people.every((p) => p.name.endsWith("(example)") && p.managedBy === "office" && !p.email)).toBe(true);
    // Each person holds an instructor type, so Auto-roster can judge them.
    const quals = await a.repos.tenant.qualification.list(a.ctx);
    for (const p of people) expect(quals.some((q) => q.instructorId === p.id)).toBe(true);
    // The courses come from the common list, and the shifts are on example courses only.
    const courses = await a.repos.tenant.course.list(a.ctx, eq(course.source, EXAMPLE_SOURCE));
    const types = new Map((await a.repos.tenant.courseType.list(a.ctx)).map((t) => [t.id, t.name]));
    expect(courses.map((c) => types.get(c.courseTypeId)).every((n) => common.includes(n!))).toBe(true);
    const shifts = await a.repos.tenant.courseStaff.list(a.ctx);
    const exampleCourseIds = new Set(courses.map((c) => c.id));
    const examplePeople = new Set(people.map((p) => p.id));
    expect(shifts.filter((s) => examplePeople.has(s.instructorId)).every((s) => exampleCourseIds.has(s.courseId))).toBe(true);

    // The Getting started checklist is the centre's own progress: the example doesn't tick anything.
    expect(await checklist()).toEqual(setupBefore);

    // Loading twice is refused rather than doubling up.
    expect((await loadExampleWeek(a.repos, a.ctx, { today: MON })).ok).toBe(false);
    expect((await exampleWeekState(a.repos, a.ctx)).instructors).toBe(6);
    // The other centre saw nothing.
    expect((await exampleWeekState(b.repos, b.ctx)).loaded).toBe(false);
  });

  it("clearing removes exactly the example and leaves the centre's own data", async () => {
    const t = a.repos.tenant;
    const before = {
      people: (await t.instructor.list(a.ctx)).map((p) => p.id).sort(),
      courses: (await t.course.list(a.ctx)).map((c) => c.id).sort(),
      shifts: await t.courseStaff.count(a.ctx),
      quals: await t.qualification.count(a.ctx),
      hours: await t.hoursRecord.count(a.ctx),
      orphanHours: await t.hoursRecord.count(a.ctx, isNull(hoursRecord.courseSessionId)),
    };
    const loaded = await loadExampleWeek(a.repos, a.ctx, { preferredCourseNames: common, today: MON });
    expect(loaded.ok).toBe(true);
    // A day confirmed while only the example was on it, and one with a real session too.
    const own = await t.course.list(a.ctx, isNull(course.source));
    await t.courseSession.insert(a.ctx, { courseId: own[0]!.id, date: "2026-07-07", slot: "AM", startAt: new Date("2026-07-07T09:00:00Z"), endAt: new Date("2026-07-07T12:30:00Z") });
    await t.rosterDay.insert(a.ctx, { date: MON, confirmedAt: new Date(), confirmedByUserId: null, snapshot: null });
    await t.rosterDay.insert(a.ctx, { date: "2026-07-07", confirmedAt: new Date(), confirmedByUserId: null, snapshot: null });

    const r = await clearExampleWeek(a.repos, a.ctx);
    expect(r).toMatchObject({ ok: true, instructors: 6, courses: 4 });
    expect(await exampleWeekState(a.repos, a.ctx)).toMatchObject({ loaded: false, instructors: 0, courses: 0, sessions: 0 });
    expect((await t.instructor.list(a.ctx)).map((p) => p.id).sort()).toEqual(before.people);
    expect((await t.course.list(a.ctx)).map((c) => c.id).sort()).toEqual(before.courses);
    expect(await t.courseStaff.count(a.ctx)).toBe(before.shifts);
    expect(await t.qualification.count(a.ctx, eq(qualification.verified, true))).toBeLessThanOrEqual(before.quals);
    expect(await t.hoursRecord.count(a.ctx)).toBe(before.hours);
    expect(await t.hoursRecord.count(a.ctx, isNull(hoursRecord.courseSessionId))).toBe(before.orphanHours);
    expect(await t.courseStaff.count(a.ctx, eq(courseStaff.status, "assigned"))).toBe(before.shifts);
    // The day with only the example on it is unconfirmed again; the one with a real session keeps its confirmation.
    const days = (await t.rosterDay.list(a.ctx)).map((d) => d.date);
    expect(days).not.toContain(MON);
    expect(days).toContain("2026-07-07");
    expect((await exampleWeekState(b.repos, b.ctx)).loaded).toBe(false);
    // Clearing again says there is nothing to clear.
    expect((await clearExampleWeek(a.repos, a.ctx)).ok).toBe(false);
  });

  it("refuses a centre with no course ticked", async () => {
    const t = a.repos.tenant;
    for (const c of await t.courseType.list(a.ctx)) await t.courseType.update(a.ctx, c.id, { active: false });
    const r = await loadExampleWeek(a.repos, a.ctx, { today: MON });
    expect(r.ok).toBe(false);
    expect((await exampleWeekState(a.repos, a.ctx)).loaded).toBe(false);
  });
});
