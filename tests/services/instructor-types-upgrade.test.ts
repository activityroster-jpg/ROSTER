import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/tests/helpers/test-db";
import { createRepositories, type Repositories } from "@/lib/db/repositories";
import { fillCourseMap, upgradeInstructorTypes } from "@/lib/services/instructor-types-upgrade";
import { setCourseTeachers } from "@/lib/services/instructor-types";
import { addDays } from "@/lib/services/schedule";
import { courseRoleRequirement, courseStaff, qualificationCourseType } from "@/lib/db/schema";
import type { SystemTenantContext } from "@/lib/tenant/context";

/**
 * An RYA centre set up before 13 Oct 2026: generic Instructor / Senior /
 * Assistant / Safety Boat Driver places, the old type names and ratios, no
 * course map, and courses already staffed.
 */
async function legacyCentre() {
  const { db } = createTestDb();
  const repos = createRepositories(db);
  const org = await repos.control.createOrganisation({ name: "Old Pier", slug: "oldpier", jurisdiction: "england", activityType: "rya_centre", plan: "rostering", status: "active", subscriptionStatus: "active" });
  const ctx: SystemTenantContext = { organisationId: org.id, slug: org.slug, system: true, reason: "test" };
  const t = repos.tenant;
  await t.orgSettings.insert(ctx, { schedulingMode: "session", alertLeadDays: 30, teachingMapVersion: 0 });
  await t.sessionSlot.insertMany(ctx, [{ code: "AM", label: "Morning", startTime: "09:00", endTime: "12:30", sortOrder: 0, active: true }]);
  const type = (name: string, code: string, rank: number, discipline: string | null) => t.qualificationType.insert(ctx, { name, code, rank, discipline, expiryTracked: false, defaultValidMonths: null, active: true });
  const dai = await type("Dinghy Assistant Instructor", "DAI", 10, "dinghy");
  await type("Dinghy Instructor", "DI", 20, "dinghy");
  const dsi = await type("Dinghy Senior Instructor", "DSI", 30, "dinghy");
  await type("Advanced Dinghy Instructor", "ADI", 40, "dinghy");
  const pbi = await type("Powerboat Instructor", "PBI", 20, "powerboat");
  await type("Safety Boat Certificate", "SBC", 15, "powerboat");
  const role = (name: string, code: string, counts: boolean, safety = false) => t.roleType.insert(ctx, { name, code, countsTowardRatio: counts, isSafetyCover: safety, isFirstAider: false, active: true });
  const instructor = await role("Instructor", "INSTRUCTOR", true);
  const senior = await role("Senior Instructor", "SENIOR", true);
  const assistant = await role("Assistant Instructor", "ASSISTANT", true);
  const driver = await role("Safety Boat Driver", "SAFETY_BOAT", false, true);
  await role("Volunteer", "VOLUNTEER", false);
  const ct = (name: string, scheme: string | null, cap: number, ratio: number, safety: boolean) => t.courseType.insert(ctx, { name, scheme, audience: "all", defaultCapacity: cap, studentsPerInstructor: ratio, requiresSafetyBoat: safety, active: true, listed: true });
  const youth1 = await ct("Youth Stage 1", "RYA Youth Sailing", 8, 4, true);
  await ct("Powerboat Level 1", "RYA Powerboat", 3, 3, false);
  const clubNight = await ct("Club Night", null, 10, 5, false);
  const person = (name: string) => t.instructor.insert(ctx, { name, email: null, phone: null, employmentType: "employed", status: "active" });
  const [sam, ann, pat] = await Promise.all([person("Sam"), person("Ann"), person("Pat")]);
  await t.qualification.insertMany(ctx, [
    { instructorId: sam.id, qualificationTypeId: dsi.id, certNo: null, issueDate: null, expiryDate: null, verified: false },
    { instructorId: ann.id, qualificationTypeId: dai.id, certNo: null, issueDate: null, expiryDate: null, verified: false },
    { instructorId: pat.id, qualificationTypeId: pbi.id, certNo: null, issueDate: null, expiryDate: null, verified: false },
  ]);
  const today = "2026-10-13";
  const course = async (courseTypeId: string, date: string, ratio: number) => {
    const c = await t.course.insert(ctx, { courseTypeId, name: null, status: "scheduled", capacity: 8, ratio, staffRequired: null });
    await t.courseSession.insert(ctx, { courseId: c.id, date, slot: "AM", startAt: new Date(`${date}T09:00:00Z`), endAt: new Date(`${date}T12:00:00Z`) });
    return c;
  };
  const upcoming = await course(youth1.id, addDays(today, 3), 4);
  const past = await course(youth1.id, addDays(today, -10), 4);
  const own = await course(clubNight.id, addDays(today, 5), 5);
  await t.courseRoleRequirement.insertMany(ctx, [
    { courseId: upcoming.id, roleTypeId: instructor.id, count: 1 },
    { courseId: upcoming.id, roleTypeId: assistant.id, count: 1 },
    { courseId: upcoming.id, roleTypeId: driver.id, count: 1 },
    { courseId: own.id, roleTypeId: instructor.id, count: 1 },
  ]);
  await t.courseStaff.insertMany(ctx, [
    { courseId: upcoming.id, instructorId: sam.id, roleTypeId: senior.id, status: "assigned" },
    { courseId: upcoming.id, instructorId: ann.id, roleTypeId: assistant.id, status: "assigned" },
    { courseId: upcoming.id, instructorId: pat.id, roleTypeId: driver.id, status: "assigned" },
    { courseId: past.id, instructorId: sam.id, roleTypeId: instructor.id, status: "confirmed" },
  ]);
  await t.payRate.insert(ctx, { instructorId: null, roleTypeId: instructor.id, courseTypeId: null, rate: 15, ratePence: 1500, unit: "hour" });
  return { repos, ctx, today, ids: { instructor, senior, assistant, driver, upcoming, past, own, clubNight, youth1, sam, ann, pat } };
}

