import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import type { SetupMode } from "@/lib/db/schema";
import { instructor as instructorTable } from "@/lib/db/schema";
import { isNotNull } from "drizzle-orm";

export interface SetupStep {
  label: string;
  href: string;
  done: boolean;
}

export interface SetupStatus {
  setupMode: SetupMode;
  steps: SetupStep[];
  completePct: number;
  complete: boolean;
}

/**
 * A getting-started checklist derived from the org's real data (no extra table):
 * whether they've added staff, courses, pay rates, invited an instructor and
 * taken a booking. Drives the office onboarding card. Tenant scoped.
 */
export async function getSetupStatus(repos: Repositories, ctx: AnyTenantContext): Promise<SetupStatus> {
  const t = repos.tenant;
  const [settings, instructors, linked, courses, payRates, bookings] = await Promise.all([
    t.orgSettings.list(ctx),
    t.instructor.count(ctx),
    t.instructor.count(ctx, isNotNull(instructorTable.userId)),
    t.course.count(ctx),
    t.payRate.count(ctx),
    t.booking.count(ctx),
  ]);

  const steps: SetupStep[] = [
    { label: "Add your staff", href: "/office/staff", done: instructors > 0 },
    { label: "Set pay rates", href: "/office/finance", done: payRates > 0 },
    { label: "Create your first course", href: "/office/courses", done: courses > 0 },
    { label: "Invite an instructor to the app", href: "/office/staff", done: linked > 0 },
    { label: "Take a booking", href: "/office/bookings", done: bookings > 0 },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const completePct = Math.round((doneCount / steps.length) * 100);
  return {
    setupMode: settings[0]?.setupMode ?? "basic",
    steps,
    completePct,
    complete: doneCount === steps.length,
  };
}
