import { courseStateAvailable } from "./assign-order";
import type { PlaceFacts } from "./teaching";

/**
 * A person offered for a place on a course, and what stands in their way.
 * Plain functions with no framework, so the course page (a server component)
 * and the course pickers (client components) share them.
 */
export interface SlotCandidate {
  id: string; name: string; fit: boolean; reason?: string; avail?: string;
  /** Their instructor types cover this course type; false = they don't; null = nothing on file for them (not judged). */
  qualified?: boolean | null;
  /** The places (role ids) they can fill: their instructor types, or a lower place on the same ladder. Absent = not judged. */
  fills?: string[];
  /** "Youth Stage 3 (Mon AM)" when they are on another course at the same time. */
  busyWith?: string;
}

/** A place on the course, as the checks need it. */
export interface SlotPlace extends PlaceFacts { rank?: number }

/**
 * The candidate's qualification problem in this place, the same two checks as
 * lib/domain/teaching placeFitIssue: a teaching place needs someone whose types
 * cover the course ("course"); an instructor-type place needs that type or a
 * higher one on its ladder ("place"). Nobody is judged with nothing on file.
 */
export function placeIssueOf(c: SlotCandidate, place: PlaceFacts | undefined): "course" | "place" | null {
  if (c.qualified == null) return null;
  if ((!place || place.countsTowardRatio) && c.qualified === false) return "course";
  if (place?.qualificationTypeId && c.fills && !c.fills.includes(place.id)) return "place";
  return null;
}

/** Why someone sits where they do in the list, in plain words. */
export function candidateNote(c: SlotCandidate, place?: PlaceFacts): string {
  const bits: string[] = [];
  const q = placeIssueOf(c, place);
  if (!c.fit) bits.push(c.reason || "not cleared to roster");
  if (q === "course") bits.push("not qualified for this course type");
  else if (q === "place") bits.push(`not a ${place?.name ?? "holder of this type"}`);
  if (c.busyWith) bits.push(`on another course: ${c.busyWith}`);
  else if (c.avail === "unavailable") bits.push("said they're busy");
  else if (c.avail === "partial") bits.push("only partly free");
  else if (c.avail === "silent") bits.push("hasn't answered (counts as busy)");
  else if (c.avail === "unset") bits.push("not asked yet");
  else if (c.avail === "available") bits.push("free");
  return bits.join(" · ");
}
export const candidateFactsOf = (c: SlotCandidate, place?: PlaceFacts) => ({ fit: c.fit, qualified: c.qualified == null ? null : placeIssueOf(c, place) === null, available: courseStateAvailable(c.avail) && !c.busyWith });

/** What stands in the way of this person in this place on this course: each line is a block the office can override. Empty = nothing. */
export function issuesOf(c: SlotCandidate | undefined, place?: PlaceFacts): string[] {
  if (!c) return [];
  const out: string[] = [];
  const q = placeIssueOf(c, place);
  if (!c.fit) out.push(`Not cleared to roster: ${c.reason ?? "a check isn't met"}.`);
  if (q === "course") out.push("Their instructor types don't cover this course.");
  else if (q === "place") out.push(`Not a ${place?.name ?? "holder of this instructor type"} (or higher on that ladder).`);
  if (c.busyWith) out.push(`Already on ${c.busyWith}.`);
  else if (c.avail === "unavailable") out.push("Busy in their availability.");
  else if (c.avail === "silent") out.push("Hasn't answered about availability (counts as busy).");
  return out;
}
