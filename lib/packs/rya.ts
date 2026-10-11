import { DEFAULT_COURSE_TYPES, DEFAULT_EQUIPMENT_TYPES, DEFAULT_GRADES, DEFAULT_LOCATION_TYPES, DEFAULT_ROLES, DEFAULT_SLOTS, defaultComplianceTypes } from "@/lib/seed/catalogue";
import type { ActivityPack } from "./types";

/** RYA centre / school (training centres, sailing schools and clubs): the original pack, built from the lists every centre has had so far. */
export const RYA_CENTRE_PACK: ActivityPack = {
  id: "rya_centre",
  label: "RYA centre / school",
  blurb: "Training centres, sailing schools and clubs running RYA courses: sailing, windsurfing, powerboat, paddleboard.",
  wording: {
    body: "RYA",
    centreNoun: "centre",
    certsLabel: "RYA licences and qualifications",
    courseListName: "RYA course list",
    addAllCourses: "+ Add all RYA courses",
    addAllTypes: "+ Add all RYA types",
    schemePlaceholder: "e.g. RYA Youth Sailing",
    adultHint: "Adult courses and RYA cruising / powerboat",
    defaultsNote: "You're on the RYA defaults and can start rostering now — these steps unlock the rest.",
  },
  settings: { slotStyle: "slots" },
  slots: DEFAULT_SLOTS,
  roles: DEFAULT_ROLES,
  grades: DEFAULT_GRADES,
  compliance: defaultComplianceTypes,
  equipment: DEFAULT_EQUIPMENT_TYPES,
  locationTypes: DEFAULT_LOCATION_TYPES,
  courseTypes: DEFAULT_COURSE_TYPES,
};
