import { z } from "zod";
import { AVAILABILITY_STATUSES, SLOT_CODES, TWO_FACTOR_METHODS } from "@/lib/db/schema";

/**
 * Small Zod schemas shared by server actions that take plain arguments rather
 * than a form body. Every external input is parsed before it reaches a service
 * or repository (CLAUDE.md), including ids the client passes back to us.
 */
export const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Invalid id");
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
export const passwordSchema = z.string().min(8, "Use at least 8 characters with a mix of letters and numbers.").max(200).regex(/[A-Za-z]/, "Include at least one letter.").regex(/\d/, "Include at least one number.");

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

export const twoFactorPrefsSchema = z.object({ method: z.enum(TWO_FACTOR_METHODS) });
export const otpCodeSchema = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code");

export const financeTransactionSchema = z.object({
  date: isoDateSchema,
  category: z.string().min(1).max(60),
  description: z.string().trim().min(1, "Say what it was for").max(200),
  counterparty: z.string().trim().max(120).optional().transform((v) => v || null),
  /** Major units as typed, e.g. "12.50" or "-20"; converted to minor units by the action. */
  amount: z.string().trim().regex(/^-?\d{1,9}(\.\d{1,2})?$/, "Enter an amount like 12.50"),
  vat: z.string().trim().regex(/^\d{1,9}(\.\d{1,2})?$/, "Enter VAT like 2.50").optional().or(z.literal("")),
  currency: z.enum(["GBP", "EUR"]),
  receiptRef: z.string().trim().max(300).optional().transform((v) => v || null),
  notes: z.string().trim().max(1000).optional().transform((v) => v || null),
});
export const financeSettingsSchema = z.object({
  fyStartMonth: z.coerce.number().int().min(1).max(12),
  reportingCurrency: z.enum(["GBP", "EUR"]),
  eurToGbp: z.coerce.number().min(0.3).max(3),
  openingCash: z.string().trim().regex(/^-?\d{1,10}(\.\d{1,2})?$/, "Enter an amount like 1500.00").optional().or(z.literal("")),
  openingCashDate: isoDateSchema.optional().or(z.literal("")),
});

export const studentsSchema = z.coerce.number().int().min(1, "Enter how many students (at least 1)").max(500);
export const trialDaysSchema = z.coerce.number().int().min(1, "Enter 1–365 days").max(365);

/** First issue message, for a one-line error back to the form. */
export const firstIssue = (e: z.ZodError, fallback = "Please check the values") => e.issues[0]?.message ?? fallback;
