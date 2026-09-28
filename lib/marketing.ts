import type { ProspectStatus } from "@/lib/db/schema";

/** Labels + pill tones for the outreach pipeline stages. */
export const PROSPECT_STATUS_META: Record<ProspectStatus, { label: string; tone: "neutral" | "attention" | "teal" | "covered" | "conflict" }> = {
  new: { label: "New", tone: "neutral" },
  letter_sent: { label: "Letter sent", tone: "attention" },
  email_sent: { label: "Email sent", tone: "attention" },
  linkedin_contacted: { label: "LinkedIn contacted", tone: "teal" },
  called: { label: "Called", tone: "teal" },
  purchased: { label: "Purchased", tone: "covered" },
  rejected: { label: "Rejected", tone: "conflict" },
};

export const PROSPECT_STATUS_ORDER: ProspectStatus[] = [
  "new", "letter_sent", "email_sent", "linkedin_contacted", "called", "purchased", "rejected",
];

/**
 * Sender block printed on outreach letters. Edit these to your real details —
 * they appear top-right on the letter (the recipient address sits in the C5
 * window). Kept in code (not secret) so it's one place to change.
 */
export const LETTER_SENDER = {
  name: "ActivityRoster",
  tagline: "Staff rostering for RYA centres",
  line1: "",
  line2: "",
  city: "",
  postcode: "",
  email: "hello@activityroster.com",
  website: "activityroster.com",
  signOffName: "The ActivityRoster team",
};
