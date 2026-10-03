ALTER TABLE `org_settings` ADD `daily_digest_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `daily_digest_hour` integer DEFAULT 6 NOT NULL;