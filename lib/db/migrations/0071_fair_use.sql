ALTER TABLE `membership` ADD `invite_queued_at` integer;--> statement-breakpoint
ALTER TABLE `platform_pricing` ADD `fair_use_people` integer DEFAULT 500 NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_pricing` ADD `fair_use_alert_at` integer DEFAULT 300 NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_pricing` ADD `invite_daily_cap` integer DEFAULT 200 NOT NULL;