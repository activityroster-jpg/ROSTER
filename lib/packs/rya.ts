import { DEFAULT_COURSE_TYPES, DEFAULT_EQUIPMENT_TYPES, DEFAULT_GRADES, DEFAULT_LOCATION_TYPES, DEFAULT_ROLES, DEFAULT_SLOTS, defaultComplianceTypes } from "@/lib/seed/catalogue";
import type { ActivityPack } from "./types";

/** RYA training centre: the original pack, built from the lists every centre has had so far. */
export const RYA_CENTRE_PACK: ActivityPack = {
  id: "rya_centre",
  label: "RYA training centre",
  blurb: "Sailing, windsurfing, powerboat and paddleboard courses to RYA schemes.",
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

/**
 * Sailing club: the same RYA lists, with the roles a volunteer-run club
 * rosters (duty officer, race officer) and club racing first in the list.
 */
export const SAILING_CLUB_PACK: ActivityPack = {
  ...RYA_CENTRE_PACK,
  id: "sailing_club",
  label: "Sailing club",
  blurb: "Club racing, duty rotas and RYA training run by members and volunteers.",
  wording: {
    ...RYA_CENTRE_PACK.wording,
    centreNoun: "club",
    defaultsNote: "You're on the RYA club defaults and can start rostering now — these steps unlock the rest.",
  },
  roles: [
    ...DEFAULT_ROLES,
    { name: "Duty Officer", code: "DUTY_OFFICER", countsTowardRatio: false, isSafetyCover: false, isFirstAider: false },
    { name: "Race Officer", code: "RACE_OFFICER", countsTowardRatio: false, isSafetyCover: false, isFirstAider: false },
    { name: "Galley / Bar", code: "GALLEY", countsTowardRatio: false, isSafetyCover: false, isFirstAider: false },
  ],
  courseTypes: [
    ...DEFAULT_COURSE_TYPES.filter((c) => c.category === "Racing"),
    ...DEFAULT_COURSE_TYPES.filter((c) => c.category !== "Racing"),
  ],
};
