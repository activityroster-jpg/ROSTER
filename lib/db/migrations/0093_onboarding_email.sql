CREATE TABLE `onboarding_email` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`step` text NOT NULL,
	`status` text NOT NULL,
	`sent_to` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `onboarding_email_org_step_uq` ON `onboarding_email` (`organisation_id`,`step`);--> statement-breakpoint
CREATE INDEX `onboarding_email_org_idx` ON `onboarding_email` (`organisation_id`);