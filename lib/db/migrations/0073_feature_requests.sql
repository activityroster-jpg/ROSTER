CREATE TABLE `feature_request` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`submitted_by_user_id` text,
	`submitter_name` text,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`public_title` text NOT NULL,
	`problem` text NOT NULL,
	`change` text NOT NULL,
	`who_affected` text,
	`frequency` text,
	`workaround` text,
	`importance` text DEFAULT 'important' NOT NULL,
	`details` text,
	`screenshot_key` text,
	`consent_public` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`response_to_centre` text,
	`status_changed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `feature_request_org_idx` ON `feature_request` (`organisation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `feature_request_status_idx` ON `feature_request` (`status`);--> statement-breakpoint
CREATE TABLE `feature_request_vote` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`organisation_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `feature_request`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feature_request_vote_uq` ON `feature_request_vote` (`request_id`,`organisation_id`);--> statement-breakpoint
CREATE INDEX `feature_request_vote_org_idx` ON `feature_request_vote` (`organisation_id`);