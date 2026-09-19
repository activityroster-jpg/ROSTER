import type { Jurisdiction } from "@/lib/db/schema";

/**
 * RYA-aware default catalogue seeded into every new centre on provisioning.
 *
 * This is the "same from the start" baseline every centre begins with. After
 * provisioning it is theirs to edit (deactivate-never-delete) — that is how a
 * centre "branches off" without any code fork. Nothing here is hard-coded into
 * behaviour; the app reads these rows, so changing them changes the product for
 * that one centre only.
 */

export interface SlotSeed {
  code: "AM" | "PM" | "EV";
  label: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
}

export const DEFAULT_SLOTS: SlotSeed[] = [
  { code: "AM", label: "Morning", startTime: "09:00", endTime: "12:30", sortOrder: 0 },
  { code: "PM", label: "Afternoon", startTime: "13:00", endTime: "16:30", sortOrder: 1 },
  { code: "EV", label: "Evening", startTime: "17:00", endTime: "20:00", sortOrder: 2 },
];

export interface RoleSeed {
  name: string;
  code: string;
  countsTowardRatio: boolean;
  isSafetyCover: boolean;
  isFirstAider: boolean;
}

export const DEFAULT_ROLES: RoleSeed[] = [
  { name: "Instructor", code: "INSTRUCTOR", countsTowardRatio: true, isSafetyCover: false, isFirstAider: false },
  { name: "Senior Instructor", code: "SENIOR", countsTowardRatio: true, isSafetyCover: false, isFirstAider: false },
  { name: "Assistant Instructor", code: "ASSISTANT", countsTowardRatio: true, isSafetyCover: false, isFirstAider: false },
  { name: "Safety Boat Driver", code: "SAFETY_BOAT", countsTowardRatio: false, isSafetyCover: true, isFirstAider: false },
  { name: "First Aider", code: "FIRST_AIDER", countsTowardRatio: false, isSafetyCover: false, isFirstAider: true },
];

export interface GradeSeed {
  name: string;
  code: string;
  rank: number;
  discipline: string;
  expiryTracked: boolean;
  defaultValidMonths?: number;
}

export const DEFAULT_GRADES: GradeSeed[] = [
  { name: "Dinghy Assistant Instructor", code: "DAI", rank: 10, discipline: "dinghy", expiryTracked: false },
  { name: "Dinghy Instructor", code: "DI", rank: 20, discipline: "dinghy", expiryTracked: false },
  { name: "Dinghy Senior Instructor", code: "DSI", rank: 30, discipline: "dinghy", expiryTracked: false },
  { name: "Advanced Dinghy Instructor", code: "ADI", rank: 40, discipline: "dinghy", expiryTracked: false },
  { name: "Powerboat Instructor", code: "PBI", rank: 20, discipline: "powerboat", expiryTracked: false },
  { name: "Safety Boat Certificate", code: "SBC", rank: 15, discipline: "powerboat", expiryTracked: false },
  { name: "Windsurfing Instructor", code: "WI", rank: 20, discipline: "windsurf", expiryTracked: false },
  { name: "Senior Windsurfing Instructor", code: "SWI", rank: 30, discipline: "windsurf", expiryTracked: false },
  { name: "Keelboat Instructor", code: "KBI", rank: 20, discipline: "keelboat", expiryTracked: false },
];

export interface ComplianceSeed {
  name: string;
  code: string;
  mandatory: boolean;
  expiryTracked: boolean;
}

/** Jurisdiction-specific vetting check. */
function vettingFor(jurisdiction: Jurisdiction): ComplianceSeed {
  switch (jurisdiction) {
    case "scotland":
      return { name: "PVG Scheme Membership", code: "PVG", mandatory: true, expiryTracked: false };
    case "northern_ireland":
      return { name: "AccessNI Enhanced Check", code: "ACCESSNI", mandatory: true, expiryTracked: true };
    case "ireland":
      return { name: "Garda Vetting", code: "GARDA", mandatory: true, expiryTracked: true };
    case "england":
    case "wales":
    default:
      return { name: "Enhanced DBS Check", code: "DBS", mandatory: true, expiryTracked: true };
  }
}

export function defaultComplianceTypes(jurisdiction: Jurisdiction): ComplianceSeed[] {
  return [
    { name: "First Aid Certificate", code: "FIRST_AID", mandatory: true, expiryTracked: true },
    { name: "Safeguarding Training", code: "SAFEGUARDING", mandatory: true, expiryTracked: true },
    vettingFor(jurisdiction),
    { name: "RYA Instructor Revalidation", code: "REVALIDATION", mandatory: false, expiryTracked: true },
  ];
}

export interface EquipmentTypeSeed {
  name: string;
  inventoryTracked: boolean;
}

export const DEFAULT_EQUIPMENT_TYPES: EquipmentTypeSeed[] = [
  { name: "Dinghy", inventoryTracked: true },
  { name: "Safety Boat", inventoryTracked: true },
  { name: "Windsurf Board", inventoryTracked: true },
  { name: "Kayak", inventoryTracked: true },
  { name: "Buoyancy Aid", inventoryTracked: false },
  { name: "Wetsuit", inventoryTracked: false },
];

export const DEFAULT_LOCATION_TYPES: string[] = [
  "Operating area",
  "Launch area",
  "Classroom",
  "Changing facilities",
];

export interface CourseTypeSeed {
  name: string;
  scheme: string;
  defaultCapacity: number;
  studentsPerInstructor: number;
  requiresSafetyBoat: boolean;
}

export const DEFAULT_COURSE_TYPES: CourseTypeSeed[] = [
  { name: "Start Sailing", scheme: "RYA National Sailing", defaultCapacity: 6, studentsPerInstructor: 3, requiresSafetyBoat: true },
  { name: "Basic Skills", scheme: "RYA National Sailing", defaultCapacity: 6, studentsPerInstructor: 3, requiresSafetyBoat: true },
  { name: "Improving Skills", scheme: "RYA National Sailing", defaultCapacity: 6, studentsPerInstructor: 3, requiresSafetyBoat: true },
  { name: "Youth Stage 1", scheme: "RYA Youth Sailing", defaultCapacity: 8, studentsPerInstructor: 4, requiresSafetyBoat: true },
  { name: "Youth Stage 2", scheme: "RYA Youth Sailing", defaultCapacity: 8, studentsPerInstructor: 4, requiresSafetyBoat: true },
  { name: "Powerboat Level 1", scheme: "RYA Powerboat", defaultCapacity: 3, studentsPerInstructor: 3, requiresSafetyBoat: false },
  { name: "Powerboat Level 2", scheme: "RYA Powerboat", defaultCapacity: 3, studentsPerInstructor: 3, requiresSafetyBoat: false },
  { name: "Safety Boat Course", scheme: "RYA Powerboat", defaultCapacity: 3, studentsPerInstructor: 3, requiresSafetyBoat: false },
  { name: "Start Windsurfing", scheme: "RYA Windsurfing", defaultCapacity: 6, studentsPerInstructor: 3, requiresSafetyBoat: true },
];
