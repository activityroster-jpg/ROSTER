import type { CourseAudience, Jurisdiction } from "@/lib/db/schema";

/**
 * The RYA lists (the first activity pack, lib/packs/rya.ts). Other packs keep
 * their own lists beside this file. These are the "same from the start" baseline a centre begins with. After
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

/**
 * Places on a course are instructor types (Dinghy Instructor, Powerboat
 * Instructor…): the RYA pack makes one place per teaching instructor type at
 * provisioning (lib/seed/seed.ts, `placesFromTypes`). These are the places that
 * aren't an instructor type. There is no separate safety boat driver: the
 * instructor drives the safety boat.
 */
export const DEFAULT_ROLES: RoleSeed[] = [
  { name: "Volunteer", code: "VOLUNTEER", countsTowardRatio: false, isSafetyCover: false, isFirstAider: false },
];

/** The generic places centres had before places became instructor types (converted by lib/services/instructor-types-upgrade.ts). */
export const LEGACY_GENERIC_ROLE_CODES = { instructor: "INSTRUCTOR", senior: "SENIOR", assistant: "ASSISTANT", safetyBoat: "SAFETY_BOAT" } as const;

export interface GradeSeed {
  name: string;
  code: string;
  /** Position on its ladder: a higher rank in the same discipline can fill a lower place. */
  rank: number;
  /** The ladder it belongs to ("dinghy", "windsurf", "powerboat"…). Null for a held certificate or an examiner: not a place on a course. */
  discipline: string | null;
  expiryTracked: boolean;
  defaultValidMonths?: number;
  /** Teaches under the supervision of a Senior Instructor (the roster warns when none is on duty in the slot). */
  needsSupervision?: boolean;
  /** A Senior Instructor (or above) who can supervise this ladder. */
  supervises?: boolean;
}

