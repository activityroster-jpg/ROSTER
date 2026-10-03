ALTER TABLE `organisation` ADD `join_code` text;--> statement-breakpoint
CREATE UNIQUE INDEX `organisation_join_code_uq` ON `organisation` (`join_code`);--> statement-breakpoint
ALTER TABLE `user` ADD `phone` text;