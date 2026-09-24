CREATE TABLE `time_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`course_session_id` text,
	`clock_in_at` integer NOT NULL,
	`clock_out_at` integer,
	`source` text DEFAULT 'clock' NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instructor_id`) REFERENCES `instructor`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_session_id`) REFERENCES `course_session`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `time_entry_org_idx` ON `time_entry` (`organisation_id`);--> statement-breakpoint
CREATE INDEX `time_entry_instructor_idx` ON `time_entry` (`instructor_id`);--> statement-breakpoint
CREATE INDEX `time_entry_session_idx` ON `time_entry` (`course_session_id`);