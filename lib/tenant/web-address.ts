/**
 * The rule for changing a centre's web address ({slug}.activityroster.com):
 * the owner may change it once, within 30 days of signing up. After that it is
 * fixed, because every link the team has been sent points at it. Plain module
 * (no "use server") so both pages and actions can import it.
 */
export const SLUG_CHANGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Whole days left in which the address may still be changed (0 when the window has passed). */
export function slugChangeDaysLeft(createdAt: Date | number, now = Date.now()): number {
  const created = createdAt instanceof Date ? createdAt.getTime() : Number(createdAt);
  return Math.max(0, Math.ceil((created + SLUG_CHANGE_WINDOW_MS - now) / 86_400_000));
}
