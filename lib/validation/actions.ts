import { z } from "zod";
import { AVAILABILITY_STATUSES, SLOT_CODES } from "@/lib/db/schema";

/**
 * Small Zod schemas shared by server actions that take plain arguments rather
 * than a form body. Every external input is parsed before it reaches a service
 * or repository (CLAUDE.md), including ids the client passes back to us.
 */
export const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Invalid id");
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
export const passwordSchema = z.string().min(10, "Use at least 10 characters.").max(200);

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  phone: z.string().trim().max(40),
});

export const declineSchema = z.object({
  assignmentId: idSchema,
  note: z.string().trim().min(2, "Tell your centre why, so they can find cover.").max(500),
});

export const availabilityEntrySchema = z.object({
  date: isoDateSchema,
  slot: z.enum(SLOT_CODES),
  status: z.enum(AVAILABILITY_STATUSES).nullable(),
});
export const availabilityBulkSchema = z.array(availabilityEntrySchema).min(1, "Nothing to set").max(50);

export const studentsSchema = z.coerce.number().int().min(1, "Enter how many students (at least 1)").max(500);
export const trialDaysSchema = z.coerce.number().int().min(1, "Enter 1–365 days").max(365);

/** First issue message, for a one-line error back to the form. */
export const firstIssue = (e: z.ZodError, fallback = "Please check the values") => e.issues[0]?.message ?? fallback;