export const DEFAULT_GRADES: GradeSeed[] = [
  // Dinghy, multihull and keelboat (RYA). An Assistant Instructor is appointed by the
  // centre's Principal or Senior Instructor and is valid only at that centre; a Dinghy
  // Instructor needs Powerboat Level 2 and a current first aid certificate.
  { name: "Assistant Instructor", code: "AI", rank: 10, discipline: "dinghy", expiryTracked: false, needsSupervision: true },
  { name: "Dinghy Instructor", code: "DI", rank: 20, discipline: "dinghy", expiryTracked: false, needsSupervision: true },
  { name: "Foiling Endorsement", code: "FOIL", rank: 24, discipline: "dinghy", expiryTracked: false },
  { name: "Multihull Endorsement", code: "MH", rank: 25, discipline: "dinghy", expiryTracked: false },
  { name: "Racing Endorsement", code: "RACE", rank: 26, discipline: "dinghy", expiryTracked: false },
  { name: "Advanced Dinghy Instructor", code: "ADI", rank: 30, discipline: "dinghy", expiryTracked: false },
  { name: "Senior Instructor", code: "SI", rank: 40, discipline: "dinghy", expiryTracked: false, supervises: true },
  { name: "Coach/Assessor", code: "CA", rank: 50, discipline: "dinghy", expiryTracked: false, supervises: true },
  { name: "Keelboat Endorsement", code: "KBI", rank: 20, discipline: "keelboat", expiryTracked: false, needsSupervision: true },
  { name: "Keelboat Senior Instructor", code: "KBSI", rank: 40, discipline: "keelboat", expiryTracked: false, supervises: true },
  { name: "Dinghy Racing Coach", code: "DRC", rank: 30, discipline: "racing_coach", expiryTracked: false },
  { name: "Sailability Instructor", code: "SAIL", rank: 20, discipline: "sailability", expiryTracked: false },
  // Windsurfing (the RYA's current ladder).
  { name: "Windsurfing Assistant Instructor", code: "WAI", rank: 10, discipline: "windsurf", expiryTracked: false, needsSupervision: true },
  { name: "Start Windsurfing Instructor", code: "WI", rank: 20, discipline: "windsurf", expiryTracked: false },
  { name: "Intermediate Windsurfing Instructor", code: "IWI", rank: 25, discipline: "windsurf", expiryTracked: false, needsSupervision: true },
  { name: "Windsurfing Racing Instructor", code: "WRI", rank: 26, discipline: "windsurf", expiryTracked: false, needsSupervision: true },
  { name: "Windsurfing Foiling Instructor", code: "WFI", rank: 27, discipline: "windsurf", expiryTracked: false },
  { name: "Advanced Windsurfing Instructor", code: "AWI", rank: 30, discipline: "windsurf", expiryTracked: false, needsSupervision: true },
  { name: "Senior Windsurfing Instructor", code: "SWI", rank: 40, discipline: "windsurf", expiryTracked: false, supervises: true },
  { name: "Windsurfing Trainer", code: "WT", rank: 50, discipline: "windsurf", expiryTracked: false, supervises: true },
  // Paddleboarding (SUP)
  { name: "Paddleboard (SUP) Instructor", code: "SUPI", rank: 20, discipline: "sup", expiryTracked: false },
  // Powerboat and PWC. The certificates and the endorsement are held, not places.
  { name: "Powerboat Level 2 Certificate", code: "PB2", rank: 5, discipline: null, expiryTracked: false },
  { name: "Safety Boat Certificate", code: "SBC", rank: 15, discipline: null, expiryTracked: false },
  { name: "Commercial Endorsement (Advanced Powerboat)", code: "CEND", rank: 16, discipline: null, expiryTracked: false },
  { name: "Powerboat Instructor", code: "PBI", rank: 20, discipline: "powerboat", expiryTracked: false },
  { name: "Advanced Powerboat Instructor", code: "APBI", rank: 30, discipline: "powerboat", expiryTracked: false },
  { name: "Powerboat Trainer", code: "PBT", rank: 45, discipline: "powerboat", expiryTracked: false },
  { name: "Powerboat Advanced Trainer", code: "PBAT", rank: 50, discipline: "powerboat", expiryTracked: false },
  { name: "Personal Watercraft (PWC) Instructor", code: "PWCI", rank: 20, discipline: "pwc", expiryTracked: false },
  // Sail and motor cruising. A Yachtmaster Examiner examines; it isn't a place on a course.
  { name: "Cruising Instructor (Sail)", code: "CI", rank: 30, discipline: "cruising", expiryTracked: false },
  { name: "Yachtmaster Instructor (Sail)", code: "YMI", rank: 45, discipline: "cruising", expiryTracked: false },
  { name: "Cruising Instructor Trainer", code: "CIT", rank: 50, discipline: "cruising", expiryTracked: false },
  { name: "Cruising Instructor (Power)", code: "MCI", rank: 30, discipline: "motor_cruising", expiryTracked: false },
  { name: "Yachtmaster Instructor (Power)", code: "MYMI", rank: 45, discipline: "motor_cruising", expiryTracked: false },
  { name: "Yachtmaster Examiner", code: "YME", rank: 55, discipline: null, expiryTracked: false },
  // Shorebased and short courses: each its own ladder, so one never fills another's place.
  { name: "Shorebased Navigation Instructor", code: "SBI", rank: 20, discipline: "shorebased", expiryTracked: false },
  { name: "SRC Instructor", code: "VHFI", rank: 20, discipline: "src", expiryTracked: false },
  { name: "First Aid Instructor", code: "FAI", rank: 20, discipline: "first_aid", expiryTracked: false },
  { name: "Sea Survival Instructor", code: "SSVI", rank: 20, discipline: "sea_survival", expiryTracked: false },
  { name: "Radar Instructor", code: "RADI", rank: 20, discipline: "radar", expiryTracked: false },
  { name: "Diesel Engine Instructor", code: "DEI", rank: 20, discipline: "diesel", expiryTracked: false },
  // Inland
  { name: "Inland Waterways Instructor", code: "IWWI", rank: 20, discipline: "inland", expiryTracked: false },
];

export interface ComplianceSeed {
  name: string;
  code: string;
  mandatory: boolean;
  expiryTracked: boolean;
  isVetting?: boolean;
}

/** Jurisdiction-specific vetting check. */
export function vettingFor(jurisdiction: Jurisdiction): ComplianceSeed {
  switch (jurisdiction) {
    case "scotland":
      return { name: "PVG Scheme Membership", code: "PVG", mandatory: false, expiryTracked: false, isVetting: true };
    case "northern_ireland":
      return { name: "AccessNI Enhanced Check", code: "ACCESSNI", mandatory: false, expiryTracked: true, isVetting: true };
    case "ireland":
      return { name: "Garda Vetting", code: "GARDA", mandatory: false, expiryTracked: true, isVetting: true };
    case "other":
      // Outside the UK & Ireland: a generic vetting record, not mandatory (each
      // centre can make it mandatory in Settings if their jurisdiction requires it).
      return { name: "Background / Vetting Check", code: "VETTING", mandatory: false, expiryTracked: true, isVetting: true };
    case "england":
    case "wales":
    default:
      return { name: "Enhanced DBS Check", code: "DBS", mandatory: false, expiryTracked: true, isVetting: true };
  }
}

export function defaultComplianceTypes(jurisdiction: Jurisdiction): ComplianceSeed[] {
  return [
    { name: "First Aid Certificate", code: "FIRST_AID", mandatory: false, expiryTracked: true },
    { name: "Safeguarding Training", code: "SAFEGUARDING", mandatory: false, expiryTracked: true },
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
  { name: "Start Sailing (Level 1)", scheme: "RYA National Sailing", audience: "adult", category: "Adult dinghy", defaultCapacity: 6, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "Basic Skills (Level 2)", scheme: "RYA National Sailing", audience: "adult", category: "Adult dinghy", defaultCapacity: 6, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "Improving Skills", scheme: "RYA National Sailing", audience: "adult", category: "Adult dinghy", defaultCapacity: 6, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "Day Sailing", scheme: "RYA National Sailing", audience: "adult", category: "Adult dinghy", defaultCapacity: 6, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "Seamanship Skills", scheme: "RYA National Sailing", audience: "adult", category: "Adult dinghy", defaultCapacity: 6, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "Sailing with Spinnakers", scheme: "RYA National Sailing", audience: "adult", category: "Adult dinghy", defaultCapacity: 6, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "Performance Sailing", scheme: "RYA National Sailing", audience: "adult", category: "Adult dinghy", defaultCapacity: 6, studentsPerInstructor: 6, requiresSafetyBoat: false },

  // --- Youth (RYA Youth Sailing Scheme — Stages 1–4 + modules) ---
  { name: "Youth Stage 1", scheme: "RYA Youth Sailing", audience: "youth", category: "Youth scheme", defaultCapacity: 8, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "Youth Stage 2", scheme: "RYA Youth Sailing", audience: "youth", category: "Youth scheme", defaultCapacity: 8, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "Youth Stage 3", scheme: "RYA Youth Sailing", audience: "youth", category: "Youth scheme", defaultCapacity: 8, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "Youth Stage 4", scheme: "RYA Youth Sailing", audience: "youth", category: "Youth scheme", defaultCapacity: 8, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "Youth Advanced Boat Handling", scheme: "RYA Youth Sailing", audience: "youth", category: "Youth scheme", defaultCapacity: 8, studentsPerInstructor: 6, requiresSafetyBoat: false },

  // --- Youth how centres actually sell it ---
  { name: "Summer Camp (5-day)", scheme: "RYA Youth Sailing", audience: "youth", category: "Summer camp", defaultCapacity: 12, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "Junior Club Session", scheme: "RYA Youth Sailing", audience: "youth", category: "Junior club", defaultCapacity: 16, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "School Group Session", scheme: "RYA OnBoard", audience: "youth", category: "School groups", defaultCapacity: 16, studentsPerInstructor: 6, requiresSafetyBoat: false },

  // --- Racing ---
  { name: "Club Racing", scheme: "RYA National Sailing", audience: "all", category: "Racing", defaultCapacity: 8, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "Race Coaching", scheme: "RYA National Sailing", audience: "all", category: "Racing", defaultCapacity: 8, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "Start Racing", scheme: "RYA National Sailing", audience: "all", category: "Racing", defaultCapacity: 8, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "First Flights (Foiling)", scheme: "RYA National Sailing", audience: "all", category: "Foiling", defaultCapacity: 6, studentsPerInstructor: 6, requiresSafetyBoat: false },

  // --- Sailability (disability sailing) ---
  { name: "Sailability Session", scheme: "RYA Sailability", audience: "all", category: "Sailability", defaultCapacity: 8, studentsPerInstructor: 2, requiresSafetyBoat: false },

  // --- Windsurfing ---
  { name: "Start Windsurfing", scheme: "RYA Windsurfing", audience: "all", category: "Windsurfing", defaultCapacity: 6, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "Intermediate Windsurfing", scheme: "RYA Windsurfing", audience: "all", category: "Windsurfing", defaultCapacity: 6, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "Advanced Windsurfing", scheme: "RYA Windsurfing", audience: "all", category: "Windsurfing", defaultCapacity: 6, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "Youth Windsurfing Stage 1", scheme: "RYA Windsurfing", audience: "youth", category: "Windsurfing", defaultCapacity: 8, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "Youth Windsurfing Stage 2", scheme: "RYA Windsurfing", audience: "youth", category: "Windsurfing", defaultCapacity: 8, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "Youth Windsurfing Stage 3", scheme: "RYA Windsurfing", audience: "youth", category: "Windsurfing", defaultCapacity: 8, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "Youth Windsurfing Stage 4", scheme: "RYA Windsurfing", audience: "youth", category: "Windsurfing", defaultCapacity: 8, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "Start Racing (Windsurf)", scheme: "RYA Windsurfing", audience: "all", category: "Windsurfing", defaultCapacity: 6, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "First Flights (Windsurf Foiling)", scheme: "RYA Windsurfing", audience: "all", category: "Windsurfing", defaultCapacity: 6, studentsPerInstructor: 6, requiresSafetyBoat: false },

  // --- Paddleboarding (SUP) ---
  { name: "Start Paddleboarding", scheme: "RYA Paddleboarding", audience: "all", category: "Paddleboarding", defaultCapacity: 8, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "Progression Paddleboarding", scheme: "RYA Paddleboarding", audience: "all", category: "Paddleboarding", defaultCapacity: 8, studentsPerInstructor: 6, requiresSafetyBoat: false },

  // --- Powerboat ---
  { name: "Powerboat Level 1", scheme: "RYA Powerboat", audience: "adult", category: "Powerboat", defaultCapacity: 3, studentsPerInstructor: 3, requiresSafetyBoat: false },
  { name: "Powerboat Level 2", scheme: "RYA Powerboat", audience: "adult", category: "Powerboat", defaultCapacity: 3, studentsPerInstructor: 3, requiresSafetyBoat: false },
  { name: "Intermediate Powerboat", scheme: "RYA Powerboat", audience: "adult", category: "Powerboat", defaultCapacity: 3, studentsPerInstructor: 3, requiresSafetyBoat: false },
  { name: "Advanced Powerboat", scheme: "RYA Powerboat", audience: "adult", category: "Powerboat", defaultCapacity: 3, studentsPerInstructor: 3, requiresSafetyBoat: false },
  { name: "Safety Boat Course", scheme: "RYA Powerboat", audience: "adult", category: "Powerboat", defaultCapacity: 6, studentsPerInstructor: 6, requiresSafetyBoat: false },
  { name: "Personal Watercraft (PWC / Jet Ski)", scheme: "RYA Powerboat", audience: "adult", category: "Powerboat", defaultCapacity: 3, studentsPerInstructor: 3, requiresSafetyBoat: false },
  { name: "Tender Operator", scheme: "RYA Powerboat", audience: "adult", category: "Powerboat", defaultCapacity: 3, studentsPerInstructor: 3, requiresSafetyBoat: false },

  // --- Keelboat ---
  { name: "Start Keelboating", scheme: "RYA Keelboat", audience: "adult", category: "Keelboat", defaultCapacity: 4, studentsPerInstructor: 4, requiresSafetyBoat: false },

  // --- Yacht cruising (RYA Cruising / Yachtmaster — practical) ---
  { name: "Start Yachting", scheme: "RYA Cruising", audience: "adult", category: "Yacht cruising", defaultCapacity: 4, studentsPerInstructor: 5, requiresSafetyBoat: false },
  { name: "Competent Crew", scheme: "RYA Cruising", audience: "adult", category: "Yacht cruising", defaultCapacity: 5, studentsPerInstructor: 5, requiresSafetyBoat: false },
  { name: "Day Skipper (Practical)", scheme: "RYA Cruising", audience: "adult", category: "Yacht cruising", defaultCapacity: 5, studentsPerInstructor: 5, requiresSafetyBoat: false },
  { name: "Coastal Skipper (Practical)", scheme: "RYA Cruising", audience: "adult", category: "Yacht cruising", defaultCapacity: 4, studentsPerInstructor: 4, requiresSafetyBoat: false },
  { name: "Yachtmaster Preparation", scheme: "RYA Cruising", audience: "adult", category: "Yacht cruising", defaultCapacity: 4, studentsPerInstructor: 4, requiresSafetyBoat: false },

  // --- Motor cruising (practical) ---
  { name: "Start Motor Cruising", scheme: "RYA Motor Cruising", audience: "adult", category: "Motor cruising", defaultCapacity: 5, studentsPerInstructor: 5, requiresSafetyBoat: false },
  { name: "Helmsman Course", scheme: "RYA Motor Cruising", audience: "adult", category: "Motor cruising", defaultCapacity: 5, studentsPerInstructor: 5, requiresSafetyBoat: false },
  { name: "Day Skipper (Power) Practical", scheme: "RYA Motor Cruising", audience: "adult", category: "Motor cruising", defaultCapacity: 5, studentsPerInstructor: 5, requiresSafetyBoat: false },
  { name: "Coastal Skipper (Power) Practical", scheme: "RYA Motor Cruising", audience: "adult", category: "Motor cruising", defaultCapacity: 4, studentsPerInstructor: 4, requiresSafetyBoat: false },
  { name: "Yachtmaster Preparation (Power)", scheme: "RYA Motor Cruising", audience: "adult", category: "Motor cruising", defaultCapacity: 4, studentsPerInstructor: 4, requiresSafetyBoat: false },

  // --- Shorebased / theory (classroom) ---
  { name: "Essential Navigation & Seamanship", scheme: "RYA Shorebased", audience: "adult", category: "Shorebased theory", defaultCapacity: 12, studentsPerInstructor: 12, requiresSafetyBoat: false },
  { name: "Day Skipper Theory", scheme: "RYA Shorebased", audience: "adult", category: "Shorebased theory", defaultCapacity: 12, studentsPerInstructor: 12, requiresSafetyBoat: false },
  { name: "Coastal / Yachtmaster Theory", scheme: "RYA Shorebased", audience: "adult", category: "Shorebased theory", defaultCapacity: 12, studentsPerInstructor: 12, requiresSafetyBoat: false },
  { name: "VHF / SRC Radio Course", scheme: "RYA Shorebased", audience: "adult", category: "Shorebased theory", defaultCapacity: 12, studentsPerInstructor: 12, requiresSafetyBoat: false },
  { name: "First Aid Course", scheme: "RYA Shorebased", audience: "adult", category: "Shorebased theory", defaultCapacity: 12, studentsPerInstructor: 12, requiresSafetyBoat: false },
  { name: "Sea Survival", scheme: "RYA Shorebased", audience: "adult", category: "Shorebased theory", defaultCapacity: 12, studentsPerInstructor: 12, requiresSafetyBoat: false },
  { name: "Diesel Engine Course", scheme: "RYA Shorebased", audience: "adult", category: "Shorebased theory", defaultCapacity: 12, studentsPerInstructor: 12, requiresSafetyBoat: false },
  { name: "Radar Course", scheme: "RYA Shorebased", audience: "adult", category: "Shorebased theory", defaultCapacity: 12, studentsPerInstructor: 12, requiresSafetyBoat: false },
];
