import type { OrgTier } from "@/lib/db/schema";

/**
 * Pricing tiers — pure config + helpers, no DB or I/O.
 *
 * Two flat per-centre tiers:
 *  - Small Club: a lower flat price for small teams, HARD-capped at
 *    {@link SMALL_CLUB_CAP} people (every instructor record counts — volunteers
 *    included, no exemptions). Adding the 11th is blocked with a prompt to
 *    upgrade.
 *  - Standard: the headline flat price, unlimited team.
 *
 * Prices are flat per centre (never per user), which is the whole pitch against
 * the per-seat competitors — see lib/pricing competitorMonthly/tierSaving.
 */

/** Hard team-size limit on the Small Club tier (counts every instructor). */
export const SMALL_CLUB_CAP = 10;

export interface TierMeta {
  id: OrgTier;
  name: string;
  /** Flat monthly price for the whole centre, GBP. */
  monthlyPrice: number;
  /** Flat annual price (2 months free vs monthly), GBP. */
  annualPrice: number;
  /** Max instructor headcount; null = unlimited. */
  userCap: number | null;
  tagline: string;
}

export const TIERS: Record<OrgTier, TierMeta> = {
  small_club: {
    id: "small_club",
    name: "Small Club",
    monthlyPrice: 35,
    annualPrice: 350,
    userCap: SMALL_CLUB_CAP,
    tagline: `For smaller centres — up to ${SMALL_CLUB_CAP} people on your team.`,
  },
  standard: {
    id: "standard",
    name: "Standard",
    monthlyPrice: 65,
    annualPrice: 650,
    userCap: null,
    tagline: "For busy centres — unlimited instructors and volunteers.",
  },
};

/** Display order for marketing (cheapest first). */
export const TIER_ORDER: OrgTier[] = ["small_club", "standard"];

/** The tier a centre should be nudged to upgrade to when it outgrows its cap. */
export const UPGRADE_TIER: OrgTier = "standard";

/** Metadata for a tier, falling back to Standard for any unknown value. */
export function tierMeta(tier: OrgTier | null | undefined): TierMeta {
  return (tier && TIERS[tier]) || TIERS.standard;
}

/** The headcount cap for a tier (null = unlimited). */
export function tierCap(tier: OrgTier | null | undefined): number | null {
  return tierMeta(tier).userCap;
}

/** Can a centre on this tier hold `currentCount` people (room for one more)? */
export function isWithinTierCap(tier: OrgTier | null | undefined, currentCount: number): boolean {
  const cap = tierCap(tier);
  return cap == null || currentCount < cap;
}

/** Slots left before the cap (null = unlimited). Never negative. */
export function tierSlotsRemaining(tier: OrgTier | null | undefined, currentCount: number): number | null {
  const cap = tierCap(tier);
  return cap == null ? null : Math.max(0, cap - currentCount);
}
