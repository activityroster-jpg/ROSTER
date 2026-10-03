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

/** How the centre chose to start: "basic" = ready-to-use RYA defaults;
 * "full" = they'll complete a fuller configuration before going live. */
export const SETUP_MODES = ["basic", "full"] as const;
export type SetupMode = (typeof SETUP_MODES)[number];

/**
 * How the centre runs sessions: fixed AM/PM/EV slots (the RYA-centre default),
 * or explicit start/end times per session (centres that run to a timetable).
 */
export const SLOT_STYLES = ["slots", "times"] as const;
export type SlotStyle = (typeof SLOT_STYLES)[number];

/**
 * Who a course is aimed at. Centres draw a hard line between youth and adult
 * provision (safeguarding, ratios, marketing), so it is a first-class attribute
 * carried through scheduling and reporting.
 */
export const COURSE_AUDIENCES = ["youth", "adult", "all"] as const;
export type CourseAudience = (typeof COURSE_AUDIENCES)[number];

/**
 * Optional capability areas a centre can switch on during onboarding. Courses
 * and team are always on (the rostering core); these add complexity only when a
 * centre wants it. Stored as a JSON string array on org_settings.enabledFeatures.
 */
export const OPTIONAL_FEATURES = ["equipment", "locations", "operatingAreas", "payroll", "documents"] as const;
export type OptionalFeature = (typeof OPTIONAL_FEATURES)[number];

/** The shared slot vocabulary: availability, calendar and sessions all use it. */
export const SLOT_CODES = ["AM", "PM", "EV"] as const;
export type SlotCode = (typeof SLOT_CODES)[number];

export const WORKING_TIME_MODES = ["warn", "block_override", "block"] as const;
export type WorkingTimeMode = (typeof WORKING_TIME_MODES)[number];

