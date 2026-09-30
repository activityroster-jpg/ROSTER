CREATE TABLE `integration` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`provider` text NOT NULL,
	`kind` text DEFAULT 'ics' NOT NULL,
	`feed_url` text,
	`status` text DEFAULT 'connected' NOT NULL,
	`auto_sync` integer DEFAULT true NOT NULL,
	`last_synced_at` integer,
	`last_result` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `integration_org_idx` ON `integration` (`organisation_id`);