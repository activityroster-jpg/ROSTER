import { beforeEach, describe, expect, it, vi } from "vitest";

const sent: { to: string; subject: string; html: string }[] = [];
vi.mock("@/lib/mail", () => ({
  sendEmail: vi.fn(async (m: { to: string; subject: string; html: string }) => { sent.push(m); }),
  escapeHtml: (s: unknown) => String(s ?? ""),
}));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { ExtraTrialError, grantExtraTrial, submitTrialSurvey, surveyStatus, sweepTrialSurvey, SurveyNotOpenError } from "@/lib/services/trial-survey";
import { MIN_WORDS, QUESTION_COUNT, SURVEY_REWARD_DAYS, trialSurveySchema, wordCount } from "@/lib/validation/trial-survey";
import { trialState } from "@/lib/billing/trial";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import type { CloudflareEnv } from "@/lib/cf/bindings";

const env = { APP_APEX_DOMAIN: "activityroster.com", PLATFORM_ADMIN_EMAILS: "conor@platform.test" } as unknown as CloudflareEnv;
const DAY = 86_400_000;
const thirty = Array.from({ length: MIN_WORDS }, (_, i) => `word${i}`).join(" ");
const valid = {
  mostUseful: thirty, leastUseful: thirty, wouldChange: thirty, missing: thirty, featureRequest: thirty,
  userCount: "12", otherFeedback: thirty, contactOk: "yes", contactEmail: "Owner@Alpha.test",
};

describe("trial-end survey: validation", () => {
  it("has eight questions and counts words", () => {
    expect(QUESTION_COUNT).toBe(8);
    expect(wordCount("  one two\nthree  ")).toBe(3);
    expect(wordCount("   ")).toBe(0);
  });

  it("needs 30 words on each required text answer, a whole number of users and a yes or no", () => {
    const r = trialSurveySchema.safeParse({ ...valid, missing: "too short", userCount: "2.5", contactOk: undefined });
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["missing", "userCount", "contactOk"]));
  });

  it("lets question 7 be left blank", () => {
    const r = trialSurveySchema.parse({ ...valid, otherFeedback: "" });
    expect(r.otherFeedback).toBe("");
    const missing = trialSurveySchema.parse({ ...valid, otherFeedback: undefined });
    expect(missing.otherFeedback).toBe("");
  });

  it("keeps the email only when the answer is yes, and needs a valid one then", () => {
    const yes = trialSurveySchema.parse(valid);
    expect(yes.contactOk).toBe(true);
    expect(yes.contactEmail).toBe("owner@alpha.test");
    const no = trialSurveySchema.parse({ ...valid, contactOk: "no", contactEmail: "owner@alpha.test" });
    expect(no.contactOk).toBe(false);
    expect(no.contactEmail).toBeNull();
    const bad = trialSurveySchema.safeParse({ ...valid, contactEmail: "" });
    expect(bad.success).toBe(false);
  });
});