export const EMPLOYMENT_TYPES = ["employed", "freelance", "volunteer"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

// pending = requested to join via the app; invisible to rostering until approved.
export const INSTRUCTOR_STATUSES = ["active", "inactive", "pending"] as const;
export const EQUIPMENT_STATUSES = ["available", "maintenance", "retired"] as const;
export const COURSE_STATUSES = ["draft", "scheduled", "confirmed", "completed", "cancelled"] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export const COURSE_STAFF_STATUSES = ["assigned", "confirmed", "declined"] as const;
export const AVAILABILITY_STATUSES = ["available", "unavailable", "tentative"] as const;
export const PAY_UNITS = ["hour", "day", "session"] as const;
export type PayUnit = (typeof PAY_UNITS)[number];
export const NOTIFICATION_CHANNELS = ["email", "sms", "in_app"] as const;
export const TIME_ENTRY_SOURCES = ["clock", "manual"] as const;
export type TimeEntrySource = (typeof TIME_ENTRY_SOURCES)[number];
/** Where a payroll line's hours come from: the roster (scheduled), the clock (actual) or typed in. */
export const HOURS_SOURCES = ["roster", "clock", "manual"] as const;
export type HoursSource = (typeof HOURS_SOURCES)[number];
/** A centre's default for payroll: pay what was rostered, or what was clocked. */
export const PAY_SOURCES = ["roster", "clock"] as const;
export type PaySource = (typeof PAY_SOURCES)[number];
export const LEAVE_TYPES = ["annual", "sick", "training", "unpaid", "other"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];
export const LEAVE_STATUSES = ["pending", "approved", "declined", "cancelled"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];
export const OPEN_SHIFT_STATUSES = ["open", "offered", "filled", "cancelled"] as const;
export type OpenShiftStatus = (typeof OPEN_SHIFT_STATUSES)[number];
/** Booking statuses that count as earned revenue. */

// --- Settings / configuration ---------------------------------------------

/** One row per org. The org's global switches. */
export const orgSettings = sqliteTable("org_settings", {
  id: id(),
  organisationId: orgFk(),
  schedulingMode: text("scheduling_mode", { enum: SCHEDULING_MODES }).notNull().default("session"),
  setupMode: text("setup_mode", { enum: SETUP_MODES }).notNull().default("basic"),
  slotStyle: text("slot_style", { enum: SLOT_STYLES }).notNull().default("slots"),
  /** JSON string array of enabled OPTIONAL_FEATURES, e.g. ["equipment","payroll"]. */
  enabledFeatures: text("enabled_features").notNull().default("[]"),
  alertLeadDays: integer("alert_lead_days").notNull().default(30),
  /** How many weeks ahead (incl. this week) instructors may set availability. */
  availabilityWeeksAhead: integer("availability_weeks_ahead").notNull().default(4),
  // --- Optional compliance checks (opt-in; OFF by default to keep it simple) ---
  // When on, rostering blocks an instructor with a missing/expired mandatory
  // licence/vetting check (override allowed). Licence expiry is always shown on
  // the Staff tab regardless of this flag.
  enforceLicenceChecks: boolCol("enforce_licence_checks").default(false),
  // When on, courses show ratio & safety-cover flags (Covered / Under-staffed /
  // No safety cover).
  enforceRatioChecks: boolCol("enforce_ratio_checks").default(false),
  // When on, rostering blocks double-booking an instructor across overlapping
  // sessions (override allowed).
  enforceConflictChecks: boolCol("enforce_conflict_checks").default(false),
  // When on (the default), rostering blocks an instructor who marked that slot
  // "Busy" in their availability (override allowed).
  enforceAvailabilityChecks: boolCol("enforce_availability_checks").default(true),
  // --- Time clock & pay source -----------------------------------------------
  // The clock is optional: off, instructors don't see the Clock tab and payroll
  // runs purely on the roster. paySource is the default for new payroll lines.
  timeclockEnabled: boolCol("timeclock_enabled").default(false),
  paySource: text("pay_source", { enum: PAY_SOURCES }).notNull().default("roster"),
  currency: text("currency").notNull().default("GBP"),
  timezone: text("timezone").notNull().default("Europe/London"),
  // --- Lunch / rest breaks: anyone working longer than breakAfterMinutes gets
  // a break of breakMinutes, deducted from pay unless breakPaid. 0 = off.
  breakAfterMinutes: integer("break_after_minutes").notNull().default(360),
  breakMinutes: integer("break_minutes").notNull().default(0),
  breakPaid: boolCol("break_paid").default(false),
  /** The centre's own privacy notice for its staff; linked beside ActivityRoster's notice in the office and portal. */
  privacyNoticeUrl: text("privacy_notice_url"),
  /** Opt-in morning email of the day's rota to every admin (offline fallback). Hour is London time, 0–23. */
  dailyDigestEnabled: boolCol("daily_digest_enabled").default(false),
  dailyDigestHour: integer("daily_digest_hour").notNull().default(6),
  // --- Young workers' hours (compliance block F) ----------------------------
  // What happens when rostering an under-18 would break their jurisdiction's
  // working-time rules: warn only, block unless an admin overrides with a note
  // (the default), or block outright. The figures themselves are rule-pack data.
  workingTimeMode: text("working_time_mode", { enum: WORKING_TIME_MODES }).notNull().default("block_override"),
  /** JSON array of {from,to,label?} ISO date ranges that count as school term time. Empty = treat every week as term time (the stricter caps). */
  termDates: text("term_dates").notNull().default("[]"),
  /** JSON RotaTemplateSettings (lib/rota/template): range, orientation and fields for the rota PDF. */
  rotaTemplate: text("rota_template").notNull().default("{}"),
  /** Minutes of inactivity before an admin is asked for their PIN again (5–240). Applied from the next PIN entry. */
  idleTimeoutMinutes: integer("idle_timeout_minutes").notNull().default(30),
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
  /** How many of this type the centre has (e.g. 12 Pico dinghies). Nullable. */
  quantity: integer("quantity"),
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
  /** youth / adult / all — centres separate youth and adult provision. */
  audience: text("audience", { enum: COURSE_AUDIENCES }).notNull().default("all"),
  /** Free-text grouping the centre uses, e.g. "Summer camp", "Junior club",
   * "School groups", "Adult evening". Lets a centre organise the same RYA scheme
   * into how they actually sell it. Nullable. */
  category: text("category"),
  defaultCapacity: integer("default_capacity").notNull().default(1),
  studentsPerInstructor: integer("students_per_instructor").notNull().default(1),
  requiresSafetyBoat: boolCol("requires_safety_boat").default(false),
  defaultPrice: real("default_price"), // per-head list price, nullable = not priced
  active: boolCol("active").default(true),
  /** On the centre's regular course list (dropdowns, Course setup). One-off
   * types entered manually or imported without a match are unlisted. */
  listed: boolCol("listed").default(true),
  /** Default schedule as JSON: [{ day: 1, start: "09:00", end: "17:00" }, …] —
   * how many sessions the course has and when each runs. Nullable = none. */
  defaultSchedule: text("default_schedule"),
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
  /** Whether to also email this instructor when they're notified (in-app is always on). */
  notifyEmail: boolCol("notify_email").default(true),
  /** YYYY-MM-DD. Drives the under-18 flag (computed on read, lifts at 18) and the working-time rules. */
  dateOfBirth: text("date_of_birth"),
  /** Parent or guardian for under-18s. Phone and email are sealed (AES-GCM) at rest. */
  guardianName: text("guardian_name"),
  guardianPhone: text("guardian_phone"),
  guardianEmail: text("guardian_email"),
  /** Emergency contact for every staff member. Name and phone are sealed at rest; admin-only, every view audited. */
  emergencyName: text("emergency_name"),
  emergencyPhone: text("emergency_phone"),
  emergencyRelationship: text("emergency_relationship"),
  // --- Per-person data rights (compliance P1-A) ------------------------------
  /** Restriction of processing (GDPR art. 18): kept but not rostered or contacted while set. */
  restrictedAt: integer("restricted_at", { mode: "timestamp_ms" }),
  restrictedReason: text("restricted_reason"),
  /** Set when the person was anonymised; identifying fields are blank from then on and the record is kept only for roster and payroll history. */
  anonymisedAt: integer("anonymised_at", { mode: "timestamp_ms" }),
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

/**
 * Course types an instructor is approved to teach — the centre's explicit
 * "can teach" list, set when the instructor is added. Complements the derived
 * teaching matrix (held qualifications) with a definitive per-centre override.
 */
export const instructorCourseType = sqliteTable("instructor_course_type", {
  id: id(),
  organisationId: orgFk(),
  instructorId: text("instructor_id")
    .notNull()
    .references(() => instructor.id, { onDelete: "cascade" }),
  courseTypeId: text("course_type_id")
    .notNull()
    .references(() => courseType.id, { onDelete: "restrict" }),
  createdAt: createdAt(),
}, (t) => [
  index("instructor_course_type_org_idx").on(t.organisationId),
  index("instructor_course_type_instructor_idx").on(t.instructorId),
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
  /** How many staff this course needs (set directly on the course card). Null
   *  falls back to the ratio/course-type calculation. */
  staffRequired: integer("staff_required"),
  price: real("price"), // per-head price override; falls back to course_type.default_price
  status: text("status", { enum: COURSE_STATUSES }).notNull().default("draft"),
  notes: text("notes"),
  /** Where this course came from, e.g. "integration:bookwhen". Null = created in-app. */
  source: text("source"),
  /** Stable key from the source feed (name|date|slot) for change detection. */
  externalRef: text("external_ref"),
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
  // The instructor's own answer once the roster is published.
  confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
  declinedAt: integer("declined_at", { mode: "timestamp_ms" }),
  declineNote: text("decline_note"),
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

/**
 * The staff a course needs, by role — e.g. 2× Instructor + 1× Safety Boat
 * Driver. Set when the course is built; assignments are measured against it.
 */
export const courseRoleRequirement = sqliteTable("course_role_requirement", {
  id: id(),
  organisationId: orgFk(),
  courseId: text("course_id")
    .notNull()
    .references(() => course.id, { onDelete: "cascade" }),
  roleTypeId: text("role_type_id")
    .notNull()
    .references(() => roleType.id, { onDelete: "restrict" }),
  count: integer("count").notNull().default(1),
  createdAt: createdAt(),
}, (t) => [
  index("course_role_req_org_idx").on(t.organisationId),
  index("course_role_req_course_idx").on(t.courseId),
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

export type PayRate = typeof payRate.$inferSelect;

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
  // How the rate applies: per hour, per session or per day (from the pay rate).
  payUnit: text("pay_unit", { enum: PAY_UNITS }).notNull().default("hour"),
  // Which minutes this line pays on: roster (scheduled), clock (actual) or manual.
  source: text("source", { enum: HOURS_SOURCES }).notNull().default("roster"),
  // Office corrections during payroll review — win over everything else.
  overrideMinutes: integer("override_minutes"),
  overridePay: real("override_pay"),
  note: text("note"),
  approved: boolCol("approved").default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("hours_record_org_idx").on(t.organisationId),
  index("hours_record_instructor_idx").on(t.instructorId),
]);

export type HoursRecord = typeof hoursRecord.$inferSelect;

/**
 * A published roster week. Until a week is published, instructors see nothing
 * for it and aren't asked to confirm; publishing notifies everyone rostered.
 */
export const rosterWeek = sqliteTable("roster_week", {
  id: id(),
  organisationId: orgFk(),
  /** Monday, YYYY-MM-DD. */
  weekStart: text("week_start").notNull(),
  publishedAt: integer("published_at", { mode: "timestamp_ms" }),
  publishedByUserId: text("published_by_user_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("roster_week_org_idx").on(t.organisationId),
  uniqueIndex("roster_week_org_week_uq").on(t.organisationId, t.weekStart),
]);
export type RosterWeek = typeof rosterWeek.$inferSelect;

/**
 * Time & attendance: a clock-in/clock-out event, optionally tied to the session
 * the instructor is working. An open entry (clockOutAt null) means "on the water
 * now". On clock-out the elapsed minutes flow into the matching hours_record so
 * payroll runs on actual, not scheduled, time.
 */
export const timeEntry = sqliteTable("time_entry", {
  id: id(),
  organisationId: orgFk(),
  instructorId: text("instructor_id")
    .notNull()
    .references(() => instructor.id, { onDelete: "cascade" }),
  courseSessionId: text("course_session_id").references(() => courseSession.id, { onDelete: "set null" }),
  clockInAt: integer("clock_in_at", { mode: "timestamp_ms" }).notNull(),
  clockOutAt: integer("clock_out_at", { mode: "timestamp_ms" }),
  source: text("source", { enum: TIME_ENTRY_SOURCES }).notNull().default("clock"),
  note: text("note"),
  // Approximate location at clock-in / clock-out (from the app, with permission).
  inLat: real("in_lat"),
  inLng: real("in_lng"),
  inAccuracyM: integer("in_accuracy_m"),
  outLat: real("out_lat"),
  outLng: real("out_lng"),
  outAccuracyM: integer("out_accuracy_m"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("time_entry_org_idx").on(t.organisationId),
  index("time_entry_instructor_idx").on(t.instructorId),
  index("time_entry_session_idx").on(t.courseSessionId),
]);

/** A leave / absence request from an instructor, approved by an admin. */
export const leaveRequest = sqliteTable("leave_request", {
  id: id(),
  organisationId: orgFk(),
  instructorId: text("instructor_id")
    .notNull()
    .references(() => instructor.id, { onDelete: "cascade" }),
  type: text("type", { enum: LEAVE_TYPES }).notNull().default("annual"),
  startDate: text("start_date").notNull(), // "YYYY-MM-DD"
  endDate: text("end_date").notNull(),
  days: real("days").notNull().default(1),
  reason: text("reason"),
  status: text("status", { enum: LEAVE_STATUSES }).notNull().default("pending"),
  decidedByUserId: text("decided_by_user_id"),
  decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("leave_request_org_idx").on(t.organisationId),
  index("leave_request_instructor_idx").on(t.instructorId),
]);

/**
 * An uncovered session role broadcast for staff to claim. open → offered (an
 * instructor has put their hand up) → filled (an admin confirms, which also
 * assigns them to the course). Config-safe: cancelling sets status, never deletes.
 */
export const openShift = sqliteTable("open_shift", {
  id: id(),
  organisationId: orgFk(),
  courseSessionId: text("course_session_id")
    .notNull()
    .references(() => courseSession.id, { onDelete: "cascade" }),
  roleTypeId: text("role_type_id")
    .notNull()
    .references(() => roleType.id, { onDelete: "restrict" }),
  status: text("status", { enum: OPEN_SHIFT_STATUSES }).notNull().default("open"),
  claimedByInstructorId: text("claimed_by_instructor_id").references(() => instructor.id, { onDelete: "set null" }),
  filledByInstructorId: text("filled_by_instructor_id").references(() => instructor.id, { onDelete: "set null" }),
  note: text("note"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("open_shift_org_idx").on(t.organisationId),
  index("open_shift_session_idx").on(t.courseSessionId),
]);

/** A single onboarding checklist step for a new staff member. */
export const onboardingItem = sqliteTable("onboarding_item", {
  id: id(),
  organisationId: orgFk(),
  instructorId: text("instructor_id")
    .notNull()
    .references(() => instructor.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  done: boolCol("done").default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("onboarding_item_org_idx").on(t.organisationId),
  index("onboarding_item_instructor_idx").on(t.instructorId),
]);

/**
 * What was anonymised or deleted and when, so a database restore can be
 * followed by a replay that removes the same people again. Holds no personal
 * data: a one-way hash of the identity and a summary of what went.
 */
export const DELETION_SUBJECTS = ["instructor"] as const;
export const deletionLog = sqliteTable("deletion_log", {
  id: id(),
  organisationId: orgFk(),
  subjectKind: text("subject_kind", { enum: DELETION_SUBJECTS }).notNull().default("instructor"),
  subjectId: text("subject_id").notNull(),
  subjectHash: text("subject_hash").notNull(),
  summary: text("summary").notNull(), // JSON: counts of what was removed
  actorUserId: text("actor_user_id"),
  createdAt: createdAt(),
}, (t) => [index("deletion_log_org_idx").on(t.organisationId)]);
export type DeletionLog = typeof deletionLog.$inferSelect;

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

// --- Booking-system integrations -------------------------------------------

export const INTEGRATION_KINDS = ["ics", "csv", "api"] as const;
export type IntegrationKind = (typeof INTEGRATION_KINDS)[number];
export const INTEGRATION_STATUSES = ["connected", "error", "paused"] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

/**
 * A connection to an external booking/management system that feeds courses in.
 * The universal path is a calendar (ICS) feed URL the provider exposes; named
 * API adapters can be added later against the same row (kind = "api"). One-way,
 * read-only into ActivityRoster: we never write back to the booking system.
 */
export const integration = sqliteTable("integration", {
  id: id(),
  organisationId: orgFk(),
  provider: text("provider").notNull(), // catalogue id, e.g. "bookwhen", "ics_generic"
  kind: text("kind", { enum: INTEGRATION_KINDS }).notNull().default("ics"),
  feedUrl: text("feed_url"),
  /** API key / token for kind = "api" adapters. Stored server-side only. */
  token: text("token"),
  status: text("status", { enum: INTEGRATION_STATUSES }).notNull().default("connected"),
  autoSync: boolCol("auto_sync").default(true),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp_ms" }),
  lastResult: text("last_result"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("integration_org_idx").on(t.organisationId)]);

// Handy inferred types used across the app.
export type Integration = typeof integration.$inferSelect;
export type NewIntegration = typeof integration.$inferInsert;
export type Instructor = typeof instructor.$inferSelect;
export type CourseType = typeof courseType.$inferSelect;
export type InstructorCourseType = typeof instructorCourseType.$inferSelect;
export type Course = typeof course.$inferSelect;
export type CourseSession = typeof courseSession.$inferSelect;
export type CourseStaff = typeof courseStaff.$inferSelect;
export type OrgSettings = typeof orgSettings.$inferSelect;
export type TimeEntry = typeof timeEntry.$inferSelect;
export type LeaveRequest = typeof leaveRequest.$inferSelect;
export type OpenShift = typeof openShift.$inferSelect;
export type OnboardingItem = typeof onboardingItem.$inferSelect;
export type Notification = typeof notification.$inferSelect;
