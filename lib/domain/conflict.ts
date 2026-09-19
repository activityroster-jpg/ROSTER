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
}

export interface Conflict {
  readonly resourceId: string;
  readonly a: ResourceBooking;
  readonly b: ResourceBooking;
}

/**
 * Find every pair of overlapping bookings that share a resource. O(n log n)-ish
 * by grouping per resource then sorting by start; adequate for a centre's week.
 */
export function findConflicts(bookings: readonly ResourceBooking[]): Conflict[] {
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
        // Sessions are sorted by start; once b starts at/after a ends, no later
        // b can overlap a either.
        if (b.startAt >= a.endAt) break;
        if (a.sessionId !== b.sessionId && overlaps(a, b)) {
          conflicts.push({ resourceId, a, b });
        }
      }
    }
  }
  return conflicts;
}

/** Does adding `candidate` to `existing` create any overlap for that resource? */
export function hasConflict(
  candidate: ResourceBooking,
  existing: readonly ResourceBooking[],
): boolean {
  return existing.some(
    (e) => e.resourceId === candidate.resourceId && e.sessionId !== candidate.sessionId && overlaps(candidate, e),
  );
}