describe("upgrading an existing RYA centre to instructor types", () => {
  let c: Awaited<ReturnType<typeof legacyCentre>>;
  beforeEach(async () => { c = await legacyCentre(); });
  const run = (dryRun: boolean) => upgradeInstructorTypes(c.repos, c.ctx, { dryRun, today: c.today, activityType: "rya_centre" });
  const placeFor = async (code: string) => {
    const t = c.repos.tenant;
    const type = (await t.qualificationType.list(c.ctx)).find((q) => q.code === code)!;
    return (await t.roleType.list(c.ctx)).find((r) => r.qualificationTypeId === type.id)!;
  };

  it("previews without changing anything", async () => {
    const before = await c.repos.tenant.roleType.list(c.ctx);
    const preview = await run(true);
    expect(preview).toMatchObject({ typesUpdated: expect.any(Number), safetyLinesRemoved: 1, assignmentsConverted: 3, notConverted: 1, complete: false });
    expect(preview.typesAdded).toBeGreaterThan(20);
    expect(await c.repos.tenant.roleType.list(c.ctx)).toEqual(before);
    expect(await c.repos.tenant.qualificationCourseType.list(c.ctx)).toEqual([]);
  });

  it("converts the types, places, ratios and upcoming courses, and leaves past courses alone", async () => {
    const t = c.repos.tenant;
    const r = await run(false);
    expect(r.notConverted).toBe(1); // the centre's own Club Night has no instructor types linked yet
    expect(r.complete).toBe(false);

    const types = await t.qualificationType.list(c.ctx);
    expect(types.find((q) => q.code === "SI")).toMatchObject({ name: "Senior Instructor", rank: 40, supervises: true });
    expect(types.find((q) => q.code === "AI")).toMatchObject({ name: "Assistant Instructor", needsSupervision: true });
    expect(types.find((q) => q.code === "SBC")?.discipline).toBeNull();
    expect(types.filter((q) => q.code === "DSI" || q.code === "DAI")).toEqual([]);

    // Ratio moved off the old default (1:4 → 1:6), safety boat off, the upcoming course too, the past one not.
    expect(await t.courseType.findById(c.ctx, c.ids.youth1.id)).toMatchObject({ studentsPerInstructor: 6, requiresSafetyBoat: false });
    expect((await t.course.findById(c.ctx, c.ids.upcoming.id))?.ratio).toBe(6);
    expect((await t.course.findById(c.ctx, c.ids.past.id))?.ratio).toBe(4);
    expect((await t.qualificationCourseType.list(c.ctx, eq(qualificationCourseType.courseTypeId, c.ids.youth1.id))).length).toBeGreaterThan(3);

    const [di, si, ai] = await Promise.all([placeFor("DI"), placeFor("SI"), placeFor("AI")]);
    const lines = await t.courseRoleRequirement.list(c.ctx, eq(courseRoleRequirement.courseId, c.ids.upcoming.id));
    expect(lines.map((l) => [l.roleTypeId, l.count]).sort()).toEqual([[di.id, 1], [ai.id, 1]].sort()); // the safety boat line went
    const staff = await t.courseStaff.list(c.ctx, eq(courseStaff.courseId, c.ids.upcoming.id));
    const placeOf = (id: string) => staff.find((s) => s.instructorId === id)?.roleTypeId;
    expect(placeOf(c.ids.sam.id)).toBe(si.id);
    expect(placeOf(c.ids.ann.id)).toBe(ai.id);
    expect(placeOf(c.ids.pat.id)).toBe(di.id); // the driver is an instructor now
    expect((await t.courseStaff.list(c.ctx, eq(courseStaff.courseId, c.ids.past.id)))[0]?.roleTypeId).toBe(c.ids.instructor.id);

    // Only the safety boat driver is retired while something upcoming still uses the generic places.
    expect((await t.roleType.findById(c.ctx, c.ids.driver.id))?.active).toBe(false);
    expect((await t.roleType.findById(c.ctx, c.ids.instructor.id))?.active).toBe(true);
    expect((await t.orgSettings.list(c.ctx))[0]?.teachingMapVersion).toBe(0);

    // Link Club Night to Dinghy Instructors and run again: done.
    const diType = types.find((q) => q.code === "DI")!;
    await setCourseTeachers(c.repos, c.ctx, c.ids.clubNight.id, [{ typeId: diType.id, needsApproval: false }]);
    const again = await run(false);
    expect(again).toMatchObject({ notConverted: 0, complete: true, typesAdded: 0, placesAdded: 0, mapRows: 0 });
    expect((await t.roleType.findById(c.ctx, c.ids.instructor.id))?.active).toBe(false);
    expect((await t.orgSettings.list(c.ctx))[0]?.teachingMapVersion).toBe(1);
    // The Instructor rate now also applies in the instructor-type places in use (DI for the courses, PBI held by Pat).
    const rates = await t.payRate.list(c.ctx);
    expect(rates.filter((x) => x.rate === 15).map((x) => x.roleTypeId).sort()).toEqual([c.ids.instructor.id, di.id, (await placeFor("PBI")).id].sort());

    expect((await run(false)).skipped).toBe("Already on instructor types");
  });

  it("leaves a centre that isn't an RYA centre alone", async () => {
    expect((await upgradeInstructorTypes(c.repos, c.ctx, { dryRun: false, today: c.today, activityType: "dive_centre" })).skipped).toBe("Not an RYA centre");
  });

  it("links the RYA list's courses to their instructor types once the types are there", async () => {
    await run(false);
    const t = c.repos.tenant;
    const pb1 = (await t.courseType.list(c.ctx)).find((x) => x.name === "Powerboat Level 1")!;
    await t.qualificationCourseType.list(c.ctx, eq(qualificationCourseType.courseTypeId, pb1.id)).then((rows) => Promise.all(rows.map((row) => t.qualificationCourseType.delete(c.ctx, row.id))));
    expect(await fillCourseMap(c.repos, c.ctx, "rya_centre")).toBe(0); // not finished upgrading yet (Club Night)
    await t.orgSettings.update(c.ctx, (await t.orgSettings.list(c.ctx))[0]!.id, { teachingMapVersion: 1 });
    expect(await fillCourseMap(c.repos, c.ctx, "rya_centre")).toBe(1);
    expect(await fillCourseMap(c.repos, c.ctx, "rya_centre")).toBe(0);
  });
});
