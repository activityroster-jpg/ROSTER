CREATE TABLE `availability_note` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`date` text NOT NULL,
	`note` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instructor_id`) REFERENCES `instructor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `availability_note_org_idx` ON `availability_note` (`organisation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `availability_note_instructor_date_uq` ON `availability_note` (`instructor_id`,`date`);--> statement-breakpoint
ALTER TABLE `availability` ADD `set_by` text DEFAULT 'self' NOT NULL;--> statement-breakpoint
DELETE FROM `availability` WHERE `date` IS NOT NULL AND `id` NOT IN (SELECT `id` FROM (SELECT `id`, ROW_NUMBER() OVER (PARTITION BY `instructor_id`, `date`, `slot` ORDER BY `updated_at` DESC, `rowid` DESC) AS rn FROM `availability` WHERE `date` IS NOT NULL) WHERE rn = 1);--> statement-breakpoint
DELETE FROM `availability` WHERE `weekday` IS NOT NULL AND `id` NOT IN (SELECT `id` FROM (SELECT `id`, ROW_NUMBER() OVER (PARTITION BY `instructor_id`, `weekday`, `slot` ORDER BY `updated_at` DESC, `rowid` DESC) AS rn FROM `availability` WHERE `weekday` IS NOT NULL) WHERE rn = 1);--> statement-breakpoint
CREATE UNIQUE INDEX `availability_instructor_date_slot_uq` ON `availability` (`instructor_id`,`date`,`slot`) WHERE "date" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `availability_instructor_weekday_slot_uq` ON `availability` (`instructor_id`,`weekday`,`slot`) WHERE "weekday" IS NOT NULL;