describe("trial-end survey: eligibility, reward and invitation", () => {
  beforeEach(() => { sent.length = 0; });

  it("opens only once the trial has ended, and closes once answered", () => {
    const now = Date.parse("2026-10-04T12:00:00Z");
    const org = (endsAt: number) => ({ createdAt: new Date(now - 60 * DAY), trialEndsAt: new Date(endsAt), subscriptionStatus: "trialing" as const });
    expect(surveyStatus(trialState(org(now + DAY), 30, now), false)).toBe("not_yet");
    expect(surveyStatus(trialState(org(now - DAY), 30, now), false)).toBe("open");
    expect(surveyStatus(trialState(org(now - 40 * DAY), 30, now), false)).toBe("open");
    expect(surveyStatus(trialState(org(now - DAY), 30, now), true)).toBe("answered");
    expect(surveyStatus(trialState({ ...org(now - DAY), subscriptionStatus: "active" }, 30, now), false)).toBe("not_applicable");
  });

  it("stores the answers with the contact timestamp, unlocks the centre for 30 days, logs it, and only once", async () => {
    const { db } = createTestDb();
    const { repos, organisationId } = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    const now = new Date("2026-10-04T12:00:00Z");
    const org = (await repos.control.updateOrganisation(organisationId, { trialEndsAt: new Date(now.getTime() - 3 * DAY), subscriptionStatus: "trialing" }))!;
    expect(trialState(org, 30, now.getTime()).kind).toBe("read_only");

    const r = await submitTrialSurvey(repos, { organisation: org, userId: "user-1", trialDays: 30, answers: trialSurveySchema.parse(valid), now });
    expect(r.trialEndsAt.getTime()).toBe(now.getTime() + SURVEY_REWARD_DAYS * DAY);
    const after = (await repos.control.organisationById(organisationId))!;
    expect(trialState(after, 30, now.getTime() + DAY).kind).toBe("trial");

    const row = (await new PlatformRepository(db).trialFeedbackForOrg(organisationId))!;
    expect(row.contactOk).toBe(true);
    expect(row.contactEmail).toBe("owner@alpha.test");
    expect(row.contactAnsweredAt.toISOString()).toBe(now.toISOString());
    expect(row.missing).toBe(thirty);
    expect(row.userCount).toBe(12);

    const log = await repos.tenant.auditLog.list({ organisationId, slug: "alpha", system: true, reason: "test" });
    expect(log.some((l) => l.action === "trial_extended")).toBe(true);

    // Same centre again, even with the trial ended once more: refused, no second month.
    const ended = (await repos.control.updateOrganisation(organisationId, { trialEndsAt: new Date(now.getTime() - DAY) }))!;
    await expect(submitTrialSurvey(repos, { organisation: ended, userId: "user-2", trialDays: 30, answers: trialSurveySchema.parse(valid), now })).rejects.toBeInstanceOf(SurveyNotOpenError);
  });

  it("refuses while the trial is still running", async () => {
    const { db } = createTestDb();
    const { repos, organisationId } = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    const now = new Date("2026-10-04T12:00:00Z");
    const org = (await repos.control.updateOrganisation(organisationId, { trialEndsAt: new Date(now.getTime() + 5 * DAY), subscriptionStatus: "trialing" }))!;
    await expect(submitTrialSurvey(repos, { organisation: org, userId: "u", trialDays: 30, answers: trialSurveySchema.parse(valid), now })).rejects.toBeInstanceOf(SurveyNotOpenError);
  });

  it("emails the admins once when the trial ends, with the new copy, and skips old or answered trials", async () => {
    const { db } = createTestDb();
    const { repos, organisationId } = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    const now = new Date("2026-10-04T12:00:00Z");
    await repos.control.updateOrganisation(organisationId, { trialEndsAt: new Date(now.getTime() + DAY), subscriptionStatus: "trialing" });
    expect(await sweepTrialSurvey(db, env, now)).toEqual({ checked: 0, sent: 0 });

    const later = new Date(now.getTime() + 2 * DAY);
    expect(await sweepTrialSurvey(db, env, later)).toEqual({ checked: 1, sent: 1 });
    expect(sent.map((s) => s.to)).toEqual(["owner@alpha.test"]);
    expect(sent[0]!.html).toContain("Answer a few short questions about your trial and we'll unlock your account for another month, free.");
    expect(sent[0]!.html).toContain("https://alpha.activityroster.com/office/trial-survey");
    expect(await sweepTrialSurvey(db, env, new Date(later.getTime() + DAY))).toEqual({ checked: 0, sent: 0 });

    // A trial that ended long ago is not emailed out of the blue.
    const { db: db2 } = createTestDb();
    const b = await seedFullOrg(db2, { name: "Beta", slug: "beta", jurisdiction: "england" });
    await b.repos.control.updateOrganisation(b.organisationId, { trialEndsAt: new Date(now.getTime() - 60 * DAY), subscriptionStatus: "trialing" });
    sent.length = 0;
    expect(await sweepTrialSurvey(db2, env, now)).toEqual({ checked: 0, sent: 0 });
    expect(sent).toHaveLength(0);
  });

  it("activates one extra 30 days from the Dev Center, on top of any time left, logs it and emails the admins", async () => {
    const { db } = createTestDb();
    const { repos, organisationId } = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    const now = new Date("2026-10-04T12:00:00Z");
    const org = (await repos.control.updateOrganisation(organisationId, { trialEndsAt: new Date(now.getTime() - 3 * DAY), subscriptionStatus: "trialing" }))!;
    const { trialEndsAt: rewarded } = await submitTrialSurvey(repos, { organisation: org, userId: "u", trialDays: 30, answers: trialSurveySchema.parse(valid), now });
    const fb = (await new PlatformRepository(db).trialFeedbackForOrg(organisationId))!;
    sent.length = 0;

    const later = new Date(now.getTime() + 2 * DAY);
    const r = await grantExtraTrial(repos, env, { feedbackId: fb.id, grantedBy: "conor@platform.test", trialDays: 30, now: later });
    // Still 28 days left from the survey month, so the extra 30 days go on the end of it.
    expect(r.trialEndsAt.getTime()).toBe(rewarded.getTime() + 30 * DAY);
    expect((await repos.control.organisationById(organisationId))!.trialEndsAt!.getTime()).toBe(r.trialEndsAt.getTime());
    const after = (await new PlatformRepository(db).trialFeedbackById(fb.id))!;
    expect(after.extraTrialGrantedBy).toBe("conor@platform.test");
    expect(after.extraTrialGrantedAt!.toISOString()).toBe(later.toISOString());
    expect(sent.map((m) => m.to)).toEqual(["owner@alpha.test"]);
    const log = await repos.tenant.auditLog.list({ organisationId, slug: "alpha", system: true, reason: "test" });
    expect(log.some((l) => l.action === "trial_extended_by_platform")).toBe(true);

    await expect(grantExtraTrial(repos, env, { feedbackId: fb.id, grantedBy: "conor@platform.test", trialDays: 30, now: later })).rejects.toBeInstanceOf(ExtraTrialError);
  });

  it("won't extend a centre that is on a paid plan", async () => {
    const { db } = createTestDb();
    const { repos, organisationId } = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    const now = new Date("2026-10-04T12:00:00Z");
    const org = (await repos.control.updateOrganisation(organisationId, { trialEndsAt: new Date(now.getTime() - DAY), subscriptionStatus: "trialing" }))!;
    await submitTrialSurvey(repos, { organisation: org, userId: "u", trialDays: 30, answers: trialSurveySchema.parse(valid), now });
    await repos.control.updateOrganisation(organisationId, { subscriptionStatus: "active" });
    const fb = (await new PlatformRepository(db).trialFeedbackForOrg(organisationId))!;
    await expect(grantExtraTrial(repos, env, { feedbackId: fb.id, grantedBy: "c", trialDays: 30, now })).rejects.toThrow(/paid plan/);
    expect((await new PlatformRepository(db).trialFeedbackById(fb.id))!.extraTrialGrantedAt).toBeNull();
  });
});
