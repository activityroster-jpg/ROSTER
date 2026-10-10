import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { auditLog as auditLogTable } from "@/lib/db/schema";
import { LEGACY_TRACKER, MAX_CUSTOM_STEPS, cleanCustomSteps, recommendedTracker, trackerSteps } from "@/lib/domain/onboarding-tracker";
import { cleanTrackerConfig, parseTrackerConfig } from "@/lib/validation/onboarding-tracker";
import { saveTracker, trackerFor, trackerOffer } from "@/lib/services/onboarding-tracker";
import { toggleOnboarding } from "@/lib/services/hr";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

describe("onboarding tracker: the rules", () => {
  it("recommends the seven steps that tick themselves, pay only with pay & payroll", () => {
    expect(recommendedTracker(true).steps).toEqual(["app", "licences", "courses", "pay", "first-aid", "vetting", "availability"]);
    expect(recommendedTracker(false).steps).not.toContain("pay");
    expect(recommendedTracker(true).custom).toEqual([]);
  });

  it("a centre that never chose keeps the original six-step checklist, all ticked by hand", () => {
    expect(parseTrackerConfig("")).toEqual(LEGACY_TRACKER);
    expect(parseTrackerConfig("not json")).toEqual(LEGACY_TRACKER);
    const steps = trackerSteps(LEGACY_TRACKER, false);
    expect(steps.map((s) => s.label).sort()).toEqual(["Added to payroll", "Contract signed", "First Aid confirmed", "Induction & site tour", "Kit issued", "Safeguarding training"]);
    expect(steps.every((s) => !s.auto)).toBe(true);
  });

  it("validates what the wizard or Settings sends", () => {
    expect(cleanTrackerConfig({ on: true, steps: ["app", "made-up"], custom: [] }).ok).toBe(false);
    expect(cleanTrackerConfig({ on: "yes", steps: [], custom: [] }).ok).toBe(false);
    const r = cleanTrackerConfig({ on: true, steps: ["app", "app", "kit"], custom: ["  Boat   check ", "boat check", "Kit issued", ""] });
    expect(r.ok && r.config).toEqual({ on: true, steps: ["app", "kit"], custom: ["Boat check"] });
    expect(cleanCustomSteps(Array.from({ length: 20 }, (_, i) => `Step ${i}`))).toHaveLength(MAX_CUSTOM_STEPS);
  });

  it("hides the pay step when pay & payroll is off, and everything when the tracker is off", () => {
    const cfg = recommendedTracker(true);
    expect(trackerSteps(cfg, false).map((s) => s.key)).not.toContain("pay");
    expect(trackerSteps(cfg, true).map((s) => s.key)).toContain("pay");
    expect(trackerSteps({ ...cfg, on: false }, true)).toEqual([]);
  });
});

describe("onboarding tracker: one instructor", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let personId: string;

  beforeEach(async () => {
    const { db } = createTestDb();
    ({ repos, ctx } = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" }));
    personId = (await repos.tenant.instructor.insert(ctx, { name: "New Starter", email: "new@alpha.test", employmentType: "employed", status: "active" })).id;
  });

  it("without a choice: the original checklist, made once per person", async () => {
    const first = await trackerFor(repos, ctx, personId);
    expect(first.on).toBe(true);
    expect(first.items.map((i) => i.label)).toEqual(["Contract signed", "Induction & site tour", "Safeguarding training", "Kit issued", "Added to payroll", "First Aid confirmed"]);
    expect(first.items.every((i) => !i.auto && i.rowId)).toBe(true);
    await trackerFor(repos, ctx, personId);
    expect((await repos.tenant.onboardingItem.list(ctx)).filter((r) => r.instructorId === personId)).toHaveLength(6);
    // Setup offers the recommended steps until the centre chooses.
    expect((await trackerOffer(repos, ctx)).steps).toContain("availability");
  });

  it("automatic steps follow the person's record", async () => {
    const settings = (await repos.tenant.orgSettings.list(ctx))[0]!;
    await repos.tenant.orgSettings.update(ctx, settings.id, { enabledFeatures: JSON.stringify(["payroll"]) });
    expect(await saveTracker(repos, ctx, recommendedTracker(true))).toBe(true);

    const before = await trackerFor(repos, ctx, personId);
    expect(before.items.map((i) => i.key)).toEqual(["app", "licences", "courses", "pay", "first-aid", "vetting", "availability"]);
    expect(before.done).toBe(0);

    const t = repos.tenant;
    const user = await repos.control.createUser({ name: "New Starter", email: "new@alpha.test" });
    await t.instructor.update(ctx, personId, { userId: user.id });
    const grade = (await t.qualificationType.list(ctx))[0]!;
    await t.qualification.insert(ctx, { instructorId: personId, qualificationTypeId: grade.id });
    const courseType = (await t.courseType.list(ctx))[0]!;
    await t.instructorCourseType.insert(ctx, { instructorId: personId, courseTypeId: courseType.id });
    await t.payRate.insert(ctx, { instructorId: null, roleTypeId: null, rate: 15, unit: "hour" }); // the centre's standard rate covers them
    const types = await t.complianceType.list(ctx);
    await t.complianceItem.insert(ctx, { instructorId: personId, complianceTypeId: types.find((x) => x.code === "FIRST_AID")!.id, expiryDate: "2030-01-01" });
    await t.complianceItem.insert(ctx, { instructorId: personId, complianceTypeId: types.find((x) => x.isVetting)!.id });
    // Office-entered availability doesn't count; their own does.
    await t.availability.insert(ctx, { instructorId: personId, date: "2026-07-13", slot: "AM", status: "available", setBy: "office" });
    expect((await trackerFor(repos, ctx, personId)).items.find((i) => i.key === "availability")!.done).toBe(false);
    await t.availability.insert(ctx, { instructorId: personId, date: "2026-07-14", slot: "AM", status: "available", setBy: "self" });

    const after = await trackerFor(repos, ctx, personId);
    expect(after.items.filter((i) => !i.done).map((i) => i.key)).toEqual([]);
    expect(after.done).toBe(after.total);
  });

  it("a manual tick is kept when the step is taken out and comes back when it returns", async () => {
    await saveTracker(repos, ctx, { on: true, steps: ["contract"], custom: ["Boat handling check"] });
    const one = await trackerFor(repos, ctx, personId);
    expect(one.items.map((i) => i.label)).toEqual(["Contract signed", "Boat handling check"]);
    await toggleOnboarding(repos, ctx, one.items[0]!.rowId!, true);

    await saveTracker(repos, ctx, { on: true, steps: [], custom: ["Boat handling check"] });
    expect((await trackerFor(repos, ctx, personId)).items.map((i) => i.label)).toEqual(["Boat handling check"]);

    await saveTracker(repos, ctx, { on: true, steps: ["contract"], custom: ["Boat handling check"] });
    const back = await trackerFor(repos, ctx, personId);
    expect(back.items.find((i) => i.key === "contract")!.done).toBe(true);
  });

  it("switched off: nothing to show, and the choice is in the change log", async () => {
    await saveTracker(repos, ctx, { on: false, steps: [], custom: [] });
    const off = await trackerFor(repos, ctx, personId);
    expect(off).toEqual({ on: false, items: [], done: 0, total: 0 });
    const logs = await repos.tenant.auditLog.list(ctx, eq(auditLogTable.action, "set_onboarding_tracker"));
    expect(logs).toHaveLength(1);
  });
});
