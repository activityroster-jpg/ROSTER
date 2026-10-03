CREATE TABLE `email_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`stream` text DEFAULT 'system' NOT NULL,
	`to_email` text NOT NULL,
	`from_addr` text NOT NULL,
	`subject` text NOT NULL,
	`html` text,
	`text` text,
	`reply_to` text,
	`headers` text,
	`tags` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`next_attempt_at` integer,
	`expires_at` integer,
	`provider` text,
	`provider_id` text,
	`sent_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_outbox_status_idx` ON `email_outbox` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `email_outbox_provider_idx` ON `email_outbox` (`provider_id`);--> statement-breakpoint
ALTER TABLE `marketing_prospect` ADD `lawful_basis` text DEFAULT 'legitimate_interests' NOT NULL;--> statement-breakpoint
ALTER TABLE `marketing_prospect` ADD `basis_note` text;--> statement-breakpoint
ALTER TABLE `marketing_prospect` ADD `sole_trader` integer DEFAULT false NOT NULL;