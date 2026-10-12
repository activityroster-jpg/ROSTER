/**
 * Ratio & safety-cover checks for a course.
 *
 * A course is UNDER-STAFFED if it lacks enough ratio-counting staff for its
 * group size (students ÷ ratio, rounded up). It is MISSING SAFETY COVER if craft
 * are afloat (the course type requires a safety boat) without a safety-cover
 * role filled. Both are surfaced as flags, never hard blocks — an admin can
 * still override with a recorded note.
 */

export interface AssignedRole {
  readonly instructorId: string;
  /** From role_type.countsTowardRatio */
  readonly countsTowardRatio: boolean;
  /** From role_type.isSafetyCover */
  readonly isSafetyCover: boolean;
}

export interface RatioInput {
  /** Number of students / group size (course.capacity). */
  readonly groupSize: number;
  /** Students per instructor (course.ratio). Must be >= 1. */
  readonly ratio: number;
  /** Does this course require safety-boat cover? (course_type.requiresSafetyBoat) */
  readonly requiresSafetyBoat: boolean;
  readonly assigned: readonly AssignedRole[];
  /**
   * What the office set (course.staffRequired: the role lines' total, or 0 for
   * "no staff needed"). A number wins over the ratio; null/undefined = the
   * ratio decides.
   */
  readonly staffRequired?: number | null;
}

export interface RatioResult {
  readonly ratioCountingStaff: number;
  readonly requiredStaff: number;
  readonly understaffed: boolean;
  readonly missingSafetyCover: boolean;
  readonly ok: boolean;
}

export function requiredInstructors(groupSize: number, ratio: number): number {
  if (groupSize <= 0) return 0;
  const r = Math.max(1, Math.floor(ratio));
  return Math.ceil(groupSize / r);
}

export function evaluateRatio(input: RatioInput): RatioResult {
  const explicit = typeof input.staffRequired === "number" && input.staffRequired >= 0 ? input.staffRequired : null;
  const required = explicit ?? requiredInstructors(input.groupSize, input.ratio);
  // An explicit total counts every role the office listed (a safety-boat place included), so it is
  // measured against everyone assigned; the ratio alone counts only the people who count towards it.
  const ratioCounting = explicit !== null ? input.assigned.length : input.assigned.filter((a) => a.countsTowardRatio).length;
  const hasSafetyCover = input.assigned.some((a) => a.isSafetyCover);

  const understaffed = ratioCounting < required;
  // "No staff needed" (an explicit 0) asks for no safety cover either.
  const missingSafetyCover = explicit === 0 ? false : input.requiresSafetyBoat && !hasSafetyCover;

  return {
    ratioCountingStaff: ratioCounting,
    requiredStaff: required,
    understaffed,
    missingSafetyCover,
    ok: !understaffed && !missingSafetyCover,
  };
}
