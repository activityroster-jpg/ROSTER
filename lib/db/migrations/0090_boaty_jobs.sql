CREATE TABLE `job_post` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`title` text NOT NULL,
	`role_type` text NOT NULL,
	`employment_type` text NOT NULL,
	`positions` integer DEFAULT 1 NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`pay_type` text NOT NULL,
	`pay_amount_gbp` real,
	`accommodation` integer DEFAULT false NOT NULL,
	`location_text` text DEFAULT '' NOT NULL,
	`required_qualifications` text DEFAULT '[]' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`closing_date` text NOT NULL,
	`application_email` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`listing_id` text,
	`public_url` text,
	`expires_at` integer,
	`first_published_at` integer,
	`removed_reason` text,
	`sync_error` text,
	`applications_count` integer DEFAULT 0 NOT NULL,
	`created_by_user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `job_post_org_idx` ON `job_post` (`organisation_id`);--> statement-breakpoint
CREATE INDEX `job_post_status_idx` ON `job_post` (`status`);--> statement-breakpoint
CREATE TABLE `job_sync` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`job_post_id` text NOT NULL,
	`action` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`job_post_id`) REFERENCES `job_post`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `job_sync_org_idx` ON `job_sync` (`organisation_id`);--> statement-breakpoint
CREATE INDEX `job_sync_due_idx` ON `job_sync` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `job_sync_job_idx` ON `job_sync` (`job_post_id`);--> statement-breakpoint
ALTER TABLE `org_settings` ADD `recruit_town` text;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `recruit_postcode` text;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `recruit_region` text;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `recruit_website` text;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `recruit_logo_url` text;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `recruit_email` text;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `recruit_card_dismissed_at` integer;