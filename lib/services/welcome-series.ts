import type { Database } from "@/lib/db/client";
import type { CloudflareEnv } from "@/lib/cf/bindings";
import { escapeHtml, sendEmail } from "@/lib/mail";
import { PlatformRepository, type FunnelMilestones } from "@/lib/db/repositories/platform";
import { trialState, type TrialState } from "@/lib/billing/trial";
import { ONBOARDING_EMAIL_STEPS, type OnboardingEmailStep, type Organisation } from "@/lib/db/schema";

/**
 * The welcome series: four short emails to a new centre's owner in its first
 * month, each pointing at the next step, its video and the Learning Centre.
 *
 *   welcome       once their email is confirmed: the three steps and the guide
 *   courses       day 2: put your courses on the calendar (unless they have)
 *   team          day 7: invite your team to the app (unless they have, or the office runs availability)
 *   trial_ending  five days before the free month ends (unless they chose a plan)
 *
 * Each step has a window; a centre past it is marked skipped and never gets
 * that email late. Everything is recorded once per centre and step, so the
 * hourly sweep is idempotent. Nothing goes to the platform owner's own centres
 * or the app-store reviewer logins.
 */
const DAY = 86_400_000;
export const TRIAL_ENDING_DAYS = 5;

export interface WelcomeFacts {
  /** Days since the centre was created. */
  ageDays: number;
  /** The owner has clicked the confirmation link. */
  verified: boolean;
  /** The centre's own courses on the calendar (not the example week's). */
  courses: number;
  /** People linked to an app login. */
  linked: number;
  officeRuns: boolean;
  trial: TrialState;
}

export type WelcomeDecision = "send" | "skip" | "wait";

/** Pure: whether a step is due now, no longer applies, or should wait. */
export function decideWelcomeStep(step: OnboardingEmailStep, f: WelcomeFacts): WelcomeDecision {
  switch (step) {
    case "welcome":
      if (f.ageDays >= 3) return "skip";
      return f.verified ? "send" : "wait";
    case "courses":
      if (f.ageDays < 2) return "wait";
      if (f.ageDays >= 7 || f.courses > 0) return "skip";
      return "send";
    case "team":
      if (f.ageDays < 7) return "wait";
      if (f.ageDays >= 14 || f.linked > 0 || f.officeRuns) return "skip";
      return "send";
    case "trial_ending":
      if (f.trial.kind !== "trial") return "skip";
      return f.trial.daysLeft <= TRIAL_ENDING_DAYS ? "send" : "wait";
  }
}

const btn = (href: string, label: string) => `<p><a href="${href}" style="display:inline-block;background:#0A2E52;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">${label}</a></p>`;
const small = (text: string) => `<p style="color:#64748b;font-size:13px">${text}</p>`;

/** The subject and body of each step, with the centre's own links. */
export function welcomeEmail(step: OnboardingEmailStep, input: { org: Pick<Organisation, "name" | "slug">; apex: string; trialEndsAt?: number; now?: number }): { subject: string; html: string } {
  const office = `https://${input.org.slug}.${input.apex}/office`;
  const learn = `https://${input.apex}/learn`;
  const name = escapeHtml(input.org.name);
  switch (step) {
    case "welcome":
      return {
        subject: `Welcome to ActivityRoster: your first roster in three steps`,
        html: `
          <p>Hello,</p>
          <p>Thanks for setting up <strong>${name}</strong>. Your first roster is three steps away, and the office walks you through them:</p>
          <ol>
            <li><strong>Tick the courses you run</strong> (the common ones are ticked for you).</li>
            <li><strong>Add your team</strong>, with each person's instructor types, so Auto-roster knows who can teach what.</li>
            <li><strong>Put your courses on the calendar</strong>, press Auto-roster, and confirm a day.</li>
          </ol>
          ${btn(`${office}/onboarding`, "Open the setup wizard")}
          <p>Rather see it working first? The wizard's last step can load an <strong>example week</strong>: six made-up instructors and a week of sessions, filled by Auto-roster, cleared with one click.</p>
          <p>Three minutes of video shows the whole set-up: <a href="${learn}?topic=getting-started">Sign up and the setup wizard</a>. The rest of the series, and the written guides, are in the <a href="${learn}">Learning Centre</a>.</p>
          ${small("Reply to this email if you'd like a hand; a person reads every reply.")}`,
      };
    case "courses":
      return {
        subject: `${input.org.name}: put your courses on the calendar`,
        html: `
          <p>Hello,</p>
          <p>Next for <strong>${name}</strong>: the courses. Add the whole season, not just the next fortnight, whichever way fits how you take bookings:</p>
          <ul>
            <li><strong>Booking system (quickest).</strong> Connect WebCollect, Bookwhen, Eola, Class4Kids and more once; new bookings come in for you to approve. <a href="${office}/integrations">Connect a booking system</a></li>
            <li><strong>Spreadsheet.</strong> Import the season in one go; importing an updated file later adds only the new courses. <a href="${office}/import">Import courses</a></li>
            <li><strong>By hand.</strong> Courses → New course, for the odd one-off. <a href="${office}/courses">Open Courses</a></li>
          </ul>
          <p>Two minutes of video: <a href="${learn}?topic=import">Getting courses on the calendar</a>.</p>
          ${btn(`${office}/courses`, "Open Courses")}
          ${small("Reply to this email if you'd like a hand.")}`,
      };
    case "team":
      return {
        subject: `${input.org.name}: invite your team to the app`,
        html: `
          <p>Hello,</p>
          <p>Your team keeps their own availability in the instructor app, free on iPhone and Android, and sees their shifts the moment you confirm a day. Invites come from ActivityRoster rather than from you, so they are easy to miss: the Instructors page has a ready-made message for your team chat that says the invite is real and where to find it.</p>
          ${btn(`${office}/staff`, "Invite your team")}
          <p>Under two minutes of video: <a href="${learn}?topic=staff">Inviting your team</a>. If you would rather run availability from the office with nobody signing up, that is a switch in Settings → Team.</p>
          ${small("Reply to this email if you'd like a hand.")}`,
      };
    case "trial_ending": {
      const when = input.trialEndsAt ? new Date(input.trialEndsAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) : "soon";
      return {
        subject: `${input.org.name}: your free month ends on ${when}`,
        html: `
          <p>Hello,</p>
          <p>The free month for <strong>${name}</strong> ends on <strong>${when}</strong>. Nothing is deleted: for two weeks after that everything stays visible but read-only, then the office asks for a plan before it opens again.</p>
          <p>Plans start at £35 a month for the whole centre, nothing per user, and you can cancel any time.</p>
          ${btn(`${office}/billing`, "Choose a plan")}
          <p>Not sure yet? Reply to this email with what is missing or getting in the way; it goes to a person.</p>`,
      };
    }
  }
}

