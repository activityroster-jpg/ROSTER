CREATE TABLE `blog_post` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`excerpt` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'Guides' NOT NULL,
	`tags` text DEFAULT '' NOT NULL,
	`author` text DEFAULT 'The ActivityRoster Team' NOT NULL,
	`cover_emoji` text DEFAULT '⛵' NOT NULL,
	`seo_title` text,
	`seo_description` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`publish_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blog_post_slug_uq` ON `blog_post` (`slug`);--> statement-breakpoint
CREATE INDEX `blog_post_publish_idx` ON `blog_post` (`publish_at`);--> statement-breakpoint
CREATE INDEX `blog_post_status_idx` ON `blog_post` (`status`);