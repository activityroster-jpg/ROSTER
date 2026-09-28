import type { CourseAudience, Jurisdiction } from "@/lib/db/schema";

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
  // Dinghy
  { name: "Dinghy Assistant Instructor", code: "DAI", rank: 10, discipline: "dinghy", expiryTracked: false },
  { name: "Dinghy Instructor", code: "DI", rank: 20, discipline: "dinghy", expiryTracked: false },
  { name: "Dinghy Senior Instructor", code: "DSI", rank: 30, discipline: "dinghy", expiryTracked: false },
  { name: "Advanced Dinghy Instructor", code: "ADI", rank: 40, discipline: "dinghy", expiryTracked: false },
  { name: "Dinghy Racing Coach", code: "DRC", rank: 35, discipline: "dinghy", expiryTracked: false },
  { name: "Sailability Instructor", code: "SAIL", rank: 20, discipline: "dinghy", expiryTracked: false },
  // Keelboat
  { name: "Keelboat Instructor", code: "KBI", rank: 20, discipline: "keelboat", expiryTracked: false },
  { name: "Keelboat Senior Instructor", code: "KBSI", rank: 30, discipline: "keelboat", expiryTracked: false },
  // Windsurfing
  { name: "Windsurfing Instructor", code: "WI", rank: 20, discipline: "windsurf", expiryTracked: false },
  { name: "Advanced Windsurfing Instructor", code: "AWI", rank: 30, discipline: "windsurf", expiryTracked: false },
  { name: "Senior Windsurfing Instructor", code: "SWI", rank: 40, discipline: "windsurf", expiryTracked: false },
  // Paddleboarding (SUP)
  { name: "Paddleboard (SUP) Instructor", code: "SUPI", rank: 20, discipline: "sup", expiryTracked: false },
  // Powerboat
  { name: "Safety Boat Certificate", code: "SBC", rank: 15, discipline: "powerboat", expiryTracked: false },
  { name: "Powerboat Instructor", code: "PBI", rank: 20, discipline: "powerboat", expiryTracked: false },
  { name: "Advanced Powerboat Instructor", code: "APBI", rank: 30, discipline: "powerboat", expiryTracked: false },
  { name: "Personal Watercraft (PWC) Instructor", code: "PWCI", rank: 25, discipline: "powerboat", expiryTracked: false },
  { name: "Powerboat Trainer", code: "PBT", rank: 45, discipline: "powerboat", expiryTracked: false },
  // Cruising / yacht
  { name: "Cruising Instructor", code: "CI", rank: 30, discipline: "cruising", expiryTracked: false },
  { name: "Yachtmaster Instructor", code: "YMI", rank: 45, discipline: "cruising", expiryTracked: false },
  // Shorebased / theory
  { name: "Shorebased Instructor", code: "SBI", rank: 20, discipline: "shorebased", expiryTracked: false },
  { name: "First Aid Instructor", code: "FAI", rank: 15, discipline: "first_aid", expiryTracked: false },
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
    case "other":
      // Outside the UK & Ireland: a generic vetting record, not mandatory (each
      // centre can make it mandatory in Settings if their jurisdiction requires it).
      return { name: "Background / Vetting Check", code: "VETTING", mandatory: false, expiryTracked: true };
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
  { name: "Keelboat", inventoryTracked: true },
  { name: "Yacht", inventoryTracked: true },
  { name: "Motor Cruiser", inventoryTracked: true },
  { name: "Safety Boat", inventoryTracked: true },
  { name: "Coach Boat", inventoryTracked: true },
  { name: "Windsurf Board", inventoryTracked: true },
  { name: "Paddleboard (SUP)", inventoryTracked: true },
  { name: "Kayak", inventoryTracked: true },
  { name: "Buoyancy Aid", inventoryTracked: false },
  { name: "Wetsuit", inventoryTracked: false },
  { name: "Other", inventoryTracked: false },
];

export const DEFAULT_LOCATION_TYPES: string[] = [
  "Operating area",
  "Launch area",
  "Classroom",
  "Pontoon / berth",
  "Boat store / workshop",
  "Changing facilities",
  "Meeting point",
];

export interface CourseTypeSeed {
  name: string;
  scheme: string;
  /** youth / adult / all — keeps youth and adult provision cleanly separated. */
  audience: CourseAudience;
  /** How centres tend to group it when selling it. */
  category: string;
  defaultCapacity: number;
  studentsPerInstructor: number;
  requiresSafetyBoat: boolean;
}

/**
 * A broad RYA-aware starter catalogue spanning the main schemes and both youth
 * and adult provision. Centres tick the ones they run during onboarding (and
 * add their own), so a wide default list means less typing, never clutter.
 */
