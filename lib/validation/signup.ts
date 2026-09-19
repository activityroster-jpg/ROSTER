import { z } from "zod";
import { JURISDICTIONS, PLANS } from "@/lib/db/schema";
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

/** Public slug-availability check input. */
export const slugCheckSchema = z.object({
  slug: z.string().trim().toLowerCase(),
});
