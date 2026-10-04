import { describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { ControlPlaneRepository } from "@/lib/db/repositories/control-plane";
import { durableRateLimit } from "@/lib/security/rate-limit";
import { authThrottleRule } from "@/lib/security/auth-throttle";
import { STEPUP_TTL_S, stepUpCookieValue, verifyStepUpCookie } from "@/lib/auth/step-up";
import { orgSettingsSchema } from "@/lib/validation/entities";

describe("durable rate limits (D1, atomic)", () => {
  it("counts hits within a window, refuses past the limit, and restarts in the next window", async () => {
    const { db } = createTestDb();
    const repo = new ControlPlaneRepository(db);
    const t0 = Date.UTC(2026, 9, 4, 12, 0, 0);
    const hits = [];
    for (let i = 0; i < 4; i++) hits.push(await durableRateLimit("auth:signin:email:a@b.test", 3, 900, t0 + i * 1000, repo));
    expect(hits.map((h) => h.allowed)).toEqual([true, true, true, false]);
    expect(hits[2]!.remaining).toBe(0);
    // A different account is untouched (limits are per account, not per address).
    expect((await durableRateLimit("auth:signin:email:c@d.test", 3, 900, t0, repo)).allowed).toBe(true);
    // Next window: back to the first hit.
    const later = await durableRateLimit("auth:signin:email:a@b.test", 3, 900, t0 + 901_000, repo);
    expect(later).toEqual({ allowed: true, remaining: 2 });
    // Expired counters are purged.
    expect(await repo.purgeRateLimits(new Date(t0 + 10 * 3600_000))).toBe(2);
  });

  it("parallel hits never slip past the limit", async () => {
    const { db } = createTestDb();
    const repo = new ControlPlaneRepository(db);
    const t0 = Date.UTC(2026, 9, 4, 12, 0, 0);
    const results = await Promise.all(Array.from({ length: 12 }, () => durableRateLimit("pin-reset:u1", 5, 900, t0, repo)));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });

  it("per-address auth limits only stop a flood; the per-email figure is the brake", () => {
    const rule = authThrottleRule("POST", "/api/auth/sign-in/email")!;
    expect(rule.perEmail).toBe(10);
    expect(rule.perIp).toBeGreaterThanOrEqual(100);
  });
});

describe("step-up before exports and anonymising", () => {
  it("binds the proof to one session and lapses after ten minutes", async () => {
    const now = Date.UTC(2026, 9, 4, 12, 0, 0);
    const v = await stepUpCookieValue("s3cret-s3cret-s3cret-s3cret", "sess-1", now);
    expect(await verifyStepUpCookie("s3cret-s3cret-s3cret-s3cret", "sess-1", v, now + 60_000)).toBe(true);
    expect(await verifyStepUpCookie("s3cret-s3cret-s3cret-s3cret", "sess-2", v, now + 60_000)).toBe(false);
    expect(await verifyStepUpCookie("s3cret-s3cret-s3cret-s3cret", "sess-1", v, now + (STEPUP_TTL_S + 1) * 1000)).toBe(false);
    expect(await verifyStepUpCookie("other-secret-other-secret", "sess-1", v, now + 60_000)).toBe(false);
    const forged = `${now + 9_999_999}.${v.split(".")[1]}`;
    expect(await verifyStepUpCookie("s3cret-s3cret-s3cret-s3cret", "sess-1", forged, now)).toBe(false);
    expect(await verifyStepUpCookie("s3cret-s3cret-s3cret-s3cret", "sess-1", undefined, now)).toBe(false);
  });
});

describe("privacy notice link", () => {
  it("accepts only https", () => {
    const base = { schedulingMode: "session", alertLeadDays: 30, currency: "GBP" } as const;
    expect(orgSettingsSchema.safeParse({ ...base, privacyNoticeUrl: "https://centre.example/privacy" }).success).toBe(true);
    expect(orgSettingsSchema.safeParse({ ...base, privacyNoticeUrl: "http://centre.example/privacy" }).success).toBe(false);
    expect(orgSettingsSchema.safeParse({ ...base, privacyNoticeUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(orgSettingsSchema.safeParse({ ...base, privacyNoticeUrl: "" }).success).toBe(true);
  });
});
