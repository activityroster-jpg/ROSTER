CREATE TABLE `leave_request` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`type` text DEFAULT 'annual' NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`days` real DEFAULT 1 NOT NULL,
	`reason` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`decided_by_user_id` text,
	`decided_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instructor_id`) REFERENCES `instructor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `leave_request_org_idx` ON `leave_request` (`organisation_id`);--> statement-breakpoint
CREATE INDEX `leave_request_instructor_idx` ON `leave_request` (`instructor_id`);--> statement-breakpoint
CREATE TABLE `open_shift` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`course_session_id` text NOT NULL,
	`role_type_id` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`claimed_by_instructor_id` text,
	`filled_by_instructor_id` text,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_session_id`) REFERENCES `course_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_type_id`) REFERENCES `role_type`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`claimed_by_instructor_id`) REFERENCES `instructor`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`filled_by_instructor_id`) REFERENCES `instructor`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `open_shift_org_idx` ON `open_shift` (`organisation_id`);--> statement-breakpoint
CREATE INDEX `open_shift_session_idx` ON `open_shift` (`course_session_id`);