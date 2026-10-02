CREATE TABLE `course_role_requirement` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`course_id` text NOT NULL,
	`role_type_id` text NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `course`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_type_id`) REFERENCES `role_type`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `course_role_req_org_idx` ON `course_role_requirement` (`organisation_id`);--> statement-breakpoint
CREATE INDEX `course_role_req_course_idx` ON `course_role_requirement` (`course_id`);