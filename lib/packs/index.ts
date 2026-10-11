import { ACTIVITY_TYPES, type ActivityType } from "@/lib/db/schema";
import { RYA_CENTRE_PACK } from "./rya";
import { PADI_CENTRE_PACK } from "./padi";
import type { ActivityPack } from "./types";

export type { ActivityPack, PackWording } from "./types";

/**
 * Every kind of centre the platform is sold to. Adding one means adding a pack
 * here and a value to ACTIVITY_TYPES in the schema; nothing in the core changes.
 * The order is the order shown at sign-up.
 */
export const PACKS: Record<ActivityType, ActivityPack> = {
  rya_centre: RYA_CENTRE_PACK,
  padi_centre: PADI_CENTRE_PACK,
};

export const PACK_LIST: ActivityPack[] = ACTIVITY_TYPES.map((id) => PACKS[id]);

export function isActivityType(v: unknown): v is ActivityType {
  return typeof v === "string" && (ACTIVITY_TYPES as readonly string[]).includes(v);
}

/** The pack for a centre; an unknown or missing value is the RYA centre (every centre before packs existed). */
export function packFor(activityType: string | null | undefined): ActivityPack {
  return isActivityType(activityType) ? PACKS[activityType] : RYA_CENTRE_PACK;
}

/** Sign-up options: id, label and blurb only (no lists), safe for the client. */
export const PACK_OPTIONS = PACK_LIST.map((p) => ({ id: p.id as ActivityType, label: p.label, blurb: p.blurb }));
