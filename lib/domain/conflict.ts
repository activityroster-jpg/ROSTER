import { overlaps, type Interval } from "./time";

/**
 * Conflict detection over sessions.
 *
 * A conflict is the SAME resource (an instructor, or a tracked equipment unit)
 * booked on two sessions whose time windows overlap. Bulk (untracked) equipment
 * is not unit-conflicted here — only tracked units are.
 */

export interface ResourceBooking extends Interval {
  /** The session this booking belongs to. */
  readonly sessionId: string;
  /** The resource: an instructor id or a tracked-equipment id. */
  readonly resourceId: string;
  /** For messaging / grouping. */
  readonly courseId?: string;
  /** The session's day and slot (AM / PM / EV): what a slot-run centre compares. */
  readonly date?: string;
  readonly slot?: string;
}

/**
 * How a centre decides a clash. "slots" (the default way centres run): the
 * same person on two sessions in the same slot on the same day; different
 * slots never clash, whatever times were typed. "times" (centres that run to
 * set start and end times): the times overlap, and one ending at 13:00 with
 * the next starting at 13:00 does not count.
 */
export type ClashMode = "slots" | "times";

/** The centre's rule from its session style (Settings: AM/PM/EV slots, or set times). */
export const clashModeFor = (slotStyle: string | null | undefined): ClashMode => (slotStyle === "times" ? "times" : "slots");

/** Do these two bookings clash under the centre's rule? */
export function clashes(a: ResourceBooking, b: ResourceBooking, mode: ClashMode = "times"): boolean {
  if (a.sessionId === b.sessionId) return false;
  if (mode === "slots" && a.date && b.date && a.slot && b.slot) return a.date === b.date && a.slot === b.slot;
  return overlaps(a, b);
}

export interface Conflict {
  readonly resourceId: string;
  readonly a: ResourceBooking;
  readonly b: ResourceBooking;
}

/**
 * Find every pair of clashing bookings that share a resource. O(n log n)-ish
 * by grouping per resource then sorting by start; adequate for a centre's week.
 */
export function findConflicts(bookings: readonly ResourceBooking[], mode: ClashMode = "times"): Conflict[] {
  const byResource = new Map<string, ResourceBooking[]>();
  for (const b of bookings) {
    const arr = byResource.get(b.resourceId);
    if (arr) arr.push(b);
    else byResource.set(b.resourceId, [b]);
  }

  const conflicts: Conflict[] = [];
  for (const [resourceId, group] of byResource) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((x, y) => x.startAt - y.startAt);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i]!;
        const b = sorted[j]!;
        // By time: sessions are sorted by start, so once b starts at/after a
        // ends no later b can overlap a. By slot, keep looking (times may not
        // follow the slots).
        if (mode === "times" && b.startAt >= a.endAt) break;
        if (clashes(a, b, mode)) conflicts.push({ resourceId, a, b });
      }
    }
  }
  return conflicts;
}

/**
 * Slot-run centres: the same person on two sessions in DIFFERENT slots whose
 * typed times overlap (say a morning down as 09:00–13:30 and an afternoon from
 * 13:00). Not a clash, but worth a look: returned with the exact overlap.
 */
export function slotTimeOverlaps(bookings: readonly ResourceBooking[]): (Conflict & { from: number; to: number })[] {
  const out: (Conflict & { from: number; to: number })[] = [];
  const byResource = new Map<string, ResourceBooking[]>();
  for (const b of bookings) byResource.set(b.resourceId, [...(byResource.get(b.resourceId) ?? []), b]);
  for (const [resourceId, group] of byResource) {
    const sorted = [...group].sort((x, y) => x.startAt - y.startAt);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i]!;
        const b = sorted[j]!;
        if (b.startAt >= a.endAt) break;
        if (a.sessionId !== b.sessionId && a.slot && b.slot && a.slot !== b.slot && overlaps(a, b)) out.push({ resourceId, a, b, from: b.startAt, to: Math.min(a.endAt, b.endAt) });
      }
    }
  }
  return out;
}

/** Does adding `candidate` to `existing` create any overlap for that resource? */
export function hasConflict(
  candidate: ResourceBooking,
  existing: readonly ResourceBooking[],
  mode: ClashMode = "times",
): boolean {
  return existing.some((e) => e.resourceId === candidate.resourceId && clashes(candidate, e, mode));
}

/** The bookings a candidate overlaps in time but not in slot (slot-run centres): for a warning, not a block. */
export function timeOverlapsOnly(candidate: ResourceBooking, existing: readonly ResourceBooking[]): ResourceBooking[] {
  return existing.filter((e) => e.resourceId === candidate.resourceId && e.sessionId !== candidate.sessionId && e.slot && candidate.slot && e.slot !== candidate.slot && overlaps(candidate, e));
}
