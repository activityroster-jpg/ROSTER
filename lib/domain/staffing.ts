/**
 * One staffing panel per course (audit A2-2, option B): you enter students, the
 * panel shows what the RYA ratio from the course type implies, suggests the
 * roles, and the admin adjusts them. "Staff required" is always derived from
 * the role lines, never typed. Pure functions.
 */

import { requiredInstructors } from "./ratio";

export interface StaffingRole {
  id: string;
  name: string;
  countsTowardRatio: boolean;
  isSafetyCover: boolean;
  active: boolean;
}

export interface RoleLine {
  roleTypeId: string;
  count: number;
}

export interface StaffingInput {
  students: number;
  /** Students per instructor (course.ratio, from the course type). */
  ratio: number;
  requiresSafetyBoat: boolean;
  roles: readonly StaffingRole[];
}

/** The role lines the ratio implies: enough ratio-counting instructors, plus one safety-cover role when craft are afloat. */
export function suggestRoles(input: StaffingInput): RoleLine[] {
  const active = input.roles.filter((r) => r.active);
  const instructorRole = active.find((r) => r.countsTowardRatio && !r.isSafetyCover) ?? active.find((r) => r.countsTowardRatio);
  const safetyRole = active.find((r) => r.isSafetyCover);
  const lines: RoleLine[] = [];
  const needed = requiredInstructors(input.students, input.ratio);
  if (instructorRole && needed > 0) lines.push({ roleTypeId: instructorRole.id, count: needed });
  if (input.requiresSafetyBoat && safetyRole) lines.push({ roleTypeId: safetyRole.id, count: 1 });
  return lines;
}

/** Merge duplicate roles, drop empties, clamp counts. */
export function cleanRoleLines(lines: readonly { roleTypeId: string; count: number | string }[]): RoleLine[] {
  const by = new Map<string, number>();
  for (const l of lines) {
    const n = Math.max(0, Math.min(50, Math.round(Number(l.count) || 0)));
    if (!l.roleTypeId || n === 0) continue;
    by.set(l.roleTypeId, Math.min(50, (by.get(l.roleTypeId) ?? 0) + n));
  }
  return [...by].map(([roleTypeId, count]) => ({ roleTypeId, count }));
}

/** Total staff the role lines add up to, or null when there are none (the ratio alone then decides). */
export function derivedStaffRequired(lines: readonly RoleLine[]): number | null {
  const total = lines.reduce((n, l) => n + l.count, 0);
  return total > 0 ? total : null;
}

/** Plain-English note when the role lines fall short of what the ratio implies. */
export function staffingShortfallNote(input: StaffingInput, lines: readonly RoleLine[]): string | null {
  const needed = requiredInstructors(input.students, input.ratio);
  const roleById = new Map(input.roles.map((r) => [r.id, r]));
  const counting = lines.reduce((n, l) => n + (roleById.get(l.roleTypeId)?.countsTowardRatio ? l.count : 0), 0);
  const safety = lines.some((l) => roleById.get(l.roleTypeId)?.isSafetyCover);
  const notes: string[] = [];
  if (lines.length > 0 && counting < needed) notes.push(`${input.students} students at 1:${Math.max(1, Math.floor(input.ratio))} needs ${needed} ratio-counting instructor${needed === 1 ? "" : "s"}; you have ${counting}`);
  if (input.requiresSafetyBoat && lines.length > 0 && !safety) notes.push("this course type needs safety-boat cover and no safety role is listed");
  return notes.length ? notes.join("; ") : null;
}
