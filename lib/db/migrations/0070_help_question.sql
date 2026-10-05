CREATE TABLE `help_question` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`question` text NOT NULL,
	`topic` text,
	`found` integer DEFAULT false NOT NULL,
	`path` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `help_question_org_idx` ON `help_question` (`organisation_id`);--> statement-breakpoint
CREATE INDEX `help_question_created_idx` ON `help_question` (`created_at`);