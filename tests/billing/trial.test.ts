import { describe, expect, it } from "vitest";
import { TRIAL_GRACE_DAYS, trialState } from "@/lib/billing/trial";

const DAY = 24 * 60 * 60 * 1000;
const created = new Date("2026-01-01T00:00:00Z");

describe("free trial clock", () => {
  it("counts down, goes read-only, then locks", () => {
    const org = { createdAt: created, trialEndsAt: null, subscriptionStatus: "trialing" as const };
    expect(trialState(org, 30, created.getTime() + 10 * DAY)).toMatchObject({ kind: "trial", daysLeft: 20 });
    expect(trialState(org, 30, created.getTime() + 31 * DAY)).toMatchObject({ kind: "read_only", daysUntilLock: TRIAL_GRACE_DAYS - 1 });
    expect(trialState(org, 30, created.getTime() + (30 + TRIAL_GRACE_DAYS + 1) * DAY)).toMatchObject({ kind: "locked" });
  });
  it("a Dev Center extension wins over the default, and paying centres are never on the clock", () => {
    const extended = { createdAt: created, trialEndsAt: new Date(created.getTime() + 90 * DAY), subscriptionStatus: "trialing" as const };
    expect(trialState(extended, 30, created.getTime() + 60 * DAY)).toMatchObject({ kind: "trial", daysLeft: 30 });
    const paid = { createdAt: created, trialEndsAt: null, subscriptionStatus: "active" as const };
    expect(trialState(paid, 30, created.getTime() + 400 * DAY)).toEqual({ kind: "paid" });
    const noStatus = { createdAt: created, trialEndsAt: null, subscriptionStatus: null };
    expect(trialState(noStatus, 30, created.getTime() + 5 * DAY).kind).toBe("trial");
  });
});
