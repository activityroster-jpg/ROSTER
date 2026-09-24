-- ActivityRoster — free-month signup migration.
-- Run ONCE against production D1 (dashboard → D1 → activityroster → Console).
-- Adds the setup-mode column that records whether a centre chose basic or full
-- setup at signup. Existing rows default to 'basic'.

ALTER TABLE `org_settings` ADD `setup_mode` text DEFAULT 'basic' NOT NULL;