const splitEmails = (raw: string | undefined) => (raw ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
const ageDaysOf = (org: Pick<Organisation, "createdAt">, now: number) => (now - (org.createdAt instanceof Date ? org.createdAt.getTime() : Number(org.createdAt))) / DAY;

/** Hourly: send each centre whatever step of the series is due, once. */
export async function sweepWelcomeSeries(db: Database, env: CloudflareEnv, now = new Date()): Promise<{ checked: number; sent: number; skipped: number }> {
  const platform = new PlatformRepository(db);
  const nowMs = now.getTime();
  const orgs = (await platform.listOrganisations()).filter((o) => o.status === "active" && ageDaysOf(o, nowMs) < 60);
  let checked = 0, sent = 0, skipped = 0;
  if (orgs.length === 0) return { checked, sent, skipped };
  const trialDays = (await platform.getPricing().catch(() => null))?.trialDays ?? 30;
  const apex = env.APP_APEX_DOMAIN || "activityroster.com";
  const never = new Set([...splitEmails(env.PLATFORM_ADMIN_EMAILS), ...splitEmails(env.APP_REVIEW_EMAILS)]);
  const [owners, milestones, done] = await Promise.all([platform.ownersByOrg(), platform.funnelMilestones(), platform.onboardingEmails()]);
  const none: FunnelMilestones = { instructors: 0, linked: 0, courses: 0, shifts: 0, confirmedDays: 0, officeRuns: false, actions: new Set() };
  for (const org of orgs) {
    const owner = owners.get(org.id);
    if (!owner || never.has(owner.email.toLowerCase())) continue;
    checked++;
    const m = milestones.get(org.id) ?? none;
    const trial = trialState(org, trialDays, nowMs);
    const facts: WelcomeFacts = { ageDays: ageDaysOf(org, nowMs), verified: owner.emailVerified, courses: m.courses, linked: m.linked, officeRuns: m.officeRuns, trial };
    const doneSteps = new Set((done.get(org.id) ?? []).map((r) => r.step));
    for (const step of ONBOARDING_EMAIL_STEPS) {
      if (doneSteps.has(step)) continue;
      const decision = decideWelcomeStep(step, facts);
      if (decision === "wait") continue;
      if (decision === "send") {
        const mail = welcomeEmail(step, { org, apex, trialEndsAt: trial.kind === "trial" ? trial.endsAt : undefined, now: nowMs });
        try { await sendEmail({ to: owner.email, subject: mail.subject, html: mail.html }); } catch (err) { console.error(`[welcome] ${step} for ${org.slug} failed:`, (err as Error).message); continue; }
        await platform.recordOnboardingEmail({ organisationId: org.id, step, status: "sent", sentTo: owner.email });
        sent++;
      } else {
        await platform.recordOnboardingEmail({ organisationId: org.id, step, status: "skipped", sentTo: null });
        skipped++;
      }
    }
  }
  return { checked, sent, skipped };
}
