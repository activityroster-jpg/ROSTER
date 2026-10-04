import { z } from "zod";
import { JURISDICTIONS, PLANS, SETUP_MODES } from "@/lib/db/schema";
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
  /** Legacy: the home-page form no longer offers a choice; onboarding in the office covers it. */
  setupMode: z.enum(SETUP_MODES).default("basic"),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "Please agree to the Terms and Privacy Policy to continue." }),
  }),
});

export type TrialSignupInput = z.infer<typeof trialSignupSchema>;

/** Public slug-availability check input. */
export const slugCheckSchema = z.object({
  slug: z.string().trim().toLowerCase(),
});
