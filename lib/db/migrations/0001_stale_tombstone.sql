CREATE TABLE `lead` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`centre_name` text,
	`org_type` text,
	`message` text,
	`source` text DEFAULT 'marketing' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lead_email_uq` ON `lead` (`email`);