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
  const required = requiredInstructors(input.groupSize, input.ratio);
  const ratioCounting = input.assigned.filter((a) => a.countsTowardRatio).length;
  const hasSafetyCover = input.assigned.some((a) => a.isSafetyCover);

  const understaffed = ratioCounting < required;
  const missingSafetyCover = input.requiresSafetyBoat && !hasSafetyCover;

  return {
    ratioCountingStaff: ratioCounting,
    requiredStaff: required,
    understaffed,
    missingSafetyCover,
    ok: !understaffed && !missingSafetyCover,
  };
}
