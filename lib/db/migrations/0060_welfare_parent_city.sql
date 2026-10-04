CREATE TABLE `welfare_duty` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`date` text NOT NULL,
	`slot` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `welfare_duty_org_idx` ON `welfare_duty` (`organisation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `welfare_duty_org_date_slot_uq` ON `welfare_duty` (`organisation_id`,`date`,`slot`);--> statement-breakpoint
ALTER TABLE `trusted_device` ADD `city` text;--> statement-breakpoint
ALTER TABLE `guardian_link` ADD `parent_decision` text;--> statement-breakpoint
ALTER TABLE `guardian_link` ADD `parent_decided_at` integer;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `welfare_officers` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `welfare_duty` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `require_parent_approval` integer DEFAULT true NOT NULL;