import type { Organisation } from "@/lib/db/schema";

/**
 * Free-trial rules, pure. A centre on trial (no active subscription) gets the
 * platform trial length from sign-up, or whatever end date the Dev Center set.
 * After that it is READ-ONLY for a grace period (everything visible, nothing
 * changeable, billing still reachable), then LOCKED (admins land on Billing,
 * instructors on a "trial ended" page). Paid centres never hit this.
 */
export const TRIAL_GRACE_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

export type TrialState =
  | { kind: "paid" }
  | { kind: "trial"; endsAt: number; daysLeft: number }
  | { kind: "read_only"; endsAt: number; lockedAt: number; daysUntilLock: number }
  | { kind: "locked"; endsAt: number };

export function trialEndsAt(
  org: Pick<Organisation, "createdAt" | "trialEndsAt">,
  trialDays: number,
): number {
  if (org.trialEndsAt) return org.trialEndsAt instanceof Date ? org.trialEndsAt.getTime() : Number(org.trialEndsAt);
  const created = org.createdAt instanceof Date ? org.createdAt.getTime() : Number(org.createdAt);
  return created + Math.max(0, trialDays) * DAY;
}

export function trialState(
  org: Pick<Organisation, "createdAt" | "trialEndsAt" | "subscriptionStatus">,
  trialDays: number,
  now: number = Date.now(),
): TrialState {
  // Anything other than a trial (active, past_due, canceled…) is handled by
  // Stripe status + org status, not by the trial clock.
  if (org.subscriptionStatus && org.subscriptionStatus !== "trialing") return { kind: "paid" };
  const endsAt = trialEndsAt(org, trialDays);
  if (now < endsAt) return { kind: "trial", endsAt, daysLeft: Math.ceil((endsAt - now) / DAY) };
  const lockedAt = endsAt + TRIAL_GRACE_DAYS * DAY;
  if (now < lockedAt) return { kind: "read_only", endsAt, lockedAt, daysUntilLock: Math.ceil((lockedAt - now) / DAY) };
  return { kind: "locked", endsAt };
}

/** Thrown by the repository layer when a lapsed-trial centre tries to change something. */
export class TrialReadOnlyError extends Error {
  constructor() {
    super("Your free trial has ended, so nothing can be changed until a payment method is added in Billing.");
    this.name = "TrialReadOnlyError";
  }
}
