CREATE TABLE `page_view` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`path` text NOT NULL,
	`referrer_domain` text,
	`utm_source` text,
	`utm_medium` text,
	`utm_campaign` text,
	`device` text NOT NULL,
	`is_visit` integer DEFAULT false NOT NULL,
	`channel` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `page_view_day_idx` ON `page_view` (`day`);--> statement-breakpoint
CREATE INDEX `page_view_created_idx` ON `page_view` (`created_at`);--> statement-breakpoint
CREATE TABLE `traffic_marker` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`label` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `traffic_marker_day_idx` ON `traffic_marker` (`day`);--> statement-breakpoint
CREATE TABLE `visitor_seen` (
	`key` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `visitor_seen_expires_idx` ON `visitor_seen` (`expires_at`);--> statement-breakpoint
INSERT INTO `traffic_marker` (`id`, `day`, `label`, `created_at`) VALUES ('booklet-2026-10-19', '2026-10-19', 'Booklets posted', 1792368000000), ('booklet-2026-10-22', '2026-10-22', 'Booklets posted', 1792627200000);
