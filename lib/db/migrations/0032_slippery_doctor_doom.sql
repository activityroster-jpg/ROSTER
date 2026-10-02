CREATE TABLE `security_event` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`organisation_id` text,
	`kind` text NOT NULL,
	`ip` text,
	`user_agent` text,
	`country` text,
	`meta` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `security_event_user_idx` ON `security_event` (`user_id`);--> statement-breakpoint
CREATE INDEX `security_event_created_idx` ON `security_event` (`created_at`);