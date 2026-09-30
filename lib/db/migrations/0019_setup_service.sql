ALTER TABLE `organisation` ADD `setup_purchased_at` integer;--> statement-breakpoint
ALTER TABLE `platform_pricing` ADD `setup_price` real DEFAULT 850 NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_pricing` ADD `setup_enabled` integer DEFAULT true NOT NULL;