CREATE TABLE `session_staff_override` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`course_session_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`role_type_id` text NOT NULL,
	`mode` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_session_id`) REFERENCES `course_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instructor_id`) REFERENCES `instructor`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`role_type_id`) REFERENCES `role_type`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `session_staff_override_org_idx` ON `session_staff_override` (`organisation_id`);--> statement-breakpoint
CREATE INDEX `session_staff_override_session_idx` ON `session_staff_override` (`course_session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_staff_override_session_instructor_uq` ON `session_staff_override` (`course_session_id`,`instructor_id`);