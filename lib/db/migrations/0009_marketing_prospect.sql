CREATE TABLE `marketing_prospect` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`region` text,
	`address_line1` text,
	`address_line2` text,
	`city` text,
	`postcode` text,
	`country` text DEFAULT 'United Kingdom' NOT NULL,
	`email` text,
	`website` text,
	`linkedin_url` text,
	`contact_name` text,
	`contact_role` text,
	`status` text DEFAULT 'new' NOT NULL,
	`notes` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `marketing_prospect_status_idx` ON `marketing_prospect` (`status`);--> statement-breakpoint
CREATE INDEX `marketing_prospect_region_idx` ON `marketing_prospect` (`region`);