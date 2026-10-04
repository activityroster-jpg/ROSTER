ALTER TABLE `hours_record` ADD `rate_pence` integer;--> statement-breakpoint
ALTER TABLE `hours_record` ADD `override_pay_pence` integer;--> statement-breakpoint
ALTER TABLE `hours_record` ADD `approved_at` integer;--> statement-breakpoint
ALTER TABLE `hours_record` ADD `approved_minutes` integer;--> statement-breakpoint
ALTER TABLE `hours_record` ADD `approved_date` text;--> statement-breakpoint
ALTER TABLE `hours_record` ADD `roster_changed_at` integer;--> statement-breakpoint
DELETE FROM `hours_record` WHERE `course_session_id` IS NOT NULL AND `id` NOT IN (SELECT `id` FROM (SELECT `id`, ROW_NUMBER() OVER (PARTITION BY `instructor_id`, `course_session_id` ORDER BY `approved` DESC, (`override_pay` IS NOT NULL OR `override_minutes` IS NOT NULL OR `actual_minutes` IS NOT NULL) DESC, `updated_at` DESC, `rowid` DESC) AS rn FROM `hours_record` WHERE `course_session_id` IS NOT NULL) WHERE rn = 1);--> statement-breakpoint
CREATE UNIQUE INDEX `hours_record_instructor_session_uq` ON `hours_record` (`instructor_id`,`course_session_id`) WHERE "course_session_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `holiday_pay_percent` real;--> statement-breakpoint
ALTER TABLE `pay_rate` ADD `rate_pence` integer;--> statement-breakpoint
DELETE FROM `course_staff` WHERE `id` NOT IN (SELECT `id` FROM (SELECT `id`, ROW_NUMBER() OVER (PARTITION BY `course_id`, `instructor_id`, `role_type_id` ORDER BY CASE `status` WHEN 'confirmed' THEN 0 WHEN 'assigned' THEN 1 ELSE 2 END, `updated_at` DESC, `rowid` DESC) AS rn FROM `course_staff`) WHERE rn = 1);--> statement-breakpoint
CREATE UNIQUE INDEX `course_staff_course_instructor_role_uq` ON `course_staff` (`course_id`,`instructor_id`,`role_type_id`);