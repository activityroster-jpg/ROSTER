ALTER TABLE `course_type` ADD `default_schedule` text;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `break_after_minutes` integer DEFAULT 360 NOT NULL;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `break_minutes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `break_paid` integer DEFAULT false NOT NULL;