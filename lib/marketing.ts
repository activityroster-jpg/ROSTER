import { PROSPECT_STATUSES, type ProspectStatus } from "@/lib/db/schema";
import { COMPANY } from "@/lib/config";

/** Labels + pill tones for the outreach pipeline stages. `short` is for the compact checkbox list. */
export const PROSPECT_STATUS_META: Record<ProspectStatus, { label: string; short: string; tone: "neutral" | "attention" | "teal" | "covered" | "conflict" }> = {
  new: { label: "New", short: "New", tone: "neutral" },
  letter_sent: { label: "Letter sent", short: "Letter", tone: "attention" },
  email_sent: { label: "Email sent", short: "Email", tone: "attention" },
  linkedin_contacted: { label: "LinkedIn contacted", short: "LinkedIn", tone: "teal" },
  called: { label: "Called", short: "Called", tone: "teal" },
  purchased: { label: "Purchased", short: "Purchased", tone: "covered" },
  rejected: { label: "Rejected", short: "Rejected", tone: "conflict" },
};

export const PROSPECT_STATUS_ORDER: ProspectStatus[] = [
  "new", "letter_sent", "email_sent", "linkedin_contacted", "called", "purchased", "rejected",
];

/** Parse the stored `statuses` JSON array, falling back to the single `status`. */
export function parseProspectStatuses(raw: string | null | undefined, fallback: ProspectStatus): ProspectStatus[] {
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        const valid = arr.filter((s): s is ProspectStatus => (PROSPECT_STATUSES as readonly string[]).includes(s));
        return valid;
      }
    } catch {
      // fall through
    }
  }
  return [fallback];
}

/** The most-advanced selected status (used to keep the single `status` column meaningful). */
export function primaryProspectStatus(statuses: ProspectStatus[]): ProspectStatus {
  const chosen = PROSPECT_STATUS_ORDER.filter((s) => statuses.includes(s));
  return chosen[chosen.length - 1] ?? "new";
}

/** How far along the pipeline a prospect is (0 = new … 6 = rejected), for sorting by status. */
export function prospectStatusRank(statuses: ProspectStatus[]): number {
  return PROSPECT_STATUS_ORDER.indexOf(primaryProspectStatus(statuses));
}

/**
 * The five pipeline stages shown on the board and in the Status dropdown
 * (decided 6 Oct), in board order. They are worked out from the stored
 * touchpoints, so nothing stored had to change: Signed up = purchased,
 * Rejected = rejected, then LinkedIn contacted, then Letter sent; anything
 * else (new, or only emailed or called) is "No letter sent".
 */
