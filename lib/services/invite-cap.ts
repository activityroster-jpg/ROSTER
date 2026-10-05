import type { ControlPlaneRepository } from "@/lib/db/repositories/control-plane";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import type { Database } from "@/lib/db/client";
import { DEFAULT_PRICING } from "@/lib/pricing";

const DAY = 86_400_000;

/**
 * Fair use (decided 5 Oct): one centre sends at most `inviteDailyCap`
 * invitation emails a day (UK day boundaries don't matter here; the window is
 * the UTC day). Ordinary centres never notice; it stops the platform being
 * used to mass-mail strangers, which would hurt the sender reputation every
 * centre's sign-in codes rely on. Held-back invitations go the next day.
 */
export async function inviteDailyCap(db: Database): Promise<number> {
  try { return (await new PlatformRepository(db).getPricing()).inviteDailyCap ?? DEFAULT_PRICING.inviteDailyCap; } catch { return DEFAULT_PRICING.inviteDailyCap; }
}

/** Count one invitation against today's allowance. False when the centre has used it up. */
export async function takeInviteSlot(control: ControlPlaneRepository, organisationId: string, cap: number, now = Date.now()): Promise<boolean> {
  const window = Math.floor(now / DAY);
  const count = await control.hitRateLimit(`invite-day:${organisationId}`, window, new Date((window + 1) * DAY));
  return count <= cap;
}
