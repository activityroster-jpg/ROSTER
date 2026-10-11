import type { Jurisdiction } from "@/lib/db/schema";
import type { ComplianceSeed, CourseTypeSeed, EquipmentTypeSeed, GradeSeed, RoleSeed, SlotSeed } from "@/lib/seed/catalogue";

/**
 * An activity pack: everything that makes one kind of centre (RYA sailing
 * centre, sailing club, PADI dive centre, …) different at the start. The heart
 * of the platform (roster, availability, checks, pay, app, billing) is shared
 * and identical; a pack only supplies the starting lists, the default settings
 * and the words. After provisioning the lists belong to the centre
 * (deactivate-never-delete), exactly as before.
 */
export interface PackWording {
  /** The governing body in short: "RYA", "PADI". */
  body: string;
  /** What the person signing up calls their place: "centre", "dive centre". */
  centreNoun: string;
  /** "RYA licences and qualifications" → used where certs are explained. */
  certsLabel: string;
  /** The name of the standard course list: "RYA course list". */
  courseListName: string;
  addAllCourses: string;
  addAllTypes: string;
  schemePlaceholder: string;
  adultHint: string;
  /** Dashboard line for a centre that kept the defaults. */
  defaultsNote: string;
}

export interface PackSettings {
  /** AM/PM/EV slots or set times. */
  slotStyle?: "slots" | "times";
}

export interface ActivityPack {
  id: string;
  /** Shown at sign-up and in the Dev Center. */
  label: string;
  /** One line under the label at sign-up. */
  blurb: string;
  wording: PackWording;
  settings: PackSettings;
  slots: SlotSeed[];
  roles: RoleSeed[];
  grades: GradeSeed[];
  compliance: (jurisdiction: Jurisdiction) => ComplianceSeed[];
  equipment: EquipmentTypeSeed[];
  locationTypes: string[];
  courseTypes: CourseTypeSeed[];
}
