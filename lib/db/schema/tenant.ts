import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { organisation } from "./control-plane";
import { boolCol, createdAt, id, organisationId, updatedAt } from "./_shared";

/**
 * TENANT-OWNED tables.
 *
 * Every table here carries `organisation_id` (NOT NULL, indexed) and a foreign
 * key to `organisation`. NOTHING in app/route code may query these tables
 * directly — access goes exclusively through lib/db/repositories, which injects
 * the org filter on every read and write. The CI isolation test proves this.
 *
 * Config is DEACTIVATE-NEVER-DELETE: config rows carry an `active` flag and the
 * schema refuses to delete rows still referenced (RESTRICT foreign keys). Old
 * records keep pointing at now-retired config and still render.
 */

const orgFk = () =>
  organisationId().references(() => organisation.id, { onDelete: "cascade" });

// --- Enums / vocabularies --------------------------------------------------

export const SCHEDULING_MODES = ["session", "hours", "day"] as const;
export type SchedulingMode = (typeof SCHEDULING_MODES)[number];

/** The shared slot vocabulary: availability, calendar and sessions all use it. */
export const SLOT_CODES = ["AM", "PM", "EV"] as const;
export type SlotCode = (typeof SLOT_CODES)[number];

export const EMPLOYMENT_TYPES = ["employed", "freelance", "volunteer"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const INSTRUCTOR_STATUSES = ["active", "inactive"] as const;
export const EQUIPMENT_STATUSES = ["available", "maintenance", "retired"] as const;
export const COURSE_STATUSES = ["draft", "scheduled", "confirmed", "completed", "cancelled"] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export const COURSE_STAFF_STATUSES = ["assigned", "confirmed", "declined"] as const;
export const AVAILABILITY_STATUSES = ["available", "unavailable", "tentative"] as const;
export const PAY_UNITS = ["hour", "day", "session"] as const;
export const NOTIFICATION_CHANNELS = ["email", "sms", "in_app"] as const;

// --- Settings / configuration ---------------------------------------------

/** One row per org. The org's global switches. */
export const orgSettings = sqliteTable("org_settings", {
  id: id(),
  organisationId: orgFk(),
  schedulingMode: text("scheduling_mode", { enum: SCHEDULING_MODES }).notNull().default("session"),
  alertLeadDays: integer("alert_lead_days").notNull().default(30),
  currency: text("currency").notNull().default("GBP"),
  timezone: text("timezone").notNull().default("Europe/London"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex("org_settings_org_uq").on(t.organisationId)]);

export const sessionSlot = sqliteTable("session_slot", {
  id: id(),
  organisationId: orgFk(),
  code: text("code", { enum: SLOT_CODES }).notNull(),
  label: text("label").notNull(),
  startTime: text("start_time").notNull(), // "HH:MM"
  endTime: text("end_time").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolCol("active").default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("session_slot_org_idx").on(t.organisationId),
  uniqueIndex("session_slot_org_code_uq").on(t.organisationId, t.code),
]);

export const roleType = sqliteTable("role_type", {
  id: id(),
  organisationId: orgFk(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  countsTowardRatio: boolCol("counts_toward_ratio").default(true),
  isSafetyCover: boolCol("is_safety_cover").default(false),
  isFirstAider: boolCol("is_first_aider").default(false),
  active: boolCol("active").default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("role_type_org_idx").on(t.organisationId),
  uniqueIndex("role_type_org_code_uq").on(t.organisationId, t.code),
]);

/** Qualification types == grades (RYA grades, ranked). */
export const qualificationType = sqliteTable("qualification_type", {
  id: id(),
  organisationId: orgFk(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  rank: integer("rank").notNull().default(0),
  discipline: text("discipline"),
  expiryTracked: boolCol("expiry_tracked").default(false),
  defaultValidMonths: integer("default_valid_months"),
  active: boolCol("active").default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("qualification_type_org_idx").on(t.organisationId),
  uniqueIndex("qualification_type_org_code_uq").on(t.organisationId, t.code),
]);

export const complianceType = sqliteTable("compliance_type", {
  id: id(),
  organisationId: orgFk(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  mandatory: boolCol("mandatory").default(false),
  expiryTracked: boolCol("expiry_tracked").default(true),
  active: boolCol("active").default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("compliance_type_org_idx").on(t.organisationId),
  uniqueIndex("compliance_type_org_code_uq").on(t.organisationId, t.code),
]);

export const equipmentType = sqliteTable("equipment_type", {
  id: id(),
  organisationId: orgFk(),
  name: text("name").notNull(),
  inventoryTracked: boolCol("inventory_tracked").default(true),
  active: boolCol("active").default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("equipment_type_org_idx").on(t.organisationId)]);

export const locationType = sqliteTable("location_type", {
  id: id(),
  organisationId: orgFk(),
  name: text("name").notNull(),
  active: boolCol("active").default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("location_type_org_idx").on(t.organisationId)]);

export const courseType = sqliteTable("course_type", {
  id: id(),
  organisationId: orgFk(),
  name: text("name").notNull(),
  scheme: text("scheme"),
  defaultCapacity: integer("default_capacity").notNull().default(1),
  studentsPerInstructor: integer("students_per_instructor").notNull().default(1),
  requiresSafetyBoat: boolCol("requires_safety_boat").default(false),
  active: boolCol("active").default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("course_type_org_idx").on(t.organisationId)]);

/** Minimum staffing requirement for a course type: N of a given grade. */
export const courseTypeStaffing = sqliteTable("course_type_staffing", {
  id: id(),
  organisationId: orgFk(),
  courseTypeId: text("course_type_id")
    .notNull()
    .references(() => courseType.id, { onDelete: "cascade" }),
  qualificationTypeId: text("qualification_type_id")
    .notNull()
    .references(() => qualificationType.id, { onDelete: "restrict" }),
  minCount: integer("min_count").notNull().default(1),
  createdAt: createdAt(),
}, (t) => [
  index("course_type_staffing_org_idx").on(t.organisationId),
  index("course_type_staffing_ct_idx").on(t.courseTypeId),
]);

export const courseTypeEquipment = sqliteTable("course_type_equipment", {
  id: id(),
  organisationId: orgFk(),
  courseTypeId: text("course_type_id")
    .notNull()
    .references(() => courseType.id, { onDelete: "cascade" }),
  equipmentTypeId: text("equipment_type_id")
    .notNull()
    .references(() => equipmentType.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull().default(1),
  createdAt: createdAt(),
}, (t) => [
  index("course_type_equipment_org_idx").on(t.organisationId),
  index("course_type_equipment_ct_idx").on(t.courseTypeId),
]);

// --- People ----------------------------------------------------------------

export const instructor = sqliteTable("instructor", {
  id: id(),
  organisationId: orgFk(),
  // Optionally linked to an auth user (for the instructor portal).
  userId: text("user_id"),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  employmentType: text("employment_type", { enum: EMPLOYMENT_TYPES }).notNull().default("employed"),
  status: text("status", { enum: INSTRUCTOR_STATUSES }).notNull().default("active"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("instructor_org_idx").on(t.organisationId),
  index("instructor_user_idx").on(t.userId),
]);

export const qualification = sqliteTable("qualification", {
  id: id(),
  organisationId: orgFk(),
  instructorId: text("instructor_id")
    .notNull()
    .references(() => instructor.id, { onDelete: "cascade" }),
  qualificationTypeId: text("qualification_type_id")
    .notNull()
    .references(() => qualificationType.id, { onDelete: "restrict" }),
  certNo: text("cert_no"),
  issueDate: text("issue_date"), // "YYYY-MM-DD"
  expiryDate: text("expiry_date"),
  docKey: text("doc_key"), // R2 object key: org_{id}/...
  verified: boolCol("verified").default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("qualification_org_idx").on(t.organisationId),
  index("qualification_instructor_idx").on(t.instructorId),
]);

export const complianceItem = sqliteTable("compliance_item", {
  id: id(),
  organisationId: orgFk(),
  instructorId: text("instructor_id")
    .notNull()
    .references(() => instructor.id, { onDelete: "cascade" }),
  complianceTypeId: text("compliance_type_id")
    .notNull()
    .references(() => complianceType.id, { onDelete: "restrict" }),
  reference: text("reference"),
  issueDate: text("issue_date"),
  expiryDate: text("expiry_date"),
  docKey: text("doc_key"),
  verified: boolCol("verified").default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("compliance_item_org_idx").on(t.organisationId),
  index("compliance_item_instructor_idx").on(t.instructorId),
]);

// --- Resources -------------------------------------------------------------

export const equipment = sqliteTable("equipment", {
  id: id(),
  organisationId: orgFk(),
  equipmentTypeId: text("equipment_type_id")
    .notNull()
    .references(() => equipmentType.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  identifier: text("identifier"),
  status: text("status", { enum: EQUIPMENT_STATUSES }).notNull().default("available"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("equipment_org_idx").on(t.organisationId),
  index("equipment_type_idx").on(t.equipmentTypeId),
]);

export const location = sqliteTable("location", {
  id: id(),
  organisationId: orgFk(),
  locationTypeId: text("location_type_id")
    .references(() => locationType.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  active: boolCol("active").default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("location_org_idx").on(t.organisationId)]);

// --- Scheduling ------------------------------------------------------------

export const course = sqliteTable("course", {
  id: id(),
  organisationId: orgFk(),
  courseTypeId: text("course_type_id")
    .notNull()
    .references(() => courseType.id, { onDelete: "restrict" }),
  name: text("name"),
  capacity: integer("capacity").notNull().default(1),
  ratio: integer("ratio").notNull().default(1), // students per instructor
  status: text("status", { enum: COURSE_STATUSES }).notNull().default("draft"),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("course_org_idx").on(t.organisationId),
  index("course_type_ref_idx").on(t.courseTypeId),
]);

/**
 * A course is a set of sessions. `startAt`/`endAt` are absolute epoch-ms
 * instants (used for conflict detection); `date` + `slot` drive the calendar.
 */
export const courseSession = sqliteTable("course_session", {
  id: id(),
  organisationId: orgFk(),
  courseId: text("course_id")
    .notNull()
    .references(() => course.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // "YYYY-MM-DD"
  slot: text("slot", { enum: SLOT_CODES }).notNull(),
  startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
  endAt: integer("end_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("course_session_org_idx").on(t.organisationId),
  index("course_session_course_idx").on(t.courseId),
  index("course_session_date_idx").on(t.organisationId, t.date),
]);

export const courseStaff = sqliteTable("course_staff", {
  id: id(),
  organisationId: orgFk(),
  courseId: text("course_id")
    .notNull()
    .references(() => course.id, { onDelete: "cascade" }),
  instructorId: text("instructor_id")
    .notNull()
    .references(() => instructor.id, { onDelete: "restrict" }),
  roleTypeId: text("role_type_id")
    .notNull()
    .references(() => roleType.id, { onDelete: "restrict" }),
  status: text("status", { enum: COURSE_STAFF_STATUSES }).notNull().default("assigned"),
  isOverride: boolCol("is_override").default(false),
  overrideNote: text("override_note"),
  overriddenBy: text("overridden_by"), // user id
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("course_staff_org_idx").on(t.organisationId),
  index("course_staff_course_idx").on(t.courseId),
  index("course_staff_instructor_idx").on(t.instructorId),
]);

export const courseEquipment = sqliteTable("course_equipment", {
  id: id(),
  organisationId: orgFk(),
  courseId: text("course_id")
    .notNull()
    .references(() => course.id, { onDelete: "cascade" }),
  // Either a specific tracked unit, or a type + qty for bulk.
  equipmentId: text("equipment_id").references(() => equipment.id, { onDelete: "restrict" }),
  equipmentTypeId: text("equipment_type_id").references(() => equipmentType.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull().default(1),
  isOverride: boolCol("is_override").default(false),
  note: text("note"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("course_equipment_org_idx").on(t.organisationId),
  index("course_equipment_course_idx").on(t.courseId),
]);

export const courseLocation = sqliteTable("course_location", {
  id: id(),
  organisationId: orgFk(),
  courseId: text("course_id")
    .notNull()
    .references(() => course.id, { onDelete: "cascade" }),
  locationId: text("location_id")
    .notNull()
    .references(() => location.id, { onDelete: "restrict" }),
  createdAt: createdAt(),
}, (t) => [
  index("course_location_org_idx").on(t.organisationId),
  index("course_location_course_idx").on(t.courseId),
]);

// --- Ops -------------------------------------------------------------------

export const availability = sqliteTable("availability", {
  id: id(),
  organisationId: orgFk(),
  instructorId: text("instructor_id")
    .notNull()
    .references(() => instructor.id, { onDelete: "cascade" }),
  date: text("date"), // specific date, OR
  weekday: integer("weekday"), // 0-6 recurring
  slot: text("slot", { enum: SLOT_CODES }).notNull(),
  status: text("status", { enum: AVAILABILITY_STATUSES }).notNull().default("available"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("availability_org_idx").on(t.organisationId),
  index("availability_instructor_idx").on(t.instructorId),
]);

export const payRate = sqliteTable("pay_rate", {
  id: id(),
  organisationId: orgFk(),
  instructorId: text("instructor_id").references(() => instructor.id, { onDelete: "cascade" }),
  roleTypeId: text("role_type_id").references(() => roleType.id, { onDelete: "restrict" }),
  rate: real("rate").notNull(),
  unit: text("unit", { enum: PAY_UNITS }).notNull().default("hour"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("pay_rate_org_idx").on(t.organisationId)]);

export const hoursRecord = sqliteTable("hours_record", {
  id: id(),
  organisationId: orgFk(),
  instructorId: text("instructor_id")
    .notNull()
    .references(() => instructor.id, { onDelete: "cascade" }),
  courseSessionId: text("course_session_id").references(() => courseSession.id, { onDelete: "set null" }),
  scheduledMinutes: integer("scheduled_minutes").notNull().default(0),
  actualMinutes: integer("actual_minutes"),
  rate: real("rate"),
  approved: boolCol("approved").default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("hours_record_org_idx").on(t.organisationId),
  index("hours_record_instructor_idx").on(t.instructorId),
]);

export const notification = sqliteTable("notification", {
  id: id(),
  organisationId: orgFk(),
  userId: text("user_id"),
  instructorId: text("instructor_id"),
  channel: text("channel", { enum: NOTIFICATION_CHANNELS }).notNull().default("in_app"),
  title: text("title").notNull(),
  body: text("body"),
  readAt: integer("read_at", { mode: "timestamp_ms" }),
  sentAt: integer("sent_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
}, (t) => [index("notification_org_idx").on(t.organisationId)]);

/** Append-only audit trail for roster/resource/settings/billing changes. */
export const auditLog = sqliteTable("audit_log", {
  id: id(),
  organisationId: orgFk(),
  actorUserId: text("actor_user_id"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  before: text("before"), // JSON
  after: text("after"), // JSON
  createdAt: createdAt(),
}, (t) => [
  index("audit_log_org_idx").on(t.organisationId),
  index("audit_log_entity_idx").on(t.organisationId, t.entity, t.entityId),
]);

// Handy inferred types used across the app.
export type Instructor = typeof instructor.$inferSelect;
export type Course = typeof course.$inferSelect;
export type CourseSession = typeof courseSession.$inferSelect;
export type OrgSettings = typeof orgSettings.$inferSelect;
