import { and, eq, isNull, or } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import {
  availability as availabilityTable,
  complianceItem as complianceItemTable,
  instructorCourseType as instructorCourseTypeTable,
  onboardingItem as onboardingTable,
  payRate as payRateTable,
  qualification as qualificationTable,
  type OnboardingItem,
} from "@/lib/db/schema";
import { autoStepDone, isFirstAidType, manualLabels, recommendedTracker, trackerSteps, type TrackerConfig, type TrackerFacts } from "@/lib/domain/onboarding-tracker";
import { parseTrackerConfig } from "@/lib/validation/onboarding-tracker";
import { hasFeature } from "@/lib/features";
import { writeAudit } from "./audit";

/** The centre's tracker and whether it uses pay & payroll (the pay step depends on it). */
export async function loadTracker(repos: Repositories, ctx: AnyTenantContext): Promise<{ config: TrackerConfig; payOn: boolean; chosen: boolean }> {
  const s = (await repos.tenant.orgSettings.list(ctx))[0];
  return { config: parseTrackerConfig(s?.onboardingTracker), payOn: hasFeature(s?.enabledFeatures, "payroll"), chosen: Boolean(s?.onboardingTracker) };
}

/**
 * What setup offers: the centre's choice if it made one, else the recommended
 * steps. The pay step is included either way; it only shows once pay & payroll
 * is switched on, which setup's first step may do.
 */
export async function trackerOffer(repos: Repositories, ctx: AnyTenantContext): Promise<TrackerConfig> {
  const t = await loadTracker(repos, ctx);
  return t.chosen ? t.config : recommendedTracker(true);
}

/** Save the centre's choice (already validated). Audited as a settings change. */
export async function saveTracker(repos: Repositories, ctx: AnyTenantContext, config: TrackerConfig): Promise<boolean> {
  const s = (await repos.tenant.orgSettings.list(ctx))[0];
  if (!s) return false;
  const before = parseTrackerConfig(s.onboardingTracker);
  await repos.tenant.orgSettings.update(ctx, s.id, { onboardingTracker: JSON.stringify(config) });
  await writeAudit(repos, ctx, { action: "set_onboarding_tracker", entity: "org_settings", entityId: s.id, before, after: config });
  return true;
}

/**
 * Make sure this person has a row for each manual step the centre follows.
 * Rows for steps the centre no longer follows are kept (and hidden), so an old
 * tick comes back if the step is switched on again.
 */
export async function ensureManualRows(repos: Repositories, ctx: AnyTenantContext, instructorId: string, labels: readonly string[]): Promise<OnboardingItem[]> {
  const existing = await repos.tenant.onboardingItem.list(ctx, eq(onboardingTable.instructorId, instructorId));
  const have = new Set(existing.map((r) => r.label.toLowerCase()));
  const missing = labels.filter((l) => !have.has(l.toLowerCase()));
  if (!missing.length) return existing;
  const start = existing.reduce((m, r) => Math.max(m, r.sortOrder + 1), 0);
  const created = await repos.tenant.onboardingItem.insertMany(ctx, missing.map((label, i) => ({ instructorId, label, done: false, sortOrder: start + i, completedAt: null })));
  return [...existing, ...created];
}

/** What the record says about one person, for the steps that tick themselves. */
export async function trackerFacts(repos: Repositories, ctx: AnyTenantContext, instructorId: string): Promise<TrackerFacts> {
  const t = repos.tenant;
  const [person, licences, courses, ownOrCentreRates, items, types, availabilitySet] = await Promise.all([
    t.instructor.findById(ctx, instructorId),
    t.qualification.count(ctx, eq(qualificationTable.instructorId, instructorId)),
    t.instructorCourseType.count(ctx, eq(instructorCourseTypeTable.instructorId, instructorId)),
    t.payRate.count(ctx, or(eq(payRateTable.instructorId, instructorId), isNull(payRateTable.instructorId))),
    t.complianceItem.list(ctx, eq(complianceItemTable.instructorId, instructorId)),
    t.complianceType.list(ctx),
    t.availability.count(ctx, and(eq(availabilityTable.instructorId, instructorId), eq(availabilityTable.setBy, "self"))),
  ]);
  const typeById = new Map(types.map((ct) => [ct.id, ct]));
  const heldTypes = items.map((it) => typeById.get(it.complianceTypeId)).filter((ct): ct is NonNullable<typeof ct> => Boolean(ct));
  return {
    linked: Boolean(person?.userId),
    licences,
    courses,
    payRate: ownOrCentreRates > 0,
    firstAid: heldTypes.some((ct) => isFirstAidType(ct)),
    vetting: heldTypes.some((ct) => Boolean(ct.isVetting)),
    availabilitySet: availabilitySet > 0,
  };
}

export interface TrackerItem {
  key: string;
  label: string;
  auto: boolean;
  done: boolean;
  hint: string;
  /** The onboarding_item row behind a manual step (what the tick saves to). */
  rowId?: string;
}

export interface PersonTracker { on: boolean; items: TrackerItem[]; done: number; total: number }

/**
 * One instructor's tracker, ready to show: the automatic steps first (from
 * their record), then the manual ones in the order their rows were made, so a
 * centre that never chose sees its original checklist in its original order.
 */
export async function trackerFor(repos: Repositories, ctx: AnyTenantContext, instructorId: string): Promise<PersonTracker> {
  const { config, payOn } = await loadTracker(repos, ctx);
  const steps = trackerSteps(config, payOn);
  if (!config.on || steps.length === 0) return { on: config.on, items: [], done: 0, total: 0 };
  const [rows, facts] = await Promise.all([
    ensureManualRows(repos, ctx, instructorId, manualLabels(config, payOn)),
    steps.some((s) => s.auto) ? trackerFacts(repos, ctx, instructorId) : Promise.resolve(null),
  ]);
  const rowByLabel = new Map(rows.map((r) => [r.label.toLowerCase(), r]));
  const auto: TrackerItem[] = steps.filter((s) => s.auto).map((s) => ({ key: s.key, label: s.label, auto: true, done: facts ? autoStepDone(s.key, facts) : false, hint: s.hint }));
  const manual = steps
    .filter((s) => !s.auto)
    .map((s, i) => ({ s, row: rowByLabel.get(s.label.toLowerCase()), i }))
    .sort((a, b) => (a.row?.sortOrder ?? 1e6 + a.i) - (b.row?.sortOrder ?? 1e6 + b.i))
    .map(({ s, row }): TrackerItem => ({ key: s.key, label: s.label, auto: false, done: Boolean(row?.done), hint: s.hint, rowId: row?.id }));
  const items = [...auto, ...manual];
  return { on: true, items, done: items.filter((i) => i.done).length, total: items.length };
}
