import type { Jurisdiction } from "@/lib/db/schema";
import { vettingFor, type ComplianceSeed, type CourseTypeSeed, type EquipmentTypeSeed, type GradeSeed, type RoleSeed, type SlotSeed } from "@/lib/seed/catalogue";
import type { ActivityPack } from "./types";

/**
 * PADI dive centre. Ratios are one figure per course type (the open-water
 * figure, the stricter one); the centre adjusts them. Nothing here is
 * mandatory or blocks rostering until the centre says so in Settings.
 */
const SLOTS: SlotSeed[] = [
  { code: "AM", label: "Morning dive", startTime: "08:00", endTime: "12:30", sortOrder: 0 },
  { code: "PM", label: "Afternoon dive", startTime: "13:00", endTime: "17:00", sortOrder: 1 },
  { code: "EV", label: "Night dive", startTime: "18:30", endTime: "21:30", sortOrder: 2 },
];

const ROLES: RoleSeed[] = [
  { name: "Instructor", code: "INSTRUCTOR", countsTowardRatio: true, isSafetyCover: false, isFirstAider: false },
  { name: "Assistant Instructor", code: "ASSISTANT", countsTowardRatio: true, isSafetyCover: false, isFirstAider: false },
  { name: "Divemaster", code: "DIVEMASTER", countsTowardRatio: true, isSafetyCover: false, isFirstAider: false },
  { name: "Boat Skipper", code: "SAFETY_BOAT", countsTowardRatio: false, isSafetyCover: true, isFirstAider: false },
  { name: "Dive Centre Staff", code: "STAFF", countsTowardRatio: false, isSafetyCover: false, isFirstAider: false },
  { name: "Volunteer", code: "VOLUNTEER", countsTowardRatio: false, isSafetyCover: false, isFirstAider: false },
];

const GRADES: GradeSeed[] = [
  // Professional ratings, in order
  { name: "Divemaster", code: "DM", rank: 10, discipline: "diving", expiryTracked: false },
  { name: "Assistant Instructor", code: "AI", rank: 15, discipline: "diving", expiryTracked: false },
  { name: "Open Water Scuba Instructor", code: "OWSI", rank: 20, discipline: "diving", expiryTracked: false },
  { name: "Master Scuba Diver Trainer", code: "MSDT", rank: 30, discipline: "diving", expiryTracked: false },
  { name: "IDC Staff Instructor", code: "IDCS", rank: 40, discipline: "diving", expiryTracked: false },
  { name: "Master Instructor", code: "MI", rank: 45, discipline: "diving", expiryTracked: false },
  { name: "Course Director", code: "CD", rank: 50, discipline: "diving", expiryTracked: false },
  // Specialty instructor ratings
  { name: "Deep Diver Instructor", code: "SI_DEEP", rank: 25, discipline: "diving", expiryTracked: false },
  { name: "Wreck Diver Instructor", code: "SI_WRECK", rank: 25, discipline: "diving", expiryTracked: false },
  { name: "Enriched Air (Nitrox) Instructor", code: "SI_EANX", rank: 25, discipline: "diving", expiryTracked: false },
  { name: "Dry Suit Diver Instructor", code: "SI_DRYSUIT", rank: 25, discipline: "diving", expiryTracked: false },
  { name: "Night Diver Instructor", code: "SI_NIGHT", rank: 25, discipline: "diving", expiryTracked: false },
  { name: "Underwater Navigator Instructor", code: "SI_NAV", rank: 25, discipline: "diving", expiryTracked: false },
  { name: "Search & Recovery Instructor", code: "SI_SAR", rank: 25, discipline: "diving", expiryTracked: false },
  { name: "Peak Performance Buoyancy Instructor", code: "SI_PPB", rank: 25, discipline: "diving", expiryTracked: false },
  { name: "Digital Underwater Photographer Instructor", code: "SI_PHOTO", rank: 25, discipline: "diving", expiryTracked: false },
  { name: "Sidemount Diver Instructor", code: "SI_SIDEMOUNT", rank: 25, discipline: "diving", expiryTracked: false },
  { name: "Self-Reliant Diver Instructor", code: "SI_SELF", rank: 25, discipline: "diving", expiryTracked: false },
  { name: "Boat Diver Instructor", code: "SI_BOAT", rank: 25, discipline: "diving", expiryTracked: false },
  { name: "Drift Diver Instructor", code: "SI_DRIFT", rank: 25, discipline: "diving", expiryTracked: false },
  { name: "Equipment Specialist Instructor", code: "SI_EQUIP", rank: 25, discipline: "diving", expiryTracked: false },
  { name: "Rebreather Instructor", code: "SI_CCR", rank: 35, discipline: "diving", expiryTracked: false },
  { name: "Tec Diving Instructor", code: "SI_TEC", rank: 35, discipline: "diving", expiryTracked: false },
  // Other
  { name: "Freediver Instructor", code: "FDI", rank: 20, discipline: "freediving", expiryTracked: false },
  { name: "Emergency First Response Instructor", code: "EFRI", rank: 15, discipline: "first_aid", expiryTracked: false },
  { name: "Boat Handling / Skipper Certificate", code: "BOAT", rank: 15, discipline: "powerboat", expiryTracked: false },
];

