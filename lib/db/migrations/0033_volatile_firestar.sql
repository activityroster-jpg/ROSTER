CREATE TABLE `trusted_device` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`device_id` text NOT NULL,
	`ip` text NOT NULL,
	`country` text,
	`user_agent` text,
	`last_seen_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trusted_device_uq` ON `trusted_device` (`user_id`,`device_id`,`ip`);--> statement-breakpoint
CREATE INDEX `trusted_device_user_idx` ON `trusted_device` (`user_id`);