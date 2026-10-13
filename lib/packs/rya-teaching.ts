/**
 * Which RYA courses each instructor type can teach: the source of truth for
 * "who can teach what" in an RYA centre (Conor, 13 Oct 2026; windsurfing from
 * the RYA's current windsurf instructor page). Seeded into each centre as
 * qualification_course_type rows, which the centre can then change in Course
 * setup. Codes are DEFAULT_GRADES codes; course names are DEFAULT_COURSE_TYPES
 * names.
 *
 *   alsoRequires  — the person must also hold this (a Powerboat Instructor
 *                   teaches Safety Boat only with the Safety Boat certificate).
 *   needsApproval — only with the Principal or Chief Instructor's approval,
 *                   given per person on their profile.
 */
export interface TeachingSeed {
  type: string;
  course: string;
  alsoRequires?: string;
  needsApproval?: boolean;
}

const L1 = "Start Sailing (Level 1)";
const L2 = "Basic Skills (Level 2)";
const L3 = "Improving Skills";
const YOUTH_1_3 = ["Youth Stage 1", "Youth Stage 2", "Youth Stage 3"];
const YOUTH_1_4 = [...YOUTH_1_3, "Youth Stage 4"];
// Kids' dinghy courses outside the stages: the same people as Youth Stages 1–3.
const KIDS = ["Summer Camp (5-day)", "Junior Club Session", "School Group Session"];
const DI_COURSES = [L1, L2, L3, ...YOUTH_1_4, "Youth Advanced Boat Handling", ...KIDS];
const DI_WITH_APPROVAL = ["Day Sailing", "Seamanship Skills", "Sailing with Spinnakers"];
const WIND_YOUTH = ["Youth Windsurfing Stage 1", "Youth Windsurfing Stage 2", "Youth Windsurfing Stage 3", "Youth Windsurfing Stage 4"];
const WIND_SCHEME = ["Start Windsurfing", "Intermediate Windsurfing", "Advanced Windsurfing", ...WIND_YOUTH];
const CRUISING_SAIL = ["Start Yachting", "Competent Crew", "Day Skipper (Practical)"];
const CRUISING_POWER = ["Start Motor Cruising", "Helmsman Course", "Day Skipper (Power) Practical"];

const many = (type: string, courses: readonly string[], extra: Omit<TeachingSeed, "type" | "course"> = {}): TeachingSeed[] => courses.map((course) => ({ type, course, ...extra }));

export const RYA_TEACHING: TeachingSeed[] = [
  // --- Dinghy, keelboat and multihull ---
  // Assistant Instructor: up to Level 2 or Youth Stage 3, supervised.
  ...many("AI", [L1, L2, ...YOUTH_1_3, ...KIDS]),
  // Dinghy Instructor: Levels 1–3 and Youth Stages 1–4, supervised; the three
  // higher adult courses only with the Principal's approval.
  ...many("DI", DI_COURSES),
  ...many("DI", DI_WITH_APPROVAL, { needsApproval: true }),
  // Endorsements add courses on top of the DI.
  ...many("ADI", [...DI_COURSES, ...DI_WITH_APPROVAL, "Performance Sailing"]),
  ...many("KBI", ["Start Keelboating"]),
  ...many("KBSI", ["Start Keelboating"]),
  ...many("RACE", ["Start Racing"]),
  ...many("FOIL", ["First Flights (Foiling)"]),
  // Senior Instructor: everything a DI teaches, plus running courses.
  ...many("SI", [...DI_COURSES, ...DI_WITH_APPROVAL]),
  // Racing coaches and Sailability: their own courses.
  ...many("DRC", ["Start Racing", "Club Racing", "Race Coaching"]),
  ...many("SAIL", ["Sailability Session"]),
  // Multihull Endorsement and Coach/Assessor: no extra courses on the starting
  // list (multihull versions and instructor training aren't on it).

  // --- Windsurfing ---
  ...many("WAI", ["Start Windsurfing", "Youth Windsurfing Stage 1"]),
  ...many("WI", ["Start Windsurfing", "Youth Windsurfing Stage 1", "Youth Windsurfing Stage 2"]),
  ...many("IWI", ["Intermediate Windsurfing", ...WIND_YOUTH]),
  ...many("WRI", ["Start Racing (Windsurf)"]),
  ...many("WFI", ["First Flights (Windsurf Foiling)"]),
  ...many("AWI", WIND_SCHEME),
  ...many("SWI", WIND_SCHEME),
  ...many("WT", ["Start Windsurfing", "Intermediate Windsurfing"]),

  // --- Paddleboarding ---
  ...many("SUPI", ["Start Paddleboarding", "Progression Paddleboarding"]),

  // --- Powerboat and PWC ---
  ...many("PBI", ["Powerboat Level 1", "Powerboat Level 2"]),
  { type: "PBI", course: "Safety Boat Course", alsoRequires: "SBC" },
  { type: "APBI", course: "Intermediate Powerboat" },
  { type: "APBI", course: "Tender Operator", alsoRequires: "CEND" },
  { type: "APBI", course: "Advanced Powerboat", alsoRequires: "CEND" },
  ...many("PWCI", ["Personal Watercraft (PWC / Jet Ski)"]),

  // --- Sail cruising ---
  ...many("CI", CRUISING_SAIL),
  ...many("YMI", [...CRUISING_SAIL, "Coastal Skipper (Practical)", "Yachtmaster Preparation"]),

  // --- Motor cruising ---
  ...many("MCI", CRUISING_POWER),
  ...many("MYMI", [...CRUISING_POWER, "Coastal Skipper (Power) Practical", "Yachtmaster Preparation (Power)"]),

  // --- Shorebased and short courses ---
  ...many("SBI", ["Essential Navigation & Seamanship", "Day Skipper Theory", "Coastal / Yachtmaster Theory"]),
  ...many("VHFI", ["VHF / SRC Radio Course"]),
  ...many("FAI", ["First Aid Course"]),
  ...many("SSVI", ["Sea Survival"]),
  ...many("RADI", ["Radar Course"]),
  ...many("DEI", ["Diesel Engine Course"]),
];
