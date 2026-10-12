/**
 * The order people appear in wherever someone is assigned: those who can do
 * the course and are free first (green), then those who can do it but aren't
 * free (orange), then those who can't (red: not qualified for the course type,
 * or not cleared to roster). Pure; every picker on the platform uses it.
 */
export type CandidateTier = "ready" | "busy" | "blocked";

export interface CandidateFacts {
  /** Cleared to roster (licence checks). */
  fit: boolean;
  /** Can teach this course type; null when nothing is recorded (not held against them). */
  qualified: boolean | null;
  /** Free for the session(s), or not asked yet (nothing blocks). */
  available: boolean;
}

export const TIER_ORDER: readonly CandidateTier[] = ["ready", "busy", "blocked"];
export const TIER_DOT: Record<CandidateTier, string> = { ready: "🟢", busy: "🟠", blocked: "🔴" };
export const TIER_LABEL: Record<CandidateTier, string> = { ready: "Qualified and free", busy: "Qualified, not free", blocked: "Not qualified or not cleared" };

export function candidateTier(f: CandidateFacts): CandidateTier {
  if (!f.fit || f.qualified === false) return "blocked";
  return f.available ? "ready" : "busy";
}

/** Sorted copy: by tier, then name. */
export function sortCandidates<T>(xs: readonly T[], facts: (x: T) => CandidateFacts, name: (x: T) => string): T[] {
  return [...xs].sort((a, b) => TIER_ORDER.indexOf(candidateTier(facts(a))) - TIER_ORDER.indexOf(candidateTier(facts(b))) || name(a).localeCompare(name(b)));
}

/** The same, grouped for a dropdown's headings; empty groups are left out. */
export function groupCandidates<T>(xs: readonly T[], facts: (x: T) => CandidateFacts, name: (x: T) => string): { tier: CandidateTier; items: T[] }[] {
  const sorted = sortCandidates(xs, facts, name);
  return TIER_ORDER.map((tier) => ({ tier, items: sorted.filter((x) => candidateTier(facts(x)) === tier) })).filter((g) => g.items.length > 0);
}

/** A course-level availability state (lib/domain/availability) counts as free unless they said Busy, are partly busy, or haven't answered inside the window. */
export function courseStateAvailable(state: string | undefined | null): boolean {
  return !(state === "unavailable" || state === "partial" || state === "silent");
}
