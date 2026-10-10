/**
 * A save made from a page that was loaded before a new version went live:
 * the page holds the old version's server actions, which the new version
 * doesn't recognise. Reloading fixes it. Not a bug, so never reported as one.
 */
export const STALE_ACTION = /Server Action .*(not found|was not found)|Failed to find Server Action|unexpected response was received from the server/i;

export function isStaleActionError(message: string | null | undefined): boolean {
  return !!message && STALE_ACTION.test(message);
}
