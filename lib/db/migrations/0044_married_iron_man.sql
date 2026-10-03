CREATE TABLE `rule_pack` (
	`key` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`version` text NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`json` text NOT NULL,
	`updated_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `org_settings` ADD `working_time_mode` text DEFAULT 'block_override' NOT NULL;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `term_dates` text DEFAULT '[]' NOT NULL;