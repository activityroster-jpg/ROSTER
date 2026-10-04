CREATE TABLE `guardian_link` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`consent_given_at` integer,
	`consent_by_user_id` text,
	`consent_note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instructor_id`) REFERENCES `instructor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `guardian_link_org_idx` ON `guardian_link` (`organisation_id`);--> statement-breakpoint
CREATE INDEX `guardian_link_user_idx` ON `guardian_link` (`user_id`);--> statement-breakpoint
CREATE INDEX `guardian_link_instructor_idx` ON `guardian_link` (`instructor_id`);--> statement-breakpoint
ALTER TABLE `instructor` ADD `share_contact` integer DEFAULT false NOT NULL;