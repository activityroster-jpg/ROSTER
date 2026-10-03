CREATE TABLE `deletion_log` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`subject_kind` text DEFAULT 'instructor' NOT NULL,
	`subject_id` text NOT NULL,
	`subject_hash` text NOT NULL,
	`summary` text NOT NULL,
	`actor_user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `deletion_log_org_idx` ON `deletion_log` (`organisation_id`);--> statement-breakpoint
ALTER TABLE `instructor` ADD `restricted_at` integer;--> statement-breakpoint
ALTER TABLE `instructor` ADD `restricted_reason` text;--> statement-breakpoint
ALTER TABLE `instructor` ADD `anonymised_at` integer;