export const DEFAULT_COURSE_TYPES: CourseTypeSeed[] = [
  // --- Adult dinghy (RYA National Sailing Scheme) ---
  { name: "Start Sailing (Level 1)", scheme: "RYA National Sailing", audience: "adult", category: "Adult dinghy", defaultCapacity: 6, studentsPerInstructor: 3, requiresSafetyBoat: true },
  { name: "Basic Skills (Level 2)", scheme: "RYA National Sailing", audience: "adult", category: "Adult dinghy", defaultCapacity: 6, studentsPerInstructor: 3, requiresSafetyBoat: true },
  { name: "Improving Skills", scheme: "RYA National Sailing", audience: "adult", category: "Adult dinghy", defaultCapacity: 6, studentsPerInstructor: 3, requiresSafetyBoat: true },
  { name: "Day Sailing", scheme: "RYA National Sailing", audience: "adult", category: "Adult dinghy", defaultCapacity: 6, studentsPerInstructor: 3, requiresSafetyBoat: true },
  { name: "Seamanship Skills", scheme: "RYA National Sailing", audience: "adult", category: "Adult dinghy", defaultCapacity: 6, studentsPerInstructor: 3, requiresSafetyBoat: true },
  { name: "Sailing with Spinnakers", scheme: "RYA National Sailing", audience: "adult", category: "Adult dinghy", defaultCapacity: 6, studentsPerInstructor: 3, requiresSafetyBoat: true },
  { name: "Performance Sailing", scheme: "RYA National Sailing", audience: "adult", category: "Adult dinghy", defaultCapacity: 6, studentsPerInstructor: 3, requiresSafetyBoat: true },

  // --- Youth (RYA Youth Sailing Scheme — Stages 1–4 + modules) ---
  { name: "Youth Stage 1", scheme: "RYA Youth Sailing", audience: "youth", category: "Youth scheme", defaultCapacity: 8, studentsPerInstructor: 4, requiresSafetyBoat: true },
  { name: "Youth Stage 2", scheme: "RYA Youth Sailing", audience: "youth", category: "Youth scheme", defaultCapacity: 8, studentsPerInstructor: 4, requiresSafetyBoat: true },
  { name: "Youth Stage 3", scheme: "RYA Youth Sailing", audience: "youth", category: "Youth scheme", defaultCapacity: 8, studentsPerInstructor: 4, requiresSafetyBoat: true },
  { name: "Youth Stage 4", scheme: "RYA Youth Sailing", audience: "youth", category: "Youth scheme", defaultCapacity: 8, studentsPerInstructor: 4, requiresSafetyBoat: true },
  { name: "Youth Advanced Boat Handling", scheme: "RYA Youth Sailing", audience: "youth", category: "Youth scheme", defaultCapacity: 8, studentsPerInstructor: 4, requiresSafetyBoat: true },

  // --- Youth how centres actually sell it ---
  { name: "Summer Camp (5-day)", scheme: "RYA Youth Sailing", audience: "youth", category: "Summer camp", defaultCapacity: 12, studentsPerInstructor: 4, requiresSafetyBoat: true },
  { name: "Junior Club Session", scheme: "RYA Youth Sailing", audience: "youth", category: "Junior club", defaultCapacity: 16, studentsPerInstructor: 4, requiresSafetyBoat: true },
  { name: "School Group Session", scheme: "RYA OnBoard", audience: "youth", category: "School groups", defaultCapacity: 16, studentsPerInstructor: 4, requiresSafetyBoat: true },

  // --- Racing ---
  { name: "Club Racing", scheme: "RYA National Sailing", audience: "all", category: "Racing", defaultCapacity: 8, studentsPerInstructor: 4, requiresSafetyBoat: true },
  { name: "Race Coaching", scheme: "RYA National Sailing", audience: "all", category: "Racing", defaultCapacity: 8, studentsPerInstructor: 4, requiresSafetyBoat: true },

  // --- Sailability (disability sailing) ---
  { name: "Sailability Session", scheme: "RYA Sailability", audience: "all", category: "Sailability", defaultCapacity: 8, studentsPerInstructor: 2, requiresSafetyBoat: true },

  // --- Windsurfing ---
  { name: "Start Windsurfing", scheme: "RYA Windsurfing", audience: "all", category: "Windsurfing", defaultCapacity: 6, studentsPerInstructor: 3, requiresSafetyBoat: true },
  { name: "Intermediate Windsurfing", scheme: "RYA Windsurfing", audience: "all", category: "Windsurfing", defaultCapacity: 6, studentsPerInstructor: 3, requiresSafetyBoat: true },
  { name: "Advanced Windsurfing", scheme: "RYA Windsurfing", audience: "all", category: "Windsurfing", defaultCapacity: 6, studentsPerInstructor: 3, requiresSafetyBoat: true },

  // --- Paddleboarding (SUP) ---
  { name: "Start Paddleboarding", scheme: "RYA Paddleboarding", audience: "all", category: "Paddleboarding", defaultCapacity: 8, studentsPerInstructor: 6, requiresSafetyBoat: true },
  { name: "Progression Paddleboarding", scheme: "RYA Paddleboarding", audience: "all", category: "Paddleboarding", defaultCapacity: 8, studentsPerInstructor: 6, requiresSafetyBoat: true },

  // --- Powerboat ---
  { name: "Powerboat Level 1", scheme: "RYA Powerboat", audience: "adult", category: "Powerboat", defaultCapacity: 3, studentsPerInstructor: 3, requiresSafetyBoat: false },
  { name: "Powerboat Level 2", scheme: "RYA Powerboat", audience: "adult", category: "Powerboat", defaultCapacity: 3, studentsPerInstructor: 3, requiresSafetyBoat: false },
  { name: "Intermediate Powerboat", scheme: "RYA Powerboat", audience: "adult", category: "Powerboat", defaultCapacity: 3, studentsPerInstructor: 3, requiresSafetyBoat: false },
  { name: "Advanced Powerboat", scheme: "RYA Powerboat", audience: "adult", category: "Powerboat", defaultCapacity: 3, studentsPerInstructor: 3, requiresSafetyBoat: false },
  { name: "Safety Boat Course", scheme: "RYA Powerboat", audience: "adult", category: "Powerboat", defaultCapacity: 3, studentsPerInstructor: 3, requiresSafetyBoat: false },
  { name: "Personal Watercraft (PWC / Jet Ski)", scheme: "RYA Powerboat", audience: "adult", category: "Powerboat", defaultCapacity: 3, studentsPerInstructor: 3, requiresSafetyBoat: false },

  // --- Keelboat ---
  { name: "Start Keelboating", scheme: "RYA Keelboat", audience: "adult", category: "Keelboat", defaultCapacity: 4, studentsPerInstructor: 2, requiresSafetyBoat: false },

  // --- Yacht cruising (RYA Cruising / Yachtmaster — practical) ---
  { name: "Start Yachting", scheme: "RYA Cruising", audience: "adult", category: "Yacht cruising", defaultCapacity: 4, studentsPerInstructor: 4, requiresSafetyBoat: false },
  { name: "Competent Crew", scheme: "RYA Cruising", audience: "adult", category: "Yacht cruising", defaultCapacity: 5, studentsPerInstructor: 5, requiresSafetyBoat: false },
  { name: "Day Skipper (Practical)", scheme: "RYA Cruising", audience: "adult", category: "Yacht cruising", defaultCapacity: 5, studentsPerInstructor: 5, requiresSafetyBoat: false },
  { name: "Coastal Skipper (Practical)", scheme: "RYA Cruising", audience: "adult", category: "Yacht cruising", defaultCapacity: 5, studentsPerInstructor: 5, requiresSafetyBoat: false },
  { name: "Yachtmaster Preparation", scheme: "RYA Cruising", audience: "adult", category: "Yacht cruising", defaultCapacity: 4, studentsPerInstructor: 4, requiresSafetyBoat: false },

  // --- Shorebased / theory (classroom) ---
  { name: "Essential Navigation & Seamanship", scheme: "RYA Shorebased", audience: "adult", category: "Shorebased theory", defaultCapacity: 12, studentsPerInstructor: 12, requiresSafetyBoat: false },
  { name: "Day Skipper Theory", scheme: "RYA Shorebased", audience: "adult", category: "Shorebased theory", defaultCapacity: 12, studentsPerInstructor: 12, requiresSafetyBoat: false },
  { name: "Coastal / Yachtmaster Theory", scheme: "RYA Shorebased", audience: "adult", category: "Shorebased theory", defaultCapacity: 12, studentsPerInstructor: 12, requiresSafetyBoat: false },
  { name: "VHF / SRC Radio Course", scheme: "RYA Shorebased", audience: "adult", category: "Shorebased theory", defaultCapacity: 12, studentsPerInstructor: 12, requiresSafetyBoat: false },
  { name: "First Aid Course", scheme: "RYA Shorebased", audience: "adult", category: "Shorebased theory", defaultCapacity: 12, studentsPerInstructor: 12, requiresSafetyBoat: false },
  { name: "Sea Survival", scheme: "RYA Shorebased", audience: "adult", category: "Shorebased theory", defaultCapacity: 12, studentsPerInstructor: 12, requiresSafetyBoat: false },
  { name: "Diesel Engine Course", scheme: "RYA Shorebased", audience: "adult", category: "Shorebased theory", defaultCapacity: 12, studentsPerInstructor: 12, requiresSafetyBoat: false },
];