export const PIPELINE_STAGES = ["rejected", "none", "letter", "linkedin", "signed_up"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_META: Record<PipelineStage, { label: string; accent: string; chip: string }> = {
  rejected: { label: "Rejected", accent: "border-port", chip: "bg-port/15 text-port" },
  none: { label: "No letter sent", accent: "border-slate-300", chip: "bg-slate-100 text-slate-600" },
  letter: { label: "Letter sent", accent: "border-amber", chip: "bg-amber/15 text-amber" },
  linkedin: { label: "LinkedIn contacted", accent: "border-teal", chip: "bg-teal/15 text-teal" },
  signed_up: { label: "Signed up", accent: "border-starboard", chip: "bg-starboard/15 text-starboard" },
};

export function stageOf(statuses: readonly ProspectStatus[]): PipelineStage {
  if (statuses.includes("purchased")) return "signed_up";
  if (statuses.includes("rejected")) return "rejected";
  if (statuses.includes("linkedin_contacted")) return "linkedin";
  if (statuses.includes("letter_sent")) return "letter";
  return "none";
}

/** Sort order "furthest along first" for the Status column: signed up, LinkedIn, letter, none, rejected. */
export function stageRank(stage: PipelineStage): number {
  return { rejected: 0, none: 1, letter: 2, linkedin: 3, signed_up: 4 }[stage];
}

/**
 * The stored touchpoints after moving a prospect to a stage. Emails and calls
 * already logged are kept; touchpoints that belong to a later stage are cleared,
 * so the prospect lands in exactly the stage chosen.
 */
export function statusesForStage(current: readonly ProspectStatus[], stage: PipelineStage): ProspectStatus[] {
  const keep = current.filter((s) => s === "email_sent" || s === "called" || (s === "letter_sent" && (stage === "letter" || stage === "linkedin" || stage === "signed_up" || stage === "rejected")));
  const add: Record<PipelineStage, ProspectStatus[]> = {
    none: [],
    letter: ["letter_sent"],
    linkedin: ["linkedin_contacted"],
    signed_up: ["purchased"],
    rejected: ["rejected"],
  };
  // LinkedIn, signed up and rejected keep an earlier LinkedIn contact on record.
  if ((stage === "signed_up" || stage === "rejected") && current.includes("linkedin_contacted")) keep.push("linkedin_contacted");
  const next = Array.from(new Set([...keep, ...add[stage]]));
  return next.length ? next : ["new"];
}

/** Red: rejected. Green: signed up. Orange: engaged (replied, met, asked for more). Null: no signal yet. */
export type Vibe = "red" | "orange" | "green" | null;
export function vibeOf(stage: PipelineStage, engaged: boolean): Vibe {
  if (stage === "rejected") return "red";
  if (stage === "signed_up") return "green";
  return engaged ? "orange" : null;
}

export const VIBE_META: Record<"red" | "orange" | "green" | "none", { label: string; dot: string }> = {
  red: { label: "Rejected", dot: "bg-port" },
  orange: { label: "Engaged", dot: "bg-amber" },
  green: { label: "Signed up", dot: "bg-starboard" },
  none: { label: "No reply yet", dot: "bg-slate-200" },
};

/** An address is postable only when it has a street line, a town and a postcode. */
export function addressComplete(p: { addressLine1?: string | null; city?: string | null; postcode?: string | null }): boolean {
  return Boolean((p.addressLine1 ?? "").trim() && (p.city ?? "").trim() && (p.postcode ?? "").trim());
}

/**
 * The plain-text signature for drafts opened in a mail app (a mailto link can
 * only carry plain text). Gmail drafts leave it off, and the "Kind regards,
 * Conor" sign-off with it: Gmail adds Conor's saved signature (sign-off and
 * the logo image, public/brand/email-signature.png) by itself.
 */
const [street, town, postcode, country] = COMPANY.addressLines;
export const EMAIL_SIGNATURE: readonly string[] = [
  COMPANY.name,
  "Compliance-aware rostering for sailing & watersports centres",
  "activityroster.com · hello@activityroster.com",
  "",
  `${COMPANY.name} is a trading name of ${COMPANY.legalName}, registered in England & Wales, company number ${COMPANY.companyNumber}.`,
  `Registered office: ${street}, ${town} ${postcode}, ${country}.`,
];

/** A ready-to-send outreach email draft for a prospect (used for the mailto: button). */
export function draftProspectEmail(p: { name: string; contactName?: string | null }, opts: { signature?: boolean } = {}): { subject: string; body: string } {
  const greeting = p.contactName?.trim() ? p.contactName.trim() : "there";
  const subject = `Staff rostering & compliance for ${p.name}`;
  const body = [
    `Hi ${greeting},`,
    "",
    `I'm getting in touch about ActivityRoster — a staff-rostering and compliance tool built specifically for RYA training centres and clubs like ${p.name}.`,
    "",
    "It rosters instructors across your courses while automatically checking RYA ratios, safety-boat cover and each instructor's qualifications and licences; tracks DBS, first aid and safeguarding expiry; and lets staff submit availability, log hours and request leave from their phone.",
    "",
    `No two centres run quite the same way, so we're happy to tailor it to how ${p.name} works. The first month is completely free, with no card required, so you can set it up and run a real week before deciding.`,
    "",
    "Would you be open to a short call, or shall I send over a link to look around?",
    // Gmail drafts stop here: Conor's Gmail signature already carries the
    // sign-off and the logo, so adding them again would double them up.
    ...(opts.signature === false ? [] : ["", "Kind regards,", LETTER_SENDER.signOffName, "", ...EMAIL_SIGNATURE]),
  ].join("\n");
  return { subject, body };
}

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
  signOffName: "Conor",
};
