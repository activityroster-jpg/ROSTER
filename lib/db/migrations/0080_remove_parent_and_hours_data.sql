-- Remove the parent features and working-hours rules for good (Conor, 10 Oct 2026; decision C8).
-- 1. Parent logins: delete the accounts that only ever had a parent role (their sessions,
--    sign-in methods and security log go with them, as when anyone is erased), then any
--    remaining parent memberships (a person who is also staff keeps their login).
DELETE FROM `user` WHERE `id` IN (SELECT `user_id` FROM `membership` WHERE `role` = 'parent') AND `id` NOT IN (SELECT `user_id` FROM `membership` WHERE `role` <> 'parent');--> statement-breakpoint
DELETE FROM `membership` WHERE `role` = 'parent';--> statement-breakpoint
-- 2. The "Parental permission to work" check stops being asked for (deactivated, never
--    deleted: any form a centre already uploaded stays on the person's record).
UPDATE `compliance_type` SET `active` = 0 WHERE `code` = 'PARENTAL_PERMISSION';--> statement-breakpoint
-- 3. The parent links (parent emails and consent notes), the rule packs and the
--    unused hours settings.
DROP TABLE `rule_pack`;--> statement-breakpoint
DROP TABLE `guardian_link`;--> statement-breakpoint
ALTER TABLE `org_settings` DROP COLUMN `working_time_mode`;--> statement-breakpoint
ALTER TABLE `org_settings` DROP COLUMN `term_dates`;--> statement-breakpoint
ALTER TABLE `org_settings` DROP COLUMN `require_parent_approval`;