-- Migration 0035: push tokens for the instructor app + clock-in/out location.
-- Run once in the D1 console (not via db:migrate:remote).
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

CREATE UNIQUE INDEX `push_token_token_uq` ON `push_token` (`token`);
CREATE INDEX `push_token_user_idx` ON `push_token` (`user_id`);
ALTER TABLE `time_entry` ADD `in_lat` real;
ALTER TABLE `time_entry` ADD `in_lng` real;
ALTER TABLE `time_entry` ADD `in_accuracy_m` integer;
ALTER TABLE `time_entry` ADD `out_lat` real;
ALTER TABLE `time_entry` ADD `out_lng` real;
ALTER TABLE `time_entry` ADD `out_accuracy_m` integer;