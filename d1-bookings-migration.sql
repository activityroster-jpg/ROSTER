-- ActivityRoster — bookings & course pricing migration.
-- Run ONCE against production D1 (dashboard → D1 → activityroster → Console),
-- AFTER the Phase 2 migration. Adds the booking table and two price columns.

CREATE TABLE `booking` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`course_id` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_email` text,
	`headcount` integer DEFAULT 1 NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'provisional' NOT NULL,
	`paid_at` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `course`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `booking_org_idx` ON `booking` (`organisation_id`);
CREATE INDEX `booking_course_idx` ON `booking` (`course_id`);

ALTER TABLE `course` ADD `price` real;
ALTER TABLE `course_type` ADD `default_price` real;
