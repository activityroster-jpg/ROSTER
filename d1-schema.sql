CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `account_user_idx` ON `account` (`user_id`);

CREATE TABLE `membership` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`organisation_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `membership_user_org_uq` ON `membership` (`user_id`,`organisation_id`);

CREATE INDEX `membership_org_idx` ON `membership` (`organisation_id`);

CREATE INDEX `membership_user_idx` ON `membership` (`user_id`);

CREATE TABLE `organisation` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`jurisdiction` text NOT NULL,
	`plan` text DEFAULT 'rostering' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`subscription_status` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

CREATE UNIQUE INDEX `organisation_slug_uq` ON `organisation` (`slug`);

CREATE UNIQUE INDEX `organisation_stripe_customer_uq` ON `organisation` (`stripe_customer_id`);

CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`active_organization_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `session_token_uq` ON `session` (`token`);

CREATE INDEX `session_user_idx` ON `session` (`user_id`);

CREATE TABLE `slug_reservation` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);

CREATE UNIQUE INDEX `slug_reservation_slug_uq` ON `slug_reservation` (`slug`);

CREATE TABLE `two_factor` (
	`id` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL,
	`backup_codes` text NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `two_factor_user_idx` ON `two_factor` (`user_id`);

CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`two_factor_enabled` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

CREATE UNIQUE INDEX `user_email_uq` ON `user` (`email`);

CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);

CREATE TABLE `webhook_event` (
	`id` text PRIMARY KEY NOT NULL,
	`stripe_event_id` text NOT NULL,
	`type` text NOT NULL,
	`payload` text,
	`processed_at` integer,
	`created_at` integer NOT NULL
);

CREATE UNIQUE INDEX `webhook_event_stripe_id_uq` ON `webhook_event` (`stripe_event_id`);

CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`before` text,
	`after` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `audit_log_org_idx` ON `audit_log` (`organisation_id`);

CREATE INDEX `audit_log_entity_idx` ON `audit_log` (`organisation_id`,`entity`,`entity_id`);

CREATE TABLE `availability` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`date` text,
	`weekday` integer,
	`slot` text NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instructor_id`) REFERENCES `instructor`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `availability_org_idx` ON `availability` (`organisation_id`);

CREATE INDEX `availability_instructor_idx` ON `availability` (`instructor_id`);

CREATE TABLE `compliance_item` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`compliance_type_id` text NOT NULL,
	`reference` text,
	`issue_date` text,
	`expiry_date` text,
	`doc_key` text,
	`verified` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instructor_id`) REFERENCES `instructor`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`compliance_type_id`) REFERENCES `compliance_type`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE INDEX `compliance_item_org_idx` ON `compliance_item` (`organisation_id`);

CREATE INDEX `compliance_item_instructor_idx` ON `compliance_item` (`instructor_id`);

CREATE TABLE `compliance_type` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`mandatory` integer DEFAULT false NOT NULL,
	`expiry_tracked` integer DEFAULT true NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `compliance_type_org_idx` ON `compliance_type` (`organisation_id`);

CREATE UNIQUE INDEX `compliance_type_org_code_uq` ON `compliance_type` (`organisation_id`,`code`);

CREATE TABLE `course` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`course_type_id` text NOT NULL,
	`name` text,
	`capacity` integer DEFAULT 1 NOT NULL,
	`ratio` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_type_id`) REFERENCES `course_type`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE INDEX `course_org_idx` ON `course` (`organisation_id`);

CREATE INDEX `course_type_ref_idx` ON `course` (`course_type_id`);

CREATE TABLE `course_equipment` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`course_id` text NOT NULL,
	`equipment_id` text,
	`equipment_type_id` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`is_override` integer DEFAULT false NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `course`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`equipment_type_id`) REFERENCES `equipment_type`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE INDEX `course_equipment_org_idx` ON `course_equipment` (`organisation_id`);

CREATE INDEX `course_equipment_course_idx` ON `course_equipment` (`course_id`);

CREATE TABLE `course_location` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`course_id` text NOT NULL,
	`location_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `course`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE INDEX `course_location_org_idx` ON `course_location` (`organisation_id`);

CREATE INDEX `course_location_course_idx` ON `course_location` (`course_id`);

CREATE TABLE `course_session` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`course_id` text NOT NULL,
	`date` text NOT NULL,
	`slot` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `course`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `course_session_org_idx` ON `course_session` (`organisation_id`);

CREATE INDEX `course_session_course_idx` ON `course_session` (`course_id`);

CREATE INDEX `course_session_date_idx` ON `course_session` (`organisation_id`,`date`);

