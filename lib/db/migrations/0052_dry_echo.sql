ALTER TABLE `instructor` ADD `left_at` integer;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `retention` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `retention_reminder_at` integer;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `retention_ran_at` integer;