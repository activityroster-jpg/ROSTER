import { z } from "zod";
import { ACTIVITY_TYPES, JURISDICTIONS, PLANS, SETUP_MODES } from "@/lib/db/schema";
import { RESERVED_SUBDOMAINS, SLUG_PATTERN } from "@/lib/tenant/reserved";

/**
 * Signup input. The slug is validated for format AND reserved-name here; plan is
 * a fixed enum. The Stripe *price* is NEVER taken from the client — it is looked
 * up server-side from env by plan (see lib/billing/plans).
 */
export const signupSchema = z.object({
  centreName: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_PATTERN, "Use 3–63 letters, numbers or hyphens")
    .refine((s) => !RESERVED_SUBDOMAINS.has(s), "That subdomain is reserved"),
  ownerEmail: z.string().trim().toLowerCase().email(),
  jurisdiction: z.enum(JURISDICTIONS),
  /** What kind of centre: picks the activity pack (lib/packs). */
  activityType: z.enum(ACTIVITY_TYPES).default("rya_centre"),
  plan: z.enum(PLANS),
});

export type SignupInput = z.infer<typeof signupSchema>;

/**
 * Free-month (trial) signup from the marketing site. No Stripe/plan chosen by
 * the client — a trial centre is provisioned and billing is set up later.
 */
export const trialSignupSchema = z.object({
  centreName: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_PATTERN, "Use 3–63 letters, numbers or hyphens")
    .refine((s) => !RESERVED_SUBDOMAINS.has(s), "That subdomain is reserved"),
  ownerEmail: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Use at least 8 characters with a mix of letters and numbers.").max(200).regex(/[A-Za-z]/, "Include at least one letter.").regex(/\d/, "Include at least one number."),
  jurisdiction: z.enum(JURISDICTIONS),
  /** What kind of centre: picks the activity pack (lib/packs). */
  activityType: z.enum(ACTIVITY_TYPES).default("rya_centre"),
  /** Legacy: the home-page form no longer offers a choice; onboarding in the office covers it. */
  setupMode: z.enum(SETUP_MODES).default("basic"),
  /** Detected by the browser (Intl); validated server-side; optional. */
  timeZone: z.string().max(64).optional(),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "Please agree to the Terms and Privacy Policy to continue." }),
  }),
  /** The plan chosen on the pricing page, if any (the centre can change it later). */
  tier: z.enum(["small_club", "standard"]).optional(),
  /** Which box on the site the sign-up came from, for the funnel. */
  source: z.string().trim().max(60).optional(),
});

export type TrialSignupInput = z.infer<typeof trialSignupSchema>;

/** Public slug-availability check input. */
export const slugCheckSchema = z.object({
  slug: z.string().trim().toLowerCase(),
});
