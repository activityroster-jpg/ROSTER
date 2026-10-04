CREATE TABLE `trial_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`user_id` text,
	`most_useful` text NOT NULL,
	`least_useful` text NOT NULL,
	`would_change` text NOT NULL,
	`missing` text NOT NULL,
	`feature_request` text NOT NULL,
	`user_count` integer NOT NULL,
	`other_feedback` text NOT NULL,
	`contact_ok` integer NOT NULL,
	`contact_email` text,
	`contact_answered_at` integer NOT NULL,
	`reward_days` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trial_feedback_org_uq` ON `trial_feedback` (`organisation_id`);--> statement-breakpoint
CREATE INDEX `trial_feedback_contact_idx` ON `trial_feedback` (`contact_ok`);--> statement-breakpoint
ALTER TABLE `organisation` ADD `trial_survey_sent_at` integer;