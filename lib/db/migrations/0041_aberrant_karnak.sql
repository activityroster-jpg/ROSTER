CREATE TABLE `privacy_request` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`centre` text,
	`message` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`due_at` integer NOT NULL,
	`acknowledged_at` integer,
	`closed_at` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `privacy_request_status_idx` ON `privacy_request` (`status`);--> statement-breakpoint
CREATE INDEX `privacy_request_due_idx` ON `privacy_request` (`due_at`);--> statement-breakpoint
ALTER TABLE `organisation` ADD `terms_version` text;--> statement-breakpoint
ALTER TABLE `organisation` ADD `terms_accepted_at` integer;--> statement-breakpoint
ALTER TABLE `organisation` ADD `past_due_since` integer;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `privacy_notice_url` text;