CREATE TABLE `course_staff` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`course_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`role_type_id` text NOT NULL,
	`status` text DEFAULT 'assigned' NOT NULL,
	`is_override` integer DEFAULT false NOT NULL,
	`override_note` text,
	`overridden_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `course`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instructor_id`) REFERENCES `instructor`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`role_type_id`) REFERENCES `role_type`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE INDEX `course_staff_org_idx` ON `course_staff` (`organisation_id`);

CREATE INDEX `course_staff_course_idx` ON `course_staff` (`course_id`);

CREATE INDEX `course_staff_instructor_idx` ON `course_staff` (`instructor_id`);

CREATE TABLE `course_type` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`name` text NOT NULL,
	`scheme` text,
	`default_capacity` integer DEFAULT 1 NOT NULL,
	`students_per_instructor` integer DEFAULT 1 NOT NULL,
	`requires_safety_boat` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `course_type_org_idx` ON `course_type` (`organisation_id`);

CREATE TABLE `course_type_equipment` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`course_type_id` text NOT NULL,
	`equipment_type_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_type_id`) REFERENCES `course_type`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`equipment_type_id`) REFERENCES `equipment_type`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE INDEX `course_type_equipment_org_idx` ON `course_type_equipment` (`organisation_id`);

CREATE INDEX `course_type_equipment_ct_idx` ON `course_type_equipment` (`course_type_id`);

CREATE TABLE `course_type_staffing` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`course_type_id` text NOT NULL,
	`qualification_type_id` text NOT NULL,
	`min_count` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_type_id`) REFERENCES `course_type`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`qualification_type_id`) REFERENCES `qualification_type`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE INDEX `course_type_staffing_org_idx` ON `course_type_staffing` (`organisation_id`);

CREATE INDEX `course_type_staffing_ct_idx` ON `course_type_staffing` (`course_type_id`);

CREATE TABLE `equipment` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`equipment_type_id` text NOT NULL,
	`name` text NOT NULL,
	`identifier` text,
	`status` text DEFAULT 'available' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`equipment_type_id`) REFERENCES `equipment_type`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE INDEX `equipment_org_idx` ON `equipment` (`organisation_id`);

CREATE INDEX `equipment_type_idx` ON `equipment` (`equipment_type_id`);

CREATE TABLE `equipment_type` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`name` text NOT NULL,
	`inventory_tracked` integer DEFAULT true NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `equipment_type_org_idx` ON `equipment_type` (`organisation_id`);

CREATE TABLE `hours_record` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`course_session_id` text,
	`scheduled_minutes` integer DEFAULT 0 NOT NULL,
	`actual_minutes` integer,
	`rate` real,
	`approved` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instructor_id`) REFERENCES `instructor`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_session_id`) REFERENCES `course_session`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX `hours_record_org_idx` ON `hours_record` (`organisation_id`);

CREATE INDEX `hours_record_instructor_idx` ON `hours_record` (`instructor_id`);

CREATE TABLE `instructor` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`employment_type` text DEFAULT 'employed' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `instructor_org_idx` ON `instructor` (`organisation_id`);

CREATE INDEX `instructor_user_idx` ON `instructor` (`user_id`);

CREATE TABLE `location` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`location_type_id` text,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_type_id`) REFERENCES `location_type`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE INDEX `location_org_idx` ON `location` (`organisation_id`);

CREATE TABLE `location_type` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `location_type_org_idx` ON `location_type` (`organisation_id`);

CREATE TABLE `notification` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`user_id` text,
	`instructor_id` text,
	`channel` text DEFAULT 'in_app' NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`read_at` integer,
	`sent_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `notification_org_idx` ON `notification` (`organisation_id`);

CREATE TABLE `org_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`scheduling_mode` text DEFAULT 'session' NOT NULL,
	`alert_lead_days` integer DEFAULT 30 NOT NULL,
	`currency` text DEFAULT 'GBP' NOT NULL,
	`timezone` text DEFAULT 'Europe/London' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `org_settings_org_uq` ON `org_settings` (`organisation_id`);

CREATE TABLE `pay_rate` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`instructor_id` text,
	`role_type_id` text,
	`rate` real NOT NULL,
	`unit` text DEFAULT 'hour' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instructor_id`) REFERENCES `instructor`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_type_id`) REFERENCES `role_type`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE INDEX `pay_rate_org_idx` ON `pay_rate` (`organisation_id`);

CREATE TABLE `qualification` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`qualification_type_id` text NOT NULL,
	`cert_no` text,
	`issue_date` text,
	`expiry_date` text,
	`doc_key` text,
	`verified` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instructor_id`) REFERENCES `instructor`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`qualification_type_id`) REFERENCES `qualification_type`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE INDEX `qualification_org_idx` ON `qualification` (`organisation_id`);

CREATE INDEX `qualification_instructor_idx` ON `qualification` (`instructor_id`);

CREATE TABLE `qualification_type` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`rank` integer DEFAULT 0 NOT NULL,
	`discipline` text,
	`expiry_tracked` integer DEFAULT false NOT NULL,
	`default_valid_months` integer,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `qualification_type_org_idx` ON `qualification_type` (`organisation_id`);

CREATE UNIQUE INDEX `qualification_type_org_code_uq` ON `qualification_type` (`organisation_id`,`code`);

CREATE TABLE `role_type` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`counts_toward_ratio` integer DEFAULT true NOT NULL,
	`is_safety_cover` integer DEFAULT false NOT NULL,
	`is_first_aider` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `role_type_org_idx` ON `role_type` (`organisation_id`);

CREATE UNIQUE INDEX `role_type_org_code_uq` ON `role_type` (`organisation_id`,`code`);

CREATE TABLE `session_slot` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `session_slot_org_idx` ON `session_slot` (`organisation_id`);

CREATE UNIQUE INDEX `session_slot_org_code_uq` ON `session_slot` (`organisation_id`,`code`);
