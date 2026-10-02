-- Migration 0031: course default schedules + lunch/rest break rules.
-- Run once in the D1 console (not via db:migrate:remote).
ALTER TABLE `course_type` ADD `default_schedule` text;
ALTER TABLE `org_settings` ADD `break_after_minutes` integer DEFAULT 360 NOT NULL;
ALTER TABLE `org_settings` ADD `break_minutes` integer DEFAULT 0 NOT NULL;
ALTER TABLE `org_settings` ADD `break_paid` integer DEFAULT 0 NOT NULL;
