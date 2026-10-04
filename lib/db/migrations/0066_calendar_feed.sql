ALTER TABLE `instructor` ADD `calendar_token_hash` text;--> statement-breakpoint
ALTER TABLE `instructor` ADD `calendar_token_created_at` integer;--> statement-breakpoint
CREATE INDEX `instructor_calendar_token_idx` ON `instructor` (`calendar_token_hash`);