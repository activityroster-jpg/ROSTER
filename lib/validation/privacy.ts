import { z } from "zod";
import { PRIVACY_REQUEST_KINDS } from "@/lib/db/schema";

export const privacyRequestSchema = z.object({
  kind: z.enum(PRIVACY_REQUEST_KINDS),
  name: z.string().trim().min(1, "Enter your name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  centre: z.string().trim().max(160).optional().or(z.literal("")),
  message: z.string().trim().min(10, "Tell us a little more so we can act on it").max(4000),
  // Honeypot: real people leave it blank.
  website: z.string().max(0).optional().or(z.literal("")),
  turnstileToken: z.string().max(2048).optional(),
});
export type PrivacyRequestInput = z.infer<typeof privacyRequestSchema>;
