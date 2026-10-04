import { z } from "zod";

/**
 * The trial-end survey: eight questions a centre answers when its free trial
 * ends, in exchange for another free month (lib/services/trial-survey). The
 * text answers ask for at least MIN_WORDS words so the feedback is usable.
 * Shared by the form (labels, live word counts) and the server (validation).
 */
export const MIN_WORDS = 30;
export const SURVEY_REWARD_DAYS = 30;

export const TEXT_QUESTIONS = [
  { key: "mostUseful", label: "Which feature has been most useful, and how could we improve it?" },
  { key: "leastUseful", label: "Which feature has been least useful, and what would make it useful?" },
  { key: "wouldChange", label: "What would you change about the platform?" },
  { key: "missing", label: "What's missing or frustrating?" },
  { key: "featureRequest", label: "What one feature or function would you add, and how would you use it?" },
] as const;
export const USER_COUNT_LABEL = "How many people would use ActivityRoster at your centre, including admins and instructors?";
export const OTHER_LABEL = "Any other feedback?";
export const CONTACT_LABEL = "Can we contact you about your answers?";
/** Every question in order, for the intro count and the Dev Center headings. */
export const QUESTION_COUNT = TEXT_QUESTIONS.length + 3;

export function wordCount(s: string): number {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
}

const words = z.string().trim().max(4000, "Please keep this under 4,000 characters")
  .refine((s) => wordCount(s) >= MIN_WORDS, `Please write at least ${MIN_WORDS} words`);

export const trialSurveySchema = z.object({
  mostUseful: words,
  leastUseful: words,
  wouldChange: words,
  missing: words,
  featureRequest: words,
  userCount: z.coerce.number({ invalid_type_error: "Enter a number" }).int("Enter a whole number").min(1, "Enter at least 1").max(10_000, "Enter a number up to 10,000"),
  otherFeedback: words,
  contactOk: z.enum(["yes", "no"], { required_error: "Choose yes or no", invalid_type_error: "Choose yes or no" }),
  contactEmail: z.string().trim().toLowerCase().max(200).optional().or(z.literal("")),
}).superRefine((v, ctx) => {
  if (v.contactOk === "yes" && !z.string().email().safeParse(v.contactEmail ?? "").success) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["contactEmail"], message: "Enter the email we should use" });
  }
}).transform((v) => ({
  ...v,
  contactOk: v.contactOk === "yes",
  // Only kept when the person said yes: nobody who said no can be contacted from it.
  contactEmail: v.contactOk === "yes" ? (v.contactEmail || null) : null,
}));
export type TrialSurveyInput = z.input<typeof trialSurveySchema>;
export type TrialSurveyAnswers = z.output<typeof trialSurveySchema>;
