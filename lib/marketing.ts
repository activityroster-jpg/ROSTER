import { PROSPECT_STATUSES, type LinkedinStatus, type ProspectStatus } from "@/lib/db/schema";
import { COMPANY } from "@/lib/config";

/** Labels + pill tones for every stored status. `short` is for compact chips. */
export const PROSPECT_STATUS_META: Record<ProspectStatus, { label: string; short: string; tone: "neutral" | "attention" | "teal" | "covered" | "conflict" }> = {
  new: { label: "New", short: "New", tone: "neutral" },
  ready_to_send: { label: "Ready to send", short: "Ready", tone: "neutral" },
  letter_sent: { label: "Letter sent", short: "Letter", tone: "attention" },
  flyer_sent: { label: "Flyer sent", short: "Flyer", tone: "attention" },
  booklet_sent: { label: "Booklet sent", short: "Booklet", tone: "teal" },
  email_sent: { label: "Emailed", short: "Email", tone: "attention" },
  linkedin_contacted: { label: "LinkedIn contacted", short: "LinkedIn", tone: "teal" },
  called: { label: "Called", short: "Called", tone: "teal" },
  purchased: { label: "Signed up", short: "Signed up", tone: "covered" },
  rejected: { label: "Rejected", short: "Rejected", tone: "conflict" },
};

/** Least to most advanced; the last one ticked is the single `status` column. Rejected outranks everything. */
export const PROSPECT_STATUS_ORDER: ProspectStatus[] = [
  "new", "email_sent", "called", "linkedin_contacted", "ready_to_send", "letter_sent", "flyer_sent", "booklet_sent", "purchased", "rejected",
];

/**
 * The postal outreach tickboxes on the Prospects list (10 Oct 2026). Several can
 * be ticked at once. "No action" is not stored: it is ticked when none of the
 * others are, and ticking it clears them.
 */
export const OUTREACH_TICKS = ["ready_to_send", "letter_sent", "flyer_sent", "booklet_sent", "rejected"] as const satisfies readonly ProspectStatus[];
export type OutreachTick = (typeof OUTREACH_TICKS)[number];
export const NO_ACTION_LABEL = "No action";

/** Parse the stored `statuses` JSON array, falling back to the single `status`. "new" means nothing ticked. */
export function parseProspectStatuses(raw: string | null | undefined, fallback: ProspectStatus): ProspectStatus[] {
  let list: ProspectStatus[] = [fallback];
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) list = arr.filter((s): s is ProspectStatus => (PROSPECT_STATUSES as readonly string[]).includes(s));
    } catch {
      // fall back to the single status
    }
  }
  return list.filter((s) => s !== "new");
}

/** No postal tick yet: the "No action" box. */
export function isNoAction(statuses: readonly ProspectStatus[]): boolean {
  return !statuses.some((s) => (OUTREACH_TICKS as readonly string[]).includes(s));
}

/**
 * Tick or untick one box. Ticking "No action" (null) clears the postal ticks;
 * other statuses (emailed, called, signed up) are kept.
 */
export function toggleOutreach(current: readonly ProspectStatus[], tick: OutreachTick | null, on: boolean): ProspectStatus[] {
  const others = current.filter((s) => !(OUTREACH_TICKS as readonly string[]).includes(s) && s !== "new");
  if (tick === null) return on ? others : [...current];
  const ticks = current.filter((s) => (OUTREACH_TICKS as readonly string[]).includes(s) && s !== tick);
  return Array.from(new Set([...others, ...ticks, ...(on ? [tick] : [])]));
}

/** The most-advanced selected status (keeps the single `status` column meaningful). */
export function primaryProspectStatus(statuses: readonly ProspectStatus[]): ProspectStatus {
  const chosen = PROSPECT_STATUS_ORDER.filter((s) => statuses.includes(s));
  return chosen[chosen.length - 1] ?? "new";
}

/** How far along a prospect is, for sorting by status. */
export function prospectStatusRank(statuses: readonly ProspectStatus[]): number {
  return PROSPECT_STATUS_ORDER.indexOf(primaryProspectStatus(statuses));
}

/**
 * The board's columns, in order, worked out from the ticks: the furthest one
 * wins (signed up, then rejected, then booklet, flyer, letter, ready to send);
 * anything else is "No action".
 */
export const PIPELINE_STAGES = ["rejected", "none", "ready", "letter", "flyer", "booklet", "signed_up"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_META: Record<PipelineStage, { label: string; accent: string; chip: string }> = {
  rejected: { label: "Rejected", accent: "border-port", chip: "bg-port/15 text-port" },
  none: { label: "No action", accent: "border-slate-300", chip: "bg-slate-100 text-slate-600" },
  ready: { label: "Ready to send", accent: "border-slate-500", chip: "bg-slate-200 text-slate-700" },
  letter: { label: "Letter sent", accent: "border-amber", chip: "bg-amber/15 text-amber" },
  flyer: { label: "Flyer sent", accent: "border-amber", chip: "bg-amber/15 text-amber" },
  booklet: { label: "Booklet sent", accent: "border-teal", chip: "bg-teal/15 text-teal" },
  signed_up: { label: "Signed up", accent: "border-starboard", chip: "bg-starboard/15 text-starboard" },
};

/** The status each board column stands for. */
const STAGE_STATUS: Record<PipelineStage, ProspectStatus | null> = {
  rejected: "rejected", none: null, ready: "ready_to_send", letter: "letter_sent", flyer: "flyer_sent", booklet: "booklet_sent", signed_up: "purchased",
};

export function stageOf(statuses: readonly ProspectStatus[]): PipelineStage {
  if (statuses.includes("purchased")) return "signed_up";
  if (statuses.includes("rejected")) return "rejected";
  if (statuses.includes("booklet_sent")) return "booklet";
  if (statuses.includes("flyer_sent")) return "flyer";
  if (statuses.includes("letter_sent")) return "letter";
  if (statuses.includes("ready_to_send")) return "ready";
  return "none";
}

/** Sort order "furthest along first": signed up, booklet, flyer, letter, ready, none, rejected. */
export function stageRank(stage: PipelineStage): number {
  return { rejected: 0, none: 1, ready: 2, letter: 3, flyer: 4, booklet: 5, signed_up: 6 }[stage];
}

/**
 * The ticks after dragging a prospect to a board column: what was posted
 * before it stays ticked, anything further along is cleared, and the column's
 * own status is added, so the prospect lands in exactly that column. Emails and
 * calls are kept.
 */
export function statusesForStage(current: readonly ProspectStatus[], stage: PipelineStage): ProspectStatus[] {
  const postal: PipelineStage[] = ["ready", "letter", "flyer", "booklet"];
  const keepPostal = (s: ProspectStatus) => {
    const st = (Object.keys(STAGE_STATUS) as PipelineStage[]).find((k) => STAGE_STATUS[k] === s);
    if (!st || !postal.includes(st)) return false;
    if (stage === "rejected" || stage === "signed_up") return true;
    return postal.includes(stage) && stageRank(st) < stageRank(stage);
  };
  const keep = current.filter((s) => s === "email_sent" || s === "called" || keepPostal(s));
  const own = STAGE_STATUS[stage];
  return Array.from(new Set([...keep, ...(own ? [own] : [])]));
}

/** LinkedIn tab: where contact stands with a centre. */
export const LINKEDIN_META: Record<LinkedinStatus, { label: string; chip: string }> = {
  not_contacted: { label: "Not contacted", chip: "bg-slate-100 text-slate-600" },
  no_response: { label: "Contacted, no response", chip: "bg-amber/15 text-amber" },
  responded: { label: "Contacted, responded", chip: "bg-starboard/15 text-starboard" },
  rejected: { label: "Rejected", chip: "bg-port/15 text-port" },
};

export interface LinkedinContact { name: string; role: string; url: string }

/** The people found for a centre on LinkedIn (stored JSON). */
export function parseLinkedinContacts(raw: string | null | undefined): LinkedinContact[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === "object")
      .map((c) => ({ name: String(c.name ?? "").slice(0, 120), role: String(c.role ?? "").slice(0, 120), url: String(c.url ?? "").slice(0, 300) }))
      .filter((c) => c.name || c.url);
  } catch {
    return [];
  }
}

/** One-click LinkedIn searches (people and company pages) for a centre: the office does the looking, nothing is scraped. */
export function linkedinSearchUrls(name: string): { people: string; companies: string } {
  const q = encodeURIComponent(name);
  return { people: `https://www.linkedin.com/search/results/people/?keywords=${q}`, companies: `https://www.linkedin.com/search/results/companies/?keywords=${q}` };
}

/**
 * The RYA services a directory entry lists ("Services: Training Centre, Club,
 * ICCTestCentre, OnBoard Club, Sailability Centre").
 */
export function servicesOf(notes: string | null | undefined): string[] {
  const m = /Services:\s*([^.]*)/i.exec(notes ?? "");
  return m ? m[1]!.split(",").map((x) => x.trim()).filter(Boolean) : [];
}

/** Regions a posted letter goes to (overseas centres are left out of the top 250). */
const POSTAL_REGIONS_OUT = new Set(["overseas"]);

/**
 * An estimate of a centre's size, for picking the biggest. The RYA directory
 * holds no member or fleet numbers, so this counts what it does hold: each RYA
 * service run (training centre, club, ICC test centre, on-board club,
 * Sailability), with a little extra for Royal and yacht clubs, and for having
 * a website and an email. Higher is bigger. Pure.
 */
export function sizeScore(p: { name: string; notes?: string | null; website?: string | null; email?: string | null }): number {
  const weights: Record<string, number> = { "training centre": 3, club: 3, icctestcentre: 2, "onboard club": 2, "sailability centre": 2 };
  let score = servicesOf(p.notes).reduce((n, sv) => n + (weights[sv.toLowerCase()] ?? 1), 0);
  if (/\broyal\b/i.test(p.name)) score += 3;
  if (/yacht club/i.test(p.name)) score += 2;
  else if (/sailing club|boat club|cruising club/i.test(p.name)) score += 1;
  if ((p.website ?? "").trim()) score += 1;
  if ((p.email ?? "").trim()) score += 0.5;
  return score;
}

export const TOP_N = 250;

/**
 * Rank 1..250 for the biggest centres: the ones pinned in first, then by the
 * size estimate (name breaks ties); overseas centres and the ones pinned out
 * are skipped. Returns id → rank for the top 250 only. Pure.
 */
export function topRanks(prospects: readonly { id: string; name: string; region?: string | null; notes?: string | null; website?: string | null; email?: string | null; topPick?: boolean | null }[], n = TOP_N): Map<string, number> {
  const eligible = prospects.filter((p) => p.topPick !== false && !POSTAL_REGIONS_OUT.has((p.region ?? "").trim().toLowerCase()));
  const ranked = eligible
    .map((p) => ({ p, s: sizeScore(p) }))
    .sort((a, b) => Number(Boolean(b.p.topPick)) - Number(Boolean(a.p.topPick)) || b.s - a.s || a.p.name.localeCompare(b.p.name, "en", { sensitivity: "base" }));
  return new Map(ranked.slice(0, n).map(({ p }, i) => [p.id, i + 1]));
}

/** Printed already: a letter was printed (Ready to send) or posted (Letter sent). */
export function letterPrinted(statuses: readonly ProspectStatus[]): boolean {
  return statuses.includes("ready_to_send") || statuses.includes("letter_sent");
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
