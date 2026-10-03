import type { Organisation } from "@/lib/db/schema";
import type { Repositories } from "@/lib/db/repositories";
import { tierCap, tierMeta, UPGRADE_TIER, TIERS } from "@/lib/tiers";
import { ne } from "drizzle-orm";
import { instructor as instructorTable } from "@/lib/db/schema";
import type { AnyTenantContext } from "./context";

/**
 * Pricing-tier limits enforced at the point of adding people.
 *
 * The Small Club tier is HARD-capped: every instructor record counts toward the
 * limit (volunteers included — no exemptions), and the cap is checked live
 * against the current headcount before an insert. Standard is unlimited.
 */

export interface InstructorCapState {
  /** The cap for the centre's tier, or null when unlimited. */
  cap: number | null;
  /** Current instructor headcount. */
  used: number;
  /** Slots left before the cap (null = unlimited). */
  remaining: number | null;
  /** True when the centre is at (or over) its cap — no room to add. */
  full: boolean;
}

/** Live headcount vs the centre's tier cap. */
export async function instructorCapState(
  repos: Repositories,
  ctx: AnyTenantContext,
  org: Pick<Organisation, "tier">,
): Promise<InstructorCapState> {
  const cap = tierCap(org.tier);
  // Pending join requests are not yet on the team; they are checked at approval.
  const used = await repos.tenant.instructor.count(ctx, ne(instructorTable.status, "pending"));
  if (cap == null) return { cap, used, remaining: null, full: false };
  return { cap, used, remaining: Math.max(0, cap - used), full: used >= cap };
}

/** The upgrade prompt shown when a centre hits its cap. */
export function capUpgradeMessage(org: Pick<Organisation, "tier">): string {
  const m = tierMeta(org.tier);
  const next = TIERS[UPGRADE_TIER];
  return `You've reached the ${m.name} limit of ${m.userCap} people. Upgrade to ${next.name} for unlimited instructors and volunteers.`;
}
