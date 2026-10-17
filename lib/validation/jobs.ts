import { z } from "zod";
import { isRealIsoDate } from "@/lib/domain/time";
import { JOB_EMPLOYMENT_TYPES, JOB_PAY_TYPES, JOB_ROLE_TYPES } from "@/lib/db/schema";
import { DESCRIPTION_MAX, PAY_WITHOUT_AMOUNT, REGION_OPTIONS } from "@/lib/domain/jobs";

/**
 * Job posts for Boaty Jobs, from the centre's editor. Never trusted for the
 * centre, status or listing fields: those come from the TenantContext and from
 * Boaty Jobs' own responses.
 */
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD").refine(isRealIsoDate, "That date doesn't exist");
const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

export const jobInputSchema = z
  .object({
    title: z.string().trim().min(3, "Give the job a title").max(120, "Keep the title under 120 characters"),
    roleType: z.enum(JOB_ROLE_TYPES),
    employmentType: z.enum(JOB_EMPLOYMENT_TYPES),
    positions: z.number().int().min(1).max(50),
    startDate: dateStr,
    endDate: dateStr.nullable(),
    payType: z.enum(JOB_PAY_TYPES),
    payAmountGbp: z.number().min(0).max(1_000_000).nullable(),
    accommodation: z.boolean(),
    locationText: z.string().trim().max(200),
    requiredQualifications: z.array(z.string().trim().min(1).max(100)).max(20),
    description: z.string().trim().min(20, "Describe the job in a few sentences").max(DESCRIPTION_MAX, `Up to ${DESCRIPTION_MAX.toLocaleString("en-GB")} characters`),
    closingDate: dateStr,
    applicationEmail: email,
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, { path: ["endDate"], message: "The end date is before the start date" })
  .refine((v) => PAY_WITHOUT_AMOUNT.includes(v.payType) || v.payAmountGbp !== null, { path: ["payAmountGbp"], message: "Enter the pay, or choose Competitive" });

export type JobInput = z.infer<typeof jobInputSchema>;

export const recruitProfileSchema = z.object({
  town: z.string().trim().max(80),
  postcode: z.string().trim().toUpperCase().max(10),
  region: z.enum(REGION_OPTIONS.map((r) => r.value) as [string, ...string[]]).nullable(),
  website: z.string().trim().max(200).refine((v) => v === "" || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), "Start the website with https://"),
  logoUrl: z.string().trim().max(500).refine((v) => v === "" || /^https:\/\/[^\s]+$/i.test(v), "Use an https:// link to the logo image"),
  email: email.or(z.literal("")),
});

export type RecruitProfileInput = z.infer<typeof recruitProfileSchema>;
