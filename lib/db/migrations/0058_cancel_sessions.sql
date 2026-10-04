ALTER TABLE `course` ADD `cancelled_at` integer;--> statement-breakpoint
ALTER TABLE `course` ADD `cancel_reason` text;--> statement-breakpoint
ALTER TABLE `course_session` ADD `cancelled_at` integer;--> statement-breakpoint
ALTER TABLE `course_session` ADD `cancel_reason` text;--> statement-breakpoint
ALTER TABLE `course_session` ADD `cancel_pay` text;--> statement-breakpoint
ALTER TABLE `course_session` ADD `cancel_fee` real;