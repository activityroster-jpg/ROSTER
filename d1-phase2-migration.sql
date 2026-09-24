-- ActivityRoster — Phase 2 D1 migration (time & attendance, leave & cover,
-- onboarding). Run this ONCE against the production D1 database
-- (Cloudflare dashboard → Workers & Pages → D1 → activityroster → Console),
-- or via: wrangler d1 execute activityroster --remote --file d1-phase2-migration.sql
-- Safe to re-run guarded manually — it creates three new tables only.

-- 0002: time & attendance --------------------------------------------------
CREATE TABLE `time_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`course_session_id` text,
	`clock_in_at` integer NOT NULL,
	`clock_out_at` integer,
	`source` text DEFAULT 'clock' NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instructor_id`) REFERENCES `instructor`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_session_id`) REFERENCES `course_session`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE INDEX `time_entry_org_idx` ON `time_entry` (`organisation_id`);
CREATE INDEX `time_entry_instructor_idx` ON `time_entry` (`instructor_id`);
CREATE INDEX `time_entry_session_idx` ON `time_entry` (`course_session_id`);

-- 0003: leave & open-shift cover -------------------------------------------
CREATE TABLE `leave_request` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`type` text DEFAULT 'annual' NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`days` real DEFAULT 1 NOT NULL,
	`reason` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`decided_by_user_id` text,
	`decided_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instructor_id`) REFERENCES `instructor`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `leave_request_org_idx` ON `leave_request` (`organisation_id`);
CREATE INDEX `leave_request_instructor_idx` ON `leave_request` (`instructor_id`);

CREATE TABLE `open_shift` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`course_session_id` text NOT NULL,
	`role_type_id` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`claimed_by_instructor_id` text,
	`filled_by_instructor_id` text,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_session_id`) REFERENCES `course_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_type_id`) REFERENCES `role_type`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`claimed_by_instructor_id`) REFERENCES `instructor`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`filled_by_instructor_id`) REFERENCES `instructor`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE INDEX `open_shift_org_idx` ON `open_shift` (`organisation_id`);
CREATE INDEX `open_shift_session_idx` ON `open_shift` (`course_session_id`);

-- 0004: onboarding ---------------------------------------------------------
CREATE TABLE `onboarding_item` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`label` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instructor_id`) REFERENCES `instructor`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `onboarding_item_org_idx` ON `onboarding_item` (`organisation_id`);
CREATE INDEX `onboarding_item_instructor_idx` ON `onboarding_item` (`instructor_id`);
