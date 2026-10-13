CREATE TABLE `roster_day` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`date` text NOT NULL,
	`confirmed_at` integer,
	`confirmed_by_user_id` text,
	`snapshot` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `roster_day_org_idx` ON `roster_day` (`organisation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `roster_day_org_date_uq` ON `roster_day` (`organisation_id`,`date`);--> statement-breakpoint
ALTER TABLE `org_settings` ADD `staff_accept_shifts` integer DEFAULT false NOT NULL;