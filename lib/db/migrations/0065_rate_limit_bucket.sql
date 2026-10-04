CREATE TABLE `rate_limit_bucket` (
	`key` text PRIMARY KEY NOT NULL,
	`window` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limit_bucket_expires_idx` ON `rate_limit_bucket` (`expires_at`);