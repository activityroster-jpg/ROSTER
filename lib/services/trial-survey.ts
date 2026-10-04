import type { Database } from "@/lib/db/client";
import type { CloudflareEnv } from "@/lib/cf/bindings";
import type { Repositories } from "@/lib/db/repositories";
import { ControlPlaneRepository } from "@/lib/db/repositories/control-plane";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import type { Organisation } from "@/lib/db/schema";
import { TRIAL_GRACE_DAYS, trialState, type TrialState } from "@/lib/billing/trial";
import { SURVEY_REWARD_DAYS, type TrialSurveyAnswers } from "@/lib/validation/trial-survey";
import { writeAudit } from "@/lib/services/audit";
import { sendEmail, escapeHtml } from "@/lib/mail";

/**
 * The trial-end survey. When a centre's free trial ends without a plan, its
 * admins are invited (banner in the office, one email) to answer eight short
 * questions; sending the answers unlocks the centre for another free month.
 * Once per centre: the answers table allows one row per centre.
 */
const DAY = 86_400_000;

export type SurveyStatus = "not_yet" | "open" | "answered" | "not_applicable";

/** Pure: may this centre take the survey now? Open once the trial has ended (read-only or locked) and until answered. */
export function surveyStatus(trial: TrialState, answered: boolean): SurveyStatus {
  if (answered) return "answered";
  if (trial.kind === "trial") return "not_yet";
  if (trial.kind === "read_only" || trial.kind === "locked") return "open";
  return "not_applicable";
}

export class SurveyNotOpenError extends Error {
  constructor(public readonly status: SurveyStatus) {
    super(status === "answered" ? "Your centre has already answered the survey." : "The survey opens when your free trial ends.");
    this.name = "SurveyNotOpenError";
  }
}

/**
 * Store the answers and give the free month: the trial now ends
 * SURVEY_REWARD_DAYS from now, so the centre is editable again straight away.
 * The extension is a billing change, so it goes in the centre's change log.
 */
export async function submitTrialSurvey(
  repos: Repositories,
  args: { organisation: Organisation; userId: string; trialDays: number; answers: TrialSurveyAnswers; now?: Date },
): Promise<{ trialEndsAt: Date }> {
  const { organisation: org, userId, trialDays, answers } = args;
  const now = args.now ?? new Date();
  const platform = new PlatformRepository(repos.db);
  const status = surveyStatus(trialState(org, trialDays, now.getTime()), Boolean(await platform.trialFeedbackForOrg(org.id)));
  if (status !== "open") throw new SurveyNotOpenError(status);

  const row = await platform.insertTrialFeedback({
    organisationId: org.id,
    userId,
    ...answers,
    contactAnsweredAt: now,
    rewardDays: SURVEY_REWARD_DAYS,
  });
  // Lost a race with another admin of the same centre: their answers won, and the month is already given.
  if (!row) throw new SurveyNotOpenError("answered");

  const trialEndsAt = new Date(now.getTime() + SURVEY_REWARD_DAYS * DAY);
  await repos.control.updateOrganisation(org.id, { trialEndsAt, subscriptionStatus: org.subscriptionStatus ?? "trialing" });
  await writeAudit(repos, { organisationId: org.id, slug: org.slug, system: true, reason: "trial-survey" }, {
    action: "trial_extended",
    entity: "organisation",
    entityId: org.id,
    before: { trialEndsAt: org.trialEndsAt?.toISOString() ?? null },
    after: { trialEndsAt: trialEndsAt.toISOString(), reason: "trial-end survey answered", answeredBy: userId },
  });
  return { trialEndsAt };
}

/**
 * Hourly: email the survey invitation to the admins of each centre whose trial
 * ended within the grace window and who haven't answered. Once per centre.
 * Centres whose trial ended longer ago are not emailed out of the blue; they
 * still see the offer in the office when they next sign in.
 */
export async function sweepTrialSurvey(db: Database, env: CloudflareEnv, now = new Date()): Promise<{ checked: number; sent: number }> {
  const platform = new PlatformRepository(db);
  const control = new ControlPlaneRepository(db);
  const trialDays = (await platform.getPricing().catch(() => null))?.trialDays ?? 30;
  const apex = env.APP_APEX_DOMAIN || "activityroster.com";
  let checked = 0, sent = 0;
  for (const org of await platform.listOrganisations()) {
    if (org.status !== "active" || org.trialSurveySentAt) continue;
    const trial = trialState(org, trialDays, now.getTime());
    if (trial.kind !== "read_only" && trial.kind !== "locked") continue;
    if (now.getTime() - trial.endsAt > TRIAL_GRACE_DAYS * DAY) continue;
    checked++;
    if (await platform.trialFeedbackForOrg(org.id)) continue;
    const admins = await control.adminEmailsForOrg(org.id);
    const url = `https://${org.slug}.${apex}/office/trial-survey`;
    const html = `
      <p>Hello,</p>
      <p>The free trial for <strong>${escapeHtml(org.name)}</strong> has ended.</p>
      <p>Answer a few short questions about your trial and we'll unlock your account for another month, free.</p>
      <p><a href="${url}" style="display:inline-block;background:#0A2E52;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Take the survey</a></p>
      <p style="color:#64748b;font-size:13px">It takes about ten minutes. Everything you set up during the trial is still there. If you'd rather choose a plan now, go to Billing in the office.</p>`;
    await Promise.all(admins.map((email) => sendEmail({ to: email, subject: `${org.name}: another free month for your feedback`, html }).catch(() => {})));
    await control.updateOrganisation(org.id, { trialSurveySentAt: now });
    sent++;
  }
  return { checked, sent };
}
