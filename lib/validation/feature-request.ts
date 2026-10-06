import { z } from "zod";
import { FEATURE_REQUEST_IMPORTANCE, FEATURE_REQUEST_KINDS, FEATURE_REQUEST_STATUSES, type FeatureRequestStatus } from "@/lib/db/schema";

/**
 * Feature requests and problem reports a centre sends from Settings → Requests.
 * Shared by the form (labels, hints) and the server (validation). The title is
 * the only part other centres ever see, so the form says so next to it.
 */

export const FEATURE_REQUEST_MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
/** Requests one centre can send in 24 hours: plenty for real use, a stop on accidents and abuse. */
export const FEATURE_REQUEST_DAILY_CAP = 10;

/** Plain-English stage names, in board order, with what each means for the centre. */
export const STATUS_INFO: Record<FeatureRequestStatus, { label: string; hint: string; tone: string }> = {
  submitted: { label: "Submitted", hint: "We have it. Only your centre and ActivityRoster can see it until we've read it.", tone: "bg-slate-100 text-slate-600" },
  in_review: { label: "In review", hint: "We're working out whether and how it can be done. It's on the board for other centres now.", tone: "bg-navy/10 text-navy" },
  approved: { label: "Approved", hint: "We're going to build it.", tone: "bg-teal/15 text-teal" },
  in_development: { label: "In development", hint: "Being built now.", tone: "bg-teal/15 text-teal" },
  testing: { label: "Testing", hint: "Built, and being checked before it goes live.", tone: "bg-amber/15 text-amber" },
  live: { label: "Live", hint: "Done: the change is in the platform.", tone: "bg-starboard/15 text-starboard" },
  not_possible: { label: "Not possible", hint: "We looked at it and can't do it, at least for now. We'll say why where we can.", tone: "bg-port/10 text-port" },
};
export const STATUS_ORDER: readonly FeatureRequestStatus[] = FEATURE_REQUEST_STATUSES;

export const IMPORTANCE_LABEL: Record<(typeof FEATURE_REQUEST_IMPORTANCE)[number], string> = {
  nice: "Nice to have",
  important: "Important: it would save us real time",
  blocking: "Blocking: we can't do something we need to",
};

const text = (max: number) => z.string().trim().max(max, `Please keep this under ${max.toLocaleString("en-GB")} characters`);
const optional = (max: number) => text(max).optional().transform((s) => (s ? s : null));

export const featureRequestSchema = z.object({
  kind: z.enum(FEATURE_REQUEST_KINDS, { message: "Choose a new feature or a problem" }),
  title: text(120).min(6, "Give it a short title (at least a few words)"),
  problem: text(4000).min(20, "Tell us a bit more about the problem: what happens now?"),
  change: text(4000).min(10, "Tell us what you'd like to change"),
  whoAffected: optional(500),
  frequency: optional(500),
  workaround: optional(2000),
  importance: z.enum(FEATURE_REQUEST_IMPORTANCE).default("important"),
  details: optional(6000),
  consentPublic: z.literal("on", { message: "Please tick to agree that the title will be shown to other centres" }),
});
export type FeatureRequestInput = z.infer<typeof featureRequestSchema>;

/** Dev Center edits. */
export const featureRequestAdminSchema = z.object({
  status: z.enum(FEATURE_REQUEST_STATUSES).optional(),
  publicTitle: text(120).min(3, "The public title can't be empty").optional(),
  hidden: z.boolean().optional(),
  responseToCentre: z.string().trim().max(4000).nullable().optional().transform((s) => (s ? s : s === undefined ? undefined : null)),
});
