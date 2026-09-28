ALTER TABLE `course_type` ADD `audience` text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE `course_type` ADD `category` text;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `slot_style` text DEFAULT 'slots' NOT NULL;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `enabled_features` text DEFAULT '[]' NOT NULL;