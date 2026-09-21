import { z } from "zod";
import { LEAD_ORG_TYPES } from "@/lib/db/schema";

/** Public marketing lead capture. Email required; everything else optional. */
export const leadSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  centreName: z.string().trim().max(160).optional().or(z.literal("")),
  orgType: z.enum(LEAD_ORG_TYPES).optional(),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  source: z.string().trim().max(60).optional(),
});

export type LeadInput = z.infer<typeof leadSchema>;
