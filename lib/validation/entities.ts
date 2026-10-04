import { z } from "zod";
import {
  AVAILABILITY_STATUSES,
  COURSE_STATUSES,
  EMPLOYMENT_TYPES,
  INSTRUCTOR_STATUSES,
  SCHEDULING_MODES,
  SLOT_CODES,
  WORKING_TIME_MODES,
} from "@/lib/db/schema";

/**
 * Zod schemas for tenant entity writes. Route handlers parse the request body
 * with these BEFORE calling a repository — the client is never trusted for
 * shape, and `organisation_id` is never accepted from input (it comes from the
 * TenantContext).
 */

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:MM");

export const orgSettingsSchema = z.object({
  schedulingMode: z.enum(SCHEDULING_MODES),
  alertLeadDays: z.number().int().min(0).max(365),
  availabilityWeeksAhead: z.number().int().min(1, "Ask for at least one week").max(26, "Up to 26 weeks ahead").optional(),
  currency: z.string().length(3),
  timezone: z.string().min(1).optional(),
  enforceLicenceChecks: z.boolean().optional(),
  enforceRatioChecks: z.boolean().optional(),
  enforceConflictChecks: z.boolean().optional(),
  enforceAvailabilityChecks: z.boolean().optional(),
  checkEquipmentQuantities: z.boolean().optional(),
  holidayPayPercent: z.number().min(0).max(50).nullable().optional(),
  privacyNoticeUrl: z.string().trim().url("Enter a full web address, starting with https://").max(500).refine((u) => /^https:\/\//i.test(u), "Use a secure web address, starting with https://").optional().or(z.literal("")),
  dailyDigestEnabled: z.boolean().optional(),
  dailyDigestHour: z.number().int().min(0).max(23).optional(),
  workingTimeMode: z.enum(WORKING_TIME_MODES).optional(),
  idleTimeoutMinutes: z.number().int().min(5).max(240).optional(),
  requireParentApproval: z.boolean().optional(),
  termDates: z.array(z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Term dates are YYYY-MM-DD"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Term dates are YYYY-MM-DD"),
    label: z.string().trim().max(60).optional(),
  }).refine((r) => r.from <= r.to, "A term can't end before it starts")).max(60).optional(),
});

export const sessionSlotSchema = z.object({
  code: z.enum(SLOT_CODES),
  label: z.string().min(1),
  startTime: timeStr,
  endTime: timeStr,
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const roleTypeSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  countsTowardRatio: z.boolean().default(true),
  isSafetyCover: z.boolean().default(false),
  isFirstAider: z.boolean().default(false),
  active: z.boolean().default(true),
});

export const qualificationTypeSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  rank: z.number().int().default(0),
  discipline: z.string().optional(),
  expiryTracked: z.boolean().default(false),
  defaultValidMonths: z.number().int().positive().nullable().optional(),
  active: z.boolean().default(true),
});

export const complianceTypeSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  mandatory: z.boolean().default(false),
  expiryTracked: z.boolean().default(true),
  /** Vetting checks (DBS, PVG, AccessNI, Garda) are recorded by status and reference only; no certificate file is stored. */
  isVetting: z.boolean().default(false),
  active: z.boolean().default(true),
});

export const dobSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date of birth as YYYY-MM-DD");

export const protectedContactsSchema = z.object({
  guardianName: z.string().trim().max(120).optional().or(z.literal("")),
  guardianPhone: z.string().trim().max(40).optional().or(z.literal("")),
  guardianEmail: z.string().trim().toLowerCase().email("Enter a valid guardian email").max(200).optional().or(z.literal("")),
  emergencyName: z.string().trim().max(120).optional().or(z.literal("")),
  emergencyPhone: z.string().trim().max(40).optional().or(z.literal("")),
  emergencyRelationship: z.string().trim().max(60).optional().or(z.literal("")),
});

export const instructorSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  dateOfBirth: dobSchema.optional().or(z.literal("")),
  employmentType: z.enum(EMPLOYMENT_TYPES).default("employed"),
  status: z.enum(INSTRUCTOR_STATUSES).default("active"),
});

export const qualificationSchema = z.object({
  instructorId: z.string().min(1),
  qualificationTypeId: z.string().min(1),
  certNo: z.string().optional(),
  issueDate: dateStr.optional(),
  expiryDate: dateStr.nullable().optional(),
  verified: z.boolean().default(false),
});

export const complianceItemSchema = z.object({
  instructorId: z.string().min(1),
  complianceTypeId: z.string().min(1),
  reference: z.string().optional(),
  issueDate: dateStr.optional(),
  expiryDate: dateStr.nullable().optional(),
  verified: z.boolean().default(false),
});

export const courseSchema = z.object({
  courseTypeId: z.string().min(1),
  name: z.string().optional(),
  capacity: z.number().int().min(0),
  ratio: z.number().int().min(1),
  status: z.enum(COURSE_STATUSES).default("draft"),
  notes: z.string().optional(),
});

export const courseSessionSchema = z.object({
  courseId: z.string().min(1),
  date: dateStr,
  slot: z.enum(SLOT_CODES),
  startAt: z.number().int(),
  endAt: z.number().int(),
});

export const courseStaffSchema = z.object({
  courseId: z.string().min(1),
  instructorId: z.string().min(1),
  roleTypeId: z.string().min(1),
  isOverride: z.boolean().default(false),
  overrideNote: z.string().optional(),
});

export const availabilitySchema = z.object({
  instructorId: z.string().min(1),
  date: dateStr.nullable().optional(),
  weekday: z.number().int().min(0).max(6).nullable().optional(),
  slot: z.enum(SLOT_CODES),
  status: z.enum(AVAILABILITY_STATUSES).default("available"),
});
