CREATE TABLE `finance_receipt_inbox` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`from_address` text,
	`from_name` text,
	`subject` text,
	`file_key` text,
	`file_name` text,
	`file_type` text,
	`read_status` text DEFAULT 'unread' NOT NULL,
	`supplier` text,
	`receipt_date` text,
	`total_minor` integer,
	`vat_minor` integer,
	`currency` text,
	`summary` text,
	`suggested_category` text,
	`note` text,
	`transaction_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `finance_transaction`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finance_inbox_message_uq` ON `finance_receipt_inbox` (`message_id`);--> statement-breakpoint
CREATE INDEX `finance_inbox_status_idx` ON `finance_receipt_inbox` (`status`);--> statement-breakpoint
CREATE INDEX `finance_inbox_tx_idx` ON `finance_receipt_inbox` (`transaction_id`);--> statement-breakpoint
ALTER TABLE `finance_settings` ADD `receipt_inbox_token` text;--> statement-breakpoint
ALTER TABLE `finance_settings` ADD `receipt_forward_from` text;