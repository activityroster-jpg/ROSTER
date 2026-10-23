import { beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

const sent: { to: string; subject: string; html: string }[] = [];
vi.mock("@/lib/mail", () => ({
  sendEmail: vi.fn(async (m: { to: string; subject: string; html: string }) => { sent.push(m); }),
  escapeHtml: (s: unknown) => String(s ?? ""),
}));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { decideWelcomeStep, sweepWelcomeSeries, welcomeEmail, TRIAL_ENDING_DAYS } from "@/lib/services/welcome-series";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { ControlPlaneRepository } from "@/lib/db/repositories/control-plane";
import { createRepositories } from "@/lib/db/repositories";
import { loadExampleWeek } from "@/lib/services/example-week";
import type { CloudflareEnv } from "@/lib/cf/bindings";
import type { Database as Db } from "@/lib/db/client";

const env = { APP_APEX_DOMAIN: "activityroster.com", PLATFORM_ADMIN_EMAILS: "conor@platform.test", APP_REVIEW_EMAILS: "applereview@activityroster.com" } as unknown as CloudflareEnv;
const DAY = 86_400_000;
const trial = (daysLeft: number) => ({ kind: "trial" as const, endsAt: Date.now() + daysLeft * DAY, daysLeft });
const facts = (over: Partial<Parameters<typeof decideWelcomeStep>[1]> = {}) => ({ ageDays: 0, verified: true, courses: 0, linked: 0, officeRuns: false, trial: trial(30), ...over });

describe("welcome series: when each step is due", () => {
  it("welcomes once the email is confirmed, and never after three days", () => {
    expect(decideWelcomeStep("welcome", facts({ verified: false }))).toBe("wait");
    expect(decideWelcomeStep("welcome", facts({ ageDays: 0.1 }))).toBe("send");
    expect(decideWelcomeStep("welcome", facts({ ageDays: 3, verified: false }))).toBe("skip");
  });

  it("nudges about courses on day 2 unless they are in, and about the team on day 7 unless it is invited or office-run", () => {
    expect(decideWelcomeStep("courses", facts({ ageDays: 1 }))).toBe("wait");
    expect(decideWelcomeStep("courses", facts({ ageDays: 2 }))).toBe("send");
    expect(decideWelcomeStep("courses", facts({ ageDays: 2, courses: 3 }))).toBe("skip");
    expect(decideWelcomeStep("courses", facts({ ageDays: 8 }))).toBe("skip");
    expect(decideWelcomeStep("team", facts({ ageDays: 6 }))).toBe("wait");
    expect(decideWelcomeStep("team", facts({ ageDays: 7 }))).toBe("send");
    expect(decideWelcomeStep("team", facts({ ageDays: 7, linked: 1 }))).toBe("skip");
    expect(decideWelcomeStep("team", facts({ ageDays: 7, officeRuns: true }))).toBe("skip");
    expect(decideWelcomeStep("team", facts({ ageDays: 14 }))).toBe("skip");
  });

  it("warns five days before the trial ends, and not at all once a plan is chosen", () => {
    expect(decideWelcomeStep("trial_ending", facts({ trial: trial(TRIAL_ENDING_DAYS + 1) }))).toBe("wait");
    expect(decideWelcomeStep("trial_ending", facts({ trial: trial(TRIAL_ENDING_DAYS) }))).toBe("send");
    expect(decideWelcomeStep("trial_ending", facts({ trial: { kind: "paid" } }))).toBe("skip");
    expect(decideWelcomeStep("trial_ending", facts({ trial: { kind: "read_only", endsAt: 0, lockedAt: 0, daysUntilLock: 3 } }))).toBe("skip");
  });

  it("writes each step with the centre's own links and the Learning Centre", () => {
    const org = { name: "Harbour & Co", slug: "harbour" };
    const w = welcomeEmail("welcome", { org, apex: "activityroster.com" });
    expect(w.html).toContain("https://harbour.activityroster.com/office/onboarding");
    expect(w.html).toContain("https://activityroster.com/learn?topic=getting-started");
    expect(w.html).toContain("Harbour & Co"); // escapeHtml is stubbed in this test
    expect(welcomeEmail("courses", { org, apex: "activityroster.com" }).html).toContain("/learn?topic=import");
    expect(welcomeEmail("team", { org, apex: "activityroster.com" }).html).toContain("/learn?topic=staff");
    const t = welcomeEmail("trial_ending", { org, apex: "activityroster.com", trialEndsAt: Date.UTC(2026, 10, 22) });
    expect(t.subject).toContain("Sunday 22 November");
    expect(t.html).toContain("/office/billing");
  });
});

describe("welcome series: the hourly sweep", () => {
  let db: Db;
  let a: Awaited<ReturnType<typeof seedFullOrg>>;
  let platform: PlatformRepository;
  let control: ControlPlaneRepository;
  const ownerOf = async (slug: string) => (await control.userByEmail(`owner@${slug}.test`))!;

  beforeEach(async () => {
    sent.length = 0;
    ({ db } = createTestDb());
    a = await seedFullOrg(db, { name: "Harbour", slug: "harbour", jurisdiction: "england" });
    platform = new PlatformRepository(db);
    control = new ControlPlaneRepository(db);
    // The fixture makes paying centres; the series is about centres on their free month.
    await control.updateOrganisation(a.organisationId, { subscriptionStatus: "trialing" });
  });

  const setCreated = async (orgId: string, daysAgo: number) => {
    await control.updateOrganisation(orgId, { createdAt: new Date(Date.now() - daysAgo * DAY) } as never);
  };

  it("waits for the owner to confirm, then sends the welcome once", async () => {
    expect(await sweepWelcomeSeries(db, env)).toMatchObject({ checked: 1, sent: 0, skipped: 0 });
    await control.markEmailVerified((await ownerOf("harbour")).id);
    expect(await sweepWelcomeSeries(db, env)).toMatchObject({ sent: 1 });
    expect(sent[0]).toMatchObject({ to: "owner@harbour.test" });
    expect(sent[0]!.subject).toContain("Welcome");
    expect(await sweepWelcomeSeries(db, env)).toMatchObject({ sent: 0, skipped: 0 });
    expect(sent).toHaveLength(1);
    expect((await platform.onboardingEmails()).get(a.organisationId)?.map((r) => [r.step, r.status])).toEqual([["welcome", "sent"]]);
  });

  it("skips the courses nudge when courses are already in, counting only the centre's own", async () => {
    await control.markEmailVerified((await ownerOf("harbour")).id);
    await setCreated(a.organisationId, 2.5);
    // The fixture already has a course of its own, so day 2's nudge isn't needed.
    const r = await sweepWelcomeSeries(db, env);
    expect(r.skipped).toBeGreaterThanOrEqual(1);
    const rows = (await platform.onboardingEmails()).get(a.organisationId) ?? [];
    expect(rows.find((x) => x.step === "courses")?.status).toBe("skipped");
    expect(rows.find((x) => x.step === "welcome")?.status).toBe("sent");
  });

  it("sends the courses nudge to a centre with only the example week, and the team nudge on day 7", async () => {
    const b = await seedFullOrg(db, { name: "Lakeside", slug: "lakeside", jurisdiction: "england" });
    const repos = createRepositories(db);
    // Strip the fixture's own course and people so only the example week is there.
    for (const c of await repos.tenant.course.list(b.ctx)) await repos.tenant.course.delete(b.ctx, c.id);
    for (const s of await repos.tenant.courseStaff.list(b.ctx)) await repos.tenant.courseStaff.delete(b.ctx, s.id);
    for (const s of await repos.tenant.sessionStaffOverride.list(b.ctx)) await repos.tenant.sessionStaffOverride.delete(b.ctx, s.id);
    for (const i of await repos.tenant.instructor.list(b.ctx)) await repos.tenant.instructor.delete(b.ctx, i.id);
    await loadExampleWeek(repos, b.ctx, { today: "2026-07-06" });
    await control.markEmailVerified((await ownerOf("lakeside")).id);
    await setCreated(b.organisationId, 2.1);
    await sweepWelcomeSeries(db, env);
    const mine = sent.filter((m) => m.to === "owner@lakeside.test");
    expect(mine.map((m) => m.subject)).toEqual(expect.arrayContaining([expect.stringContaining("Welcome"), expect.stringContaining("put your courses on the calendar")]));
    sent.length = 0;
    await setCreated(b.organisationId, 7.2);
    await sweepWelcomeSeries(db, env);
    expect(sent.filter((m) => m.to === "owner@lakeside.test").map((m) => m.subject)).toEqual([expect.stringContaining("invite your team")]);
  });

  it("warns before the trial ends and never writes to the platform owner's or the reviewers' centres", async () => {
    await control.markEmailVerified((await ownerOf("harbour")).id);
    await setCreated(a.organisationId, 26);
    const r = await sweepWelcomeSeries(db, env);
    expect(r.sent).toBe(1);
    expect(sent.map((m) => m.subject)).toEqual([expect.stringContaining("your free month ends")]);
    expect(r.skipped).toBe(3); // welcome, courses and team are past their windows
    // A centre whose owner is the platform admin: nothing, ever.
    const c = await seedFullOrg(db, { name: "Conor Test", slug: "conortest", jurisdiction: "england" });
    const owner = await ownerOf("conortest");
    await control.markEmailVerified(owner.id);
    await db.run(sql`update user set email = 'conor@platform.test' where id = ${owner.id}`); // test-only: the fixture has no way to choose the owner's address
    sent.length = 0;
    await sweepWelcomeSeries(db, env);
    expect(sent.filter((m) => m.to === "conor@platform.test")).toHaveLength(0);
    expect((await platform.onboardingEmails()).get(c.organisationId)).toBeUndefined();
  });
});
