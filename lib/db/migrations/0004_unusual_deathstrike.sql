CREATE TABLE `onboarding_item` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`label` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instructor_id`) REFERENCES `instructor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `onboarding_item_org_idx` ON `onboarding_item` (`organisation_id`);--> statement-breakpoint
CREATE INDEX `onboarding_item_instructor_idx` ON `onboarding_item` (`instructor_id`);