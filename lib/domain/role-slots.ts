/**
 * The rows a course's staffing shows: one per required place ("Instructor 1",
 * "Instructor 2", "Safety Boat Driver"), each with the person in it or empty.
 * Required places come from the course's role lines, or from what the ratio
 * implies when the office hasn't set lines. Anyone assigned beyond the lines
 * still shows, marked "not required". Pure.
 */
import { bySeniority } from "./role-rank";

export interface SlotLine { roleTypeId: string; roleName: string; count: number }

export interface SlotPerson {
  assignmentId: string;
  instructorId: string;
  name: string;
  roleTypeId: string;
  roleName: string;
  status: "assigned" | "confirmed" | "declined";
  isOverride?: boolean;
  declineNote?: string | null;
}

export interface RoleSlot {
  key: string;
  roleTypeId: string;
  roleName: string;
  /** "Instructor 1", "Instructor 2", "Safety Boat Driver". */
  label: string;
  person?: SlotPerson;
  /** Assigned but not one of the required places. */
  extra?: boolean;
}

export function buildRoleSlots(lines: readonly SlotLine[], people: readonly SlotPerson[]): RoleSlot[] {
  const slots: RoleSlot[] = [];
  const used = new Set<SlotPerson>();
  // Higher levels first: Senior Instructor above Instructor above Assistant, safety and support last.
  for (const line of bySeniority(lines)) {
    const inRole = people.filter((p) => p.roleTypeId === line.roleTypeId && !used.has(p));
    // Declined people never hold a place: they show, but the place stays open.
    const holding = inRole.filter((p) => p.status !== "declined");
    const declined = inRole.filter((p) => p.status === "declined");
    for (const p of inRole) used.add(p);
    const places = Math.max(line.count, holding.length);
    for (let i = 0; i < places; i++) {
      slots.push({ key: `${line.roleTypeId}-${i}`, roleTypeId: line.roleTypeId, roleName: line.roleName, label: places > 1 ? `${line.roleName} ${i + 1}` : line.roleName, person: holding[i], extra: i >= line.count });
    }
    for (const [i, p] of declined.entries()) slots.push({ key: `${line.roleTypeId}-declined-${i}`, roleTypeId: line.roleTypeId, roleName: line.roleName, label: line.roleName, person: p, extra: true });
  }
  for (const [i, p] of people.filter((p) => !used.has(p)).entries()) {
    slots.push({ key: `extra-${p.roleTypeId}-${i}`, roleTypeId: p.roleTypeId, roleName: p.roleName, label: p.roleName, person: p, extra: true });
  }
  return slots;
}

/** How many required places are still empty. */
export function openPlaces(slots: readonly RoleSlot[]): number {
  return slots.filter((s) => !s.extra && !s.person).length;
}
