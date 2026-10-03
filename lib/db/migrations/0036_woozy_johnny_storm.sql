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
--> statement-breakpoint
CREATE INDEX `roster_week_org_idx` ON `roster_week` (`organisation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `roster_week_org_week_uq` ON `roster_week` (`organisation_id`,`week_start`);--> statement-breakpoint
ALTER TABLE `organisation` ADD `trial_ends_at` integer;--> statement-breakpoint
ALTER TABLE `course_staff` ADD `confirmed_at` integer;--> statement-breakpoint
ALTER TABLE `course_staff` ADD `declined_at` integer;--> statement-breakpoint
ALTER TABLE `course_staff` ADD `decline_note` text;--> statement-breakpoint
ALTER TABLE `hours_record` ADD `pay_unit` text DEFAULT 'hour' NOT NULL;--> statement-breakpoint
ALTER TABLE `hours_record` ADD `source` text DEFAULT 'roster' NOT NULL;--> statement-breakpoint
ALTER TABLE `hours_record` ADD `override_minutes` integer;--> statement-breakpoint
ALTER TABLE `hours_record` ADD `override_pay` real;--> statement-breakpoint
ALTER TABLE `hours_record` ADD `note` text;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `enforce_availability_checks` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `timeclock_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `pay_source` text DEFAULT 'roster' NOT NULL;