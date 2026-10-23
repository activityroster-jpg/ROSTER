import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import type { Organisation, SetupMode } from "@/lib/db/schema";
import { course as courseTable, courseStaff as courseStaffTable, instructor as instructorTable, rosterDay as rosterDayTable, rosterWeek as rosterWeekTable, sessionStaffOverride as overrideTable } from "@/lib/db/schema";
import { and, eq, isNotNull, isNull, ne, notInArray, or } from "drizzle-orm";
import { EXAMPLE_SOURCE } from "./example-week";

export type SetupStepKey = "signup" | "team" | "invite" | "courses" | "roster" | "confirm" | "pay" | "plan";

export interface SetupStep {
  key: SetupStepKey;
  label: string;
  href: string;
  done: boolean;
  /** "later" steps aren't needed to roster: pay rates, choosing a plan. */
  stage: "essential" | "later";
  /** Why a step isn't done yet, when there's something specific to fix. */
  hint?: string;
}

export interface SetupStatus {
  setupMode: SetupMode;
  steps: SetupStep[];
  /** Over the essential steps only. */
  completePct: number;
  /** Every essential step done. */
  complete: boolean;
  hasStaff: boolean;
  /** At least one roster day confirmed (or a week published before days were confirmed one by one). */
  firstDayConfirmed: boolean;
}

/**
 * The getting-started checklist, in the order a centre gets rostering quickly:
 * sign up, set up courses and team (each person with their instructor types),
 * invite the team, put the courses on the calendar, build the first roster,
 * check licences and confirm the first day; then, later, pay rates and a plan.
 * Derived from the centre's real data (no extra table). Tenant scoped.
 */
export async function getSetupStatus(repos: Repositories, ctx: AnyTenantContext, organisation?: Pick<Organisation, "stripeSubscriptionId"> | null): Promise<SetupStatus> {
  const t = repos.tenant;
  const [settings, everyone, linked, courses, payRates, confirmedDays, publishedWeeks] = await Promise.all([
    t.orgSettings.list(ctx),
    t.instructor.list(ctx, eq(instructorTable.status, "active")),
    t.instructor.count(ctx, isNotNull(instructorTable.userId)),
    t.course.count(ctx, or(isNull(courseTable.source), ne(courseTable.source, EXAMPLE_SOURCE))),
    t.payRate.count(ctx),
    t.rosterDay.count(ctx, isNotNull(rosterDayTable.confirmedAt)),
    t.rosterWeek.count(ctx, isNotNull(rosterWeekTable.publishedAt)),
  ]);
  // The example week (made-up people and courses, lib/services/example-week) is
  // never the centre's own progress: its people, courses and shifts don't count.
  const exampleIds = everyone.filter((i) => i.source === EXAMPLE_SOURCE).map((i) => i.id);
  const active = everyone.filter((i) => i.source !== EXAMPLE_SOURCE);
  const [assignments, dayAdds] = await Promise.all([
    t.courseStaff.count(ctx, exampleIds.length ? notInArray(courseStaffTable.instructorId, exampleIds) : undefined),
    t.sessionStaffOverride.count(ctx, exampleIds.length ? and(eq(overrideTable.mode, "add"), notInArray(overrideTable.instructorId, exampleIds)) : eq(overrideTable.mode, "add")),
  ]);
  const held = active.length ? new Set((await t.qualification.list(ctx)).map((q) => q.instructorId)) : new Set<string>();
  const untyped = active.filter((i) => !held.has(i.id)).length;
  const officeRuns = settings[0]?.staffManagedBy === "office";
  const firstDayConfirmed = confirmedDays + publishedWeeks > 0;

  const steps: SetupStep[] = [
    { key: "signup", label: "Sign up and choose your PIN", href: "/office", done: true, stage: "essential" },
    {
      key: "team", label: "Set up your courses and team, with each person's instructor types", href: active.length ? "/office/staff" : "/office/onboarding", stage: "essential",
      done: active.length > 0 && untyped === 0,
      ...(active.length && untyped ? { hint: `${untyped} ${untyped === 1 ? "person has" : "people have"} no instructor type ticked, so Auto-roster can't check what they can teach` } : {}),
    },
    // When the office keeps availability nobody needs the app, so this step isn't asked of them.
    ...(officeRuns ? [] : [{ key: "invite" as const, label: "Invite your team to the app", href: "/office/staff", done: linked > 0, stage: "essential" as const }]),
    { key: "courses", label: "Put your courses on the calendar", href: "/office/courses", done: courses > 0, stage: "essential" },
    { key: "roster", label: "Build your first roster (Auto-roster)", href: "/office/rota", done: assignments + dayAdds > 0, stage: "essential" },
    { key: "confirm", label: "Check licences, then confirm your first day", href: "/office/rota", done: firstDayConfirmed, stage: "essential" },
    { key: "pay", label: "Set pay rates, before your first pay run", href: "/office/settings?tab=pay#pay-rates", done: payRates > 0, stage: "later" },
    ...(organisation !== undefined ? [{ key: "plan" as const, label: "Choose a plan before your trial ends", href: "/office/billing", done: Boolean(organisation?.stripeSubscriptionId), stage: "later" as const }] : []),
  ];

  const essential = steps.filter((s) => s.stage === "essential");
  const doneCount = essential.filter((s) => s.done).length;
  return {
    setupMode: settings[0]?.setupMode ?? "basic",
    steps,
    completePct: Math.round((doneCount / essential.length) * 100),
    complete: doneCount === essential.length,
    hasStaff: active.length > 0,
    firstDayConfirmed,
  };
}
