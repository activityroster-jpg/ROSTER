ALTER TABLE `membership` ADD `invite_sent_at` integer;--> statement-breakpoint
ALTER TABLE `membership` ADD `invite_reminded_at` integer;--> statement-breakpoint
ALTER TABLE `membership` ADD `invited_by_name` text;