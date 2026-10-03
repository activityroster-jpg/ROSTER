CREATE TABLE `outreach_campaign` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`audience` text NOT NULL,
	`pitch` text NOT NULL,
	`target_roles` text NOT NULL,
	`tone` text,
	`steps` text NOT NULL,
	`from_name` text NOT NULL,
	`from_email` text NOT NULL,
	`reply_to` text,
	`daily_cap` integer DEFAULT 40 NOT NULL,
	`send_window_start` integer DEFAULT 8 NOT NULL,
	`send_window_end` integer DEFAULT 18 NOT NULL,
	`weekdays_only` integer DEFAULT true NOT NULL,
	`ai_personalise` integer DEFAULT true NOT NULL,
	`launched_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
CREATE TABLE `outreach_lead` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`prospect_id` text,
	`centre_name` text NOT NULL,
	`website` text,
	`region` text,
	`email` text,
	`email_verified` integer DEFAULT false NOT NULL,
	`contact_name` text,
	`contact_role` text,
	`research` text,
	`status` text DEFAULT 'new' NOT NULL,
	`step_index` integer DEFAULT 0 NOT NULL,
	`next_send_at` integer,
	`last_event_at` integer,
	`unsubscribe_token` text NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `outreach_campaign`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `outreach_lead_campaign_idx` ON `outreach_lead` (`campaign_id`);
CREATE INDEX `outreach_lead_status_idx` ON `outreach_lead` (`status`);
CREATE INDEX `outreach_lead_next_idx` ON `outreach_lead` (`next_send_at`);
CREATE UNIQUE INDEX `outreach_lead_token_uq` ON `outreach_lead` (`unsubscribe_token`);
CREATE TABLE `outreach_message` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`step` integer NOT NULL,
	`to_email` text NOT NULL,
	`subject` text NOT NULL,
	`body_text` text NOT NULL,
	`resend_id` text,
	`status` text DEFAULT 'sent' NOT NULL,
	`sent_at` integer NOT NULL,
	`opened_at` integer,
	`clicked_at` integer,
	`error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `outreach_lead`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `outreach_message_lead_idx` ON `outreach_message` (`lead_id`);
CREATE INDEX `outreach_message_campaign_idx` ON `outreach_message` (`campaign_id`);
CREATE UNIQUE INDEX `outreach_message_resend_uq` ON `outreach_message` (`resend_id`);
CREATE TABLE `outreach_suppression` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`reason` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL
);
CREATE UNIQUE INDEX `outreach_suppression_email_uq` ON `outreach_suppression` (`email`);
