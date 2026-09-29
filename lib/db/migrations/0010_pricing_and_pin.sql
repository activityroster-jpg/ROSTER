CREATE TABLE `platform_pricing` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`monthly_price` real DEFAULT 75 NOT NULL,
	`annual_price` real DEFAULT 750 NOT NULL,
	`currency` text DEFAULT 'GBP' NOT NULL,
	`free_first_month` integer DEFAULT true NOT NULL,
	`trial_days` integer DEFAULT 30 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `organisation` ADD `discount_percent` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `organisation` ADD `custom_monthly_price` real;--> statement-breakpoint
ALTER TABLE `organisation` ADD `custom_annual_price` real;--> statement-breakpoint
ALTER TABLE `organisation` ADD `free_months` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `organisation` ADD `billing_note` text;--> statement-breakpoint
ALTER TABLE `user` ADD `pin_hash` text;--> statement-breakpoint
ALTER TABLE `user` ADD `pin_failed_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `pin_locked_until` integer;