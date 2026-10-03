CREATE TABLE `roster_week` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`week_start` text NOT NULL,
	`published_at` integer,
	`published_by_user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `roster_week_org_idx` ON `roster_week` (`organisation_id`);
CREATE UNIQUE INDEX `roster_week_org_week_uq` ON `roster_week` (`organisation_id`,`week_start`);
ALTER TABLE `organisation` ADD `trial_ends_at` integer;
ALTER TABLE `course_staff` ADD `confirmed_at` integer;
ALTER TABLE `course_staff` ADD `declined_at` integer;
ALTER TABLE `course_staff` ADD `decline_note` text;
ALTER TABLE `hours_record` ADD `pay_unit` text DEFAULT 'hour' NOT NULL;
ALTER TABLE `hours_record` ADD `source` text DEFAULT 'roster' NOT NULL;
ALTER TABLE `hours_record` ADD `override_minutes` integer;
ALTER TABLE `hours_record` ADD `override_pay` real;
ALTER TABLE `hours_record` ADD `note` text;
ALTER TABLE `org_settings` ADD `enforce_availability_checks` integer DEFAULT true NOT NULL;
ALTER TABLE `org_settings` ADD `timeclock_enabled` integer DEFAULT false NOT NULL;
ALTER TABLE `org_settings` ADD `pay_source` text DEFAULT 'roster' NOT NULL;
