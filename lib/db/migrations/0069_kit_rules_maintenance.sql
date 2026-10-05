ALTER TABLE `course_type_equipment` ADD `per_students` integer;--> statement-breakpoint
ALTER TABLE `equipment` ADD `maintenance_note` text;--> statement-breakpoint
ALTER TABLE `equipment` ADD `back_on` text;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `use_kit_rules` integer DEFAULT false NOT NULL;