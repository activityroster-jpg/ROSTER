CREATE TABLE `push_token` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`platform` text NOT NULL,
	`device_id` text,
	`last_seen_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_token_token_uq` ON `push_token` (`token`);--> statement-breakpoint
CREATE INDEX `push_token_user_idx` ON `push_token` (`user_id`);--> statement-breakpoint
ALTER TABLE `time_entry` ADD `in_lat` real;--> statement-breakpoint
ALTER TABLE `time_entry` ADD `in_lng` real;--> statement-breakpoint
ALTER TABLE `time_entry` ADD `in_accuracy_m` integer;--> statement-breakpoint
ALTER TABLE `time_entry` ADD `out_lat` real;--> statement-breakpoint
ALTER TABLE `time_entry` ADD `out_lng` real;--> statement-breakpoint
ALTER TABLE `time_entry` ADD `out_accuracy_m` integer;