function compliance(jurisdiction: Jurisdiction): ComplianceSeed[] {
  return [
    { name: "PADI Membership Renewal", code: "PADI_RENEWAL", mandatory: false, expiryTracked: true },
    { name: "Professional Liability Insurance", code: "INSURANCE", mandatory: false, expiryTracked: true },
    { name: "Diving Medical (HSE MA1 in the UK)", code: "DIVE_MEDICAL", mandatory: false, expiryTracked: true },
    { name: "Emergency First Response / First Aid", code: "FIRST_AID", mandatory: false, expiryTracked: true },
    { name: "Oxygen Provider", code: "OXYGEN", mandatory: false, expiryTracked: true },
    { name: "Safeguarding Training", code: "SAFEGUARDING", mandatory: false, expiryTracked: true },
    vettingFor(jurisdiction),
  ];
}

const EQUIPMENT: EquipmentTypeSeed[] = [
  { name: "Dive Boat", inventoryTracked: true },
  { name: "RIB", inventoryTracked: true },
  { name: "Compressor", inventoryTracked: true },
  { name: "Oxygen Kit", inventoryTracked: true },
  { name: "Cylinder", inventoryTracked: false },
  { name: "BCD", inventoryTracked: false },
  { name: "Regulator", inventoryTracked: false },
  { name: "Dive Computer", inventoryTracked: false },
  { name: "Wetsuit", inventoryTracked: false },
  { name: "Drysuit", inventoryTracked: false },
  { name: "Mask, Fins & Snorkel", inventoryTracked: false },
  { name: "Weights", inventoryTracked: false },
  { name: "Other", inventoryTracked: false },
];

const LOCATIONS: string[] = [
  "Pool",
  "Shore dive site",
  "Boat dive site",
  "Dive boat / berth",
  "Classroom",
  "Kit room / fill station",
  "Changing facilities",
  "Meeting point",
];

