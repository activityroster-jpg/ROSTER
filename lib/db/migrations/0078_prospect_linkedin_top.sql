ALTER TABLE `marketing_prospect` ADD `linkedin_status` text DEFAULT 'not_contacted' NOT NULL;--> statement-breakpoint
ALTER TABLE `marketing_prospect` ADD `linkedin_contacts` text;--> statement-breakpoint
ALTER TABLE `marketing_prospect` ADD `linkedin_checked_at` integer;--> statement-breakpoint
ALTER TABLE `marketing_prospect` ADD `top_pick` integer;