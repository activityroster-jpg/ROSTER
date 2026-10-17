/**
 * Recruiting on Boaty Jobs: the rules, pure (no DB, no framework, no I/O).
 *
 * A centre writes job posts in ActivityRoster (the master copy); they are
 * published to Boaty Jobs (boatyjobs.com, also run by ActiveRoster Ltd), which
 * displays them and emails applications to the centre. Free posting is a perk
 * of an ActivityRoster plan.
 */

export const BOATY_JOBS_NAME = "Boaty Jobs";
/** Live (or on their way to live) listings a centre may have at once. */
export const MAX_LIVE_JOBS = 5;
/** How long a listing lasts before it needs renewing (or until its closing date, if sooner). */
export const LISTING_DAYS = 60;
/** A sync call that is still failing this long after it was queued gives up: the job shows "sync failed" and a Retry button. */
export const SYNC_GIVE_UP_MS = 24 * 60 * 60 * 1000;
export const DESCRIPTION_MAX = 5000;

const DAY = 24 * 60 * 60 * 1000;

export type JobStatusLike = "draft" | "publishing" | "live" | "closed" | "expired" | "removed" | "sync_failed";

export interface JobStateLike {
  status: JobStatusLike;
  /** Set once Boaty Jobs has the listing. */
  listingId: string | null;
}

// --- Who may post ---------------------------------------------------------------

export interface PostingAccessInput {
  /** The centre's status (control plane). */
  orgStatus: "active" | "suspended" | "pending" | "cancelled";
  /** Stripe subscription status, or null for a centre that has never paid. */
  subscriptionStatus: string | null;
  /** The trial clock (lib/billing/trial): "trial" while the free trial runs. */
  trialKind: "paid" | "trial" | "read_only" | "locked";
  /** The request context is read-only (trial over, or payment overdue past the grace period). */
  readOnly: boolean;
}

export type PostingAccess = { kind: "post" } | { kind: "read_only"; reason: string };

export const REACTIVATE_MESSAGE = "Reactivate your plan to post jobs.";

/**
 * Posting is open to a centre on any paying plan (monthly or annual) or an
 * active free trial. A frozen (read-only) or cancelled centre still sees its
 * jobs, read-only.
 */
export function postingAccess(i: PostingAccessInput): PostingAccess {
  const frozen = { kind: "read_only", reason: REACTIVATE_MESSAGE } as const;
  if (i.orgStatus !== "active" || i.readOnly) return frozen;
  if (i.trialKind === "trial") return { kind: "post" };
  // Paying: active, or a failed payment still inside its grace period (not yet read-only).
  if (i.subscriptionStatus === "active" || i.subscriptionStatus === "past_due") return { kind: "post" };
  return frozen;
}

// --- The 5-live cap ---------------------------------------------------------------

/** Does this job take one of the centre's live slots? Live, being published, or failed to sync while still listed. */
export function takesLiveSlot(j: JobStateLike): boolean {
  return j.status === "live" || j.status === "publishing" || (j.status === "sync_failed" && Boolean(j.listingId));
}

export function liveSlotsUsed(jobs: readonly JobStateLike[]): number {
  return jobs.filter(takesLiveSlot).length;
}

/** May one more job go live? (A job that already holds a slot, e.g. renewing a live one, doesn't need another.) */
export function canTakeSlot(jobs: readonly (JobStateLike & { id: string })[], jobId: string): boolean {
  const self = jobs.find((j) => j.id === jobId);
  if (self && takesLiveSlot(self)) return true;
  return liveSlotsUsed(jobs) < MAX_LIVE_JOBS;
}

// --- What a centre can do with a job, by status ---------------------------------

export function canEdit(j: JobStateLike): boolean {
  return j.status !== "removed" && j.status !== "publishing";
}
/** First publish (draft), or try again after a publish that never reached Boaty Jobs. */
export function canPublish(j: JobStateLike): boolean {
  return j.status === "draft" || (j.status === "sync_failed" && !j.listingId);
}
export function canClose(j: JobStateLike): boolean {
  return j.status === "live" || (j.status === "sync_failed" && Boolean(j.listingId));
}
/** Renew: republish for another LISTING_DAYS (a live, expired or closed listing). Removed listings can't come back. */
export function canRenew(j: JobStateLike): boolean {
  return j.status === "live" || j.status === "expired" || j.status === "closed";
}
export function canDelete(j: JobStateLike): boolean {
  return j.status === "draft" && !j.listingId;
}
/** Editing a job that Boaty Jobs is showing sends the change straight away. */
export function editNeedsSync(j: JobStateLike): boolean {
  return j.status === "live" || (j.status === "sync_failed" && Boolean(j.listingId));
}

// --- Dates ------------------------------------------------------------------------

/** End of a YYYY-MM-DD day, UK time is close enough here: 23:59:59 UTC. */
function endOfDay(iso: string): number {
  return Date.parse(`${iso}T23:59:59Z`);
}

/** When a listing published now ends: LISTING_DAYS from now, or the closing date if sooner. */
export function listingEndsAt(now: number, closingDate: string): number {
  return Math.min(now + LISTING_DAYS * DAY, endOfDay(closingDate));
}

/** Has a live listing run out (in case the expiry webhook never arrives)? */
export function hasLapsed(expiresAt: number | null, now: number): boolean {
  return expiresAt !== null && now > expiresAt;
}

// --- The seasonal dashboard card ---------------------------------------------------

/** Hiring season for the card: 1 December to 30 April. */
export function inHiringSeason(now: Date): boolean {
  const m = now.getUTCMonth(); // 0 = Jan
  return m === 11 || m <= 3;
}

/** When the season containing `now` began (1 December, UTC). */
export function seasonStart(now: Date): number {
  const y = now.getUTCMonth() === 11 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return Date.UTC(y, 11, 1);
}

/** Show the "Hiring for the season?" card: in season, and not dismissed since this season began. */
export function showHiringCard(now: Date, dismissedAt: number | null): boolean {
  if (!inHiringSeason(now)) return false;
  return dismissedAt === null || dismissedAt < seasonStart(now);
}

// --- Retries --------------------------------------------------------------------------

/** Wait before the next attempt: 1, 2, 4 … minutes, at most an hour. */
export function backoffMs(attempts: number): number {
  return Math.min(60, 2 ** Math.max(0, attempts - 1)) * 60 * 1000;
}

/** Give up (sync failed) once the call has been failing for SYNC_GIVE_UP_MS since it was queued. */
export function shouldGiveUp(queuedAt: number, now: number): boolean {
  return now - queuedAt >= SYNC_GIVE_UP_MS;
}

// --- The payload (shared contract with Boaty Jobs) -------------------------------------

export type BoatyRegion = "England" | "Scotland" | "Wales" | "Northern Ireland";
export const REGION_OPTIONS: { value: string; label: BoatyRegion }[] = [
  { value: "england", label: "England" },
  { value: "scotland", label: "Scotland" },
  { value: "wales", label: "Wales" },
  { value: "northern_ireland", label: "Northern Ireland" },
];

/** The listing's region: the centre's own choice, else its jurisdiction when that is a UK nation. */
export function regionFor(override: string | null | undefined, jurisdiction: string): BoatyRegion | null {
  const pick = (v: string | null | undefined) => REGION_OPTIONS.find((r) => r.value === v)?.label ?? null;
  return pick(override) ?? pick(jurisdiction);
}

export interface PayloadCentre {
  id: string;
  name: string;
  town: string;
  postcode: string;
  region: BoatyRegion | null;
  website: string;
  logoUrl: string;
}

export interface PayloadJob {
  id: string;
  title: string;
  roleType: string;
  employmentType: string;
  positions: number;
  startDate: string;
  endDate: string | null;
  payType: string;
  payAmountGbp: number | null;
  accommodation: boolean;
  locationText: string;
  requiredQualifications: string[];
  description: string;
  closingDate: string;
  applicationEmail: string;
}

export interface BoatyJobPayload {
  external_id: string;
  centre: { activityroster_centre_id: string; name: string; town: string; postcode: string; region: BoatyRegion | ""; website: string; logo_url: string };
  job: {
    title: string;
    role_type: string;
    employment_type: string;
    positions: number;
    start_date: string;
    end_date: string | null;
    pay: { type: string; amount_gbp: number | null };
    accommodation: boolean;
    location_text: string;
    required_qualifications: string[];
    description: string;
    closing_date: string;
    application_email: string;
  };
}

/** Pay types where an amount doesn't apply. */
export const PAY_WITHOUT_AMOUNT = ["competitive", "volunteer"];

export function buildPayload(job: PayloadJob, centre: PayloadCentre): BoatyJobPayload {
  return {
    external_id: job.id,
    centre: {
      activityroster_centre_id: centre.id,
      name: centre.name,
      town: centre.town,
      postcode: centre.postcode,
      region: centre.region ?? "",
      website: centre.website,
      logo_url: centre.logoUrl,
    },
    job: {
      title: job.title,
      role_type: job.roleType,
      employment_type: job.employmentType,
      positions: job.positions,
      start_date: job.startDate,
      end_date: job.endDate || null,
      pay: { type: job.payType, amount_gbp: PAY_WITHOUT_AMOUNT.includes(job.payType) ? null : job.payAmountGbp },
      accommodation: job.accommodation,
      location_text: job.locationText,
      required_qualifications: job.requiredQualifications,
      description: job.description.slice(0, DESCRIPTION_MAX),
      closing_date: job.closingDate,
      application_email: job.applicationEmail,
    },
  };
}

/** Parse the stored JSON qualification list, tolerating anything odd. */
export function parseQualifications(raw: string | null | undefined): string[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// --- Labels -------------------------------------------------------------------------------

export const ROLE_TYPE_LABEL: Record<string, string> = {
  dinghy_instructor: "Dinghy instructor",
  senior_instructor: "Senior instructor",
  assistant_instructor: "Assistant instructor",
  powerboat_instructor: "Powerboat instructor",
  windsurf_instructor: "Windsurf instructor",
  paddlesport_instructor: "Paddlesport instructor",
  safety_boat_driver: "Safety boat driver",
  office_admin: "Office / admin",
  other: "Other",
};
export const EMPLOYMENT_LABEL: Record<string, string> = { seasonal: "Seasonal", part_time: "Part-time", full_time: "Full-time", volunteer: "Volunteer" };
export const PAY_LABEL: Record<string, string> = { hourly: "Per hour", daily: "Per day", weekly: "Per week", season: "For the season", salary: "Salary (per year)", competitive: "Competitive", volunteer: "Volunteer (unpaid)" };
export const STATUS_LABEL: Record<JobStatusLike, string> = {
  draft: "Draft",
  publishing: "Publishing…",
  live: "Live on Boaty Jobs",
  closed: "Closed",
  expired: "Expired",
  removed: "Removed by Boaty Jobs",
  sync_failed: "Couldn't reach Boaty Jobs",
};
