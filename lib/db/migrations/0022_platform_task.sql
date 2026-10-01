CREATE TABLE `platform_task` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`category` text,
	`priority` text DEFAULT 'medium' NOT NULL,
	`due_date` text,
	`status` text DEFAULT 'upcoming' NOT NULL,
	`notes` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `platform_task_status_idx` ON `platform_task` (`status`);