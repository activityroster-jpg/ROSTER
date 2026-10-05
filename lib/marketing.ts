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

/** An address is postable only when it has a street line, a town and a postcode. */
export function addressComplete(p: { addressLine1?: string | null; city?: string | null; postcode?: string | null }): boolean {
  return Boolean((p.addressLine1 ?? "").trim() && (p.city ?? "").trim() && (p.postcode ?? "").trim());
}

/**
 * The email signature under every outreach draft. Plain text, because a Gmail
 * compose link or a mailto link can only carry plain text (no logo).
 */
const [street, town, postcode, country] = COMPANY.addressLines;
export const EMAIL_SIGNATURE: readonly string[] = [
  COMPANY.name,
  "Compliance-aware rostering for sailing & watersports centres",
  "activityroster.com · hello@activityroster.com",
  "",
  `${COMPANY.name} is a trading name of ${COMPANY.legalName}, registered in England & Wales.`,
  `Registered office: ${street}, ${town} ${postcode}, ${country}.`,
];

/** A ready-to-send outreach email draft for a prospect (used for the mailto: button). */
export function draftProspectEmail(p: { name: string; contactName?: string | null }): { subject: string; body: string } {
  const greeting = p.contactName?.trim() ? p.contactName.trim() : "there";
  const subject = `Staff rostering & compliance for ${p.name}`;
  const body = [
    `Hi ${greeting},`,
    "",
    `I'm getting in touch about ActivityRoster — a staff-rostering and compliance tool built specifically for RYA training centres and clubs like ${p.name}.`,
    "",
    "It rosters instructors across your courses while automatically checking RYA ratios, safety-boat cover and each instructor's qualifications and tickets; tracks DBS, first aid and safeguarding expiry; and lets staff submit availability, log hours and request leave from their phone.",
    "",
    `No two centres run quite the same way, so we're happy to tailor it to how ${p.name} works. The first month is completely free, with no card required, so you can set it up and run a real week before deciding.`,
    "",
    "Would you be open to a short call, or shall I send over a link to look around?",
    "",
    "Kind regards,",
    `${LETTER_SENDER.signOffName}`,
    "",
    ...EMAIL_SIGNATURE,
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