const P = "PADI";
const COURSES: CourseTypeSeed[] = [
  // --- Entry level ---
  { name: "Discover Scuba Diving", scheme: P, audience: "all", category: "Try dives", defaultCapacity: 4, studentsPerInstructor: 4, requiresSafetyBoat: false },
  { name: "Scuba Diver", scheme: P, audience: "adult", category: "Entry level", defaultCapacity: 8, studentsPerInstructor: 8, requiresSafetyBoat: false },
  { name: "Open Water Diver", scheme: P, audience: "adult", category: "Entry level", defaultCapacity: 8, studentsPerInstructor: 8, requiresSafetyBoat: false },
  { name: "Open Water Referral (pool & theory)", scheme: P, audience: "adult", category: "Entry level", defaultCapacity: 8, studentsPerInstructor: 8, requiresSafetyBoat: false },
  { name: "Scuba Refresher (ReActivate)", scheme: P, audience: "adult", category: "Entry level", defaultCapacity: 8, studentsPerInstructor: 8, requiresSafetyBoat: false },
  // --- Continuing education ---
  { name: "Advanced Open Water Diver", scheme: P, audience: "adult", category: "Continuing education", defaultCapacity: 8, studentsPerInstructor: 8, requiresSafetyBoat: false },
  { name: "Rescue Diver", scheme: P, audience: "adult", category: "Continuing education", defaultCapacity: 8, studentsPerInstructor: 8, requiresSafetyBoat: false },
  { name: "Emergency First Response (EFR)", scheme: `${P} EFR`, audience: "all", category: "Continuing education", defaultCapacity: 12, studentsPerInstructor: 12, requiresSafetyBoat: false },
  { name: "Master Scuba Diver", scheme: P, audience: "adult", category: "Continuing education", defaultCapacity: 8, studentsPerInstructor: 8, requiresSafetyBoat: false },
  // --- Specialties ---
  { name: "Deep Diver", scheme: P, audience: "adult", category: "Specialties", defaultCapacity: 4, studentsPerInstructor: 4, requiresSafetyBoat: false },
  { name: "Wreck Diver", scheme: P, audience: "adult", category: "Specialties", defaultCapacity: 4, studentsPerInstructor: 4, requiresSafetyBoat: false },
  { name: "Enriched Air (Nitrox) Diver", scheme: P, audience: "adult", category: "Specialties", defaultCapacity: 8, studentsPerInstructor: 8, requiresSafetyBoat: false },
  { name: "Dry Suit Diver", scheme: P, audience: "adult", category: "Specialties", defaultCapacity: 8, studentsPerInstructor: 8, requiresSafetyBoat: false },
  { name: "Night Diver", scheme: P, audience: "adult", category: "Specialties", defaultCapacity: 8, studentsPerInstructor: 8, requiresSafetyBoat: false },
  { name: "Underwater Navigator", scheme: P, audience: "adult", category: "Specialties", defaultCapacity: 8, studentsPerInstructor: 8, requiresSafetyBoat: false },
  { name: "Peak Performance Buoyancy", scheme: P, audience: "adult", category: "Specialties", defaultCapacity: 8, studentsPerInstructor: 8, requiresSafetyBoat: false },
  { name: "Search & Recovery Diver", scheme: P, audience: "adult", category: "Specialties", defaultCapacity: 8, studentsPerInstructor: 8, requiresSafetyBoat: false },
  { name: "Boat Diver", scheme: P, audience: "adult", category: "Specialties", defaultCapacity: 8, studentsPerInstructor: 8, requiresSafetyBoat: true },
  { name: "Drift Diver", scheme: P, audience: "adult", category: "Specialties", defaultCapacity: 8, studentsPerInstructor: 8, requiresSafetyBoat: true },
  { name: "Sidemount Diver", scheme: P, audience: "adult", category: "Specialties", defaultCapacity: 4, studentsPerInstructor: 4, requiresSafetyBoat: false },
  { name: "Digital Underwater Photographer", scheme: P, audience: "adult", category: "Specialties", defaultCapacity: 8, studentsPerInstructor: 8, requiresSafetyBoat: false },
  { name: "Equipment Specialist", scheme: P, audience: "adult", category: "Specialties", defaultCapacity: 12, studentsPerInstructor: 12, requiresSafetyBoat: false },
  { name: "Self-Reliant Diver", scheme: P, audience: "adult", category: "Specialties", defaultCapacity: 4, studentsPerInstructor: 4, requiresSafetyBoat: false },
  // --- Youth ---
  { name: "Bubblemaker (8+)", scheme: P, audience: "youth", category: "Youth", defaultCapacity: 4, studentsPerInstructor: 4, requiresSafetyBoat: false },
  { name: "Seal Team", scheme: P, audience: "youth", category: "Youth", defaultCapacity: 4, studentsPerInstructor: 4, requiresSafetyBoat: false },
  { name: "Junior Open Water Diver (10–14)", scheme: P, audience: "youth", category: "Youth", defaultCapacity: 4, studentsPerInstructor: 4, requiresSafetyBoat: false },
  { name: "Junior Advanced Open Water (12–14)", scheme: P, audience: "youth", category: "Youth", defaultCapacity: 4, studentsPerInstructor: 4, requiresSafetyBoat: false },
  // --- Professional ---
  { name: "Divemaster Course", scheme: P, audience: "adult", category: "Professional", defaultCapacity: 8, studentsPerInstructor: 8, requiresSafetyBoat: false },
  { name: "Assistant Instructor Course", scheme: P, audience: "adult", category: "Professional", defaultCapacity: 8, studentsPerInstructor: 8, requiresSafetyBoat: false },
  { name: "Instructor Development Course (IDC)", scheme: P, audience: "adult", category: "Professional", defaultCapacity: 8, studentsPerInstructor: 8, requiresSafetyBoat: false },
  // --- Guided diving & other ---
  { name: "Guided Dive (certified divers)", scheme: P, audience: "adult", category: "Guided diving", defaultCapacity: 8, studentsPerInstructor: 8, requiresSafetyBoat: false },
  { name: "Boat Dive Trip", scheme: P, audience: "adult", category: "Guided diving", defaultCapacity: 12, studentsPerInstructor: 8, requiresSafetyBoat: true },
  { name: "Discover Snorkeling", scheme: P, audience: "all", category: "Try dives", defaultCapacity: 10, studentsPerInstructor: 10, requiresSafetyBoat: false },
  { name: "Freediver", scheme: `${P} Freediver`, audience: "adult", category: "Freediving", defaultCapacity: 8, studentsPerInstructor: 4, requiresSafetyBoat: false },
];

export const PADI_CENTRE_PACK: ActivityPack = {
  id: "padi_centre",
  label: "PADI dive centre",
  blurb: "Scuba courses, guided dives and boat trips to PADI standards.",
  wording: {
    body: "PADI",
    centreNoun: "dive centre",
    certsLabel: "PADI ratings and certificates",
    courseListName: "PADI course list",
    addAllCourses: "+ Add all PADI courses",
    addAllTypes: "+ Add all PADI ratings",
    schemePlaceholder: "e.g. PADI",
    adultHint: "Adult courses, specialties and professional-level training",
    defaultsNote: "You're on the PADI defaults and can start rostering now — these steps unlock the rest.",
  },
  settings: { slotStyle: "slots" },
  slots: SLOTS,
  roles: ROLES,
  grades: GRADES,
  compliance,
  equipment: EQUIPMENT,
  locationTypes: LOCATIONS,
  courseTypes: COURSES,
};
