CREATE TABLE `finance_settings` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`fy_start_month` integer DEFAULT 1 NOT NULL,
	`reporting_currency` text DEFAULT 'GBP' NOT NULL,
	`eur_to_gbp` real DEFAULT 0.86 NOT NULL,
	`opening_cash_minor` integer DEFAULT 0 NOT NULL,
	`opening_cash_date` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `finance_transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`counterparty` text,
	`amount_minor` integer NOT NULL,
	`vat_minor` integer,
	`currency` text DEFAULT 'GBP' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`external_id` text,
	`receipt_ref` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `finance_tx_date_idx` ON `finance_transaction` (`date`);--> statement-breakpoint
CREATE INDEX `finance_tx_category_idx` ON `finance_transaction` (`category`);--> statement-breakpoint
CREATE UNIQUE INDEX `finance_tx_external_uq` ON `finance_transaction` (`external_id`);