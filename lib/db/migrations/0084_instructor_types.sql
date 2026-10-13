CREATE TABLE `qualification_course_type` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`qualification_type_id` text NOT NULL,
	`course_type_id` text NOT NULL,
	`also_requires_type_id` text,
	`needs_approval` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`qualification_type_id`) REFERENCES `qualification_type`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`course_type_id`) REFERENCES `course_type`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`also_requires_type_id`) REFERENCES `qualification_type`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `qualification_course_type_org_idx` ON `qualification_course_type` (`organisation_id`);--> statement-breakpoint
CREATE INDEX `qualification_course_type_course_idx` ON `qualification_course_type` (`course_type_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `qualification_course_type_uq` ON `qualification_course_type` (`organisation_id`,`qualification_type_id`,`course_type_id`);--> statement-breakpoint
ALTER TABLE `org_settings` ADD `teaching_map_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `qualification_type` ADD `needs_supervision` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `qualification_type` ADD `supervises` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `role_type` ADD `qualification_type_id` text REFERENCES qualification_type(id);