CREATE TABLE `marketing_interaction` (
	`id` text PRIMARY KEY NOT NULL,
	`prospect_id` text NOT NULL,
	`kind` text NOT NULL,
	`occurred_on` text NOT NULL,
	`summary` text,
	`author` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`prospect_id`) REFERENCES `marketing_prospect`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `marketing_interaction_prospect_idx` ON `marketing_interaction` (`prospect_id`,`occurred_on`);--> statement-breakpoint
ALTER TABLE `marketing_prospect` ADD `engaged_at` integer;