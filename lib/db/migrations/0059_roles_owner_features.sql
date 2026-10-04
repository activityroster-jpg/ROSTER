ALTER TABLE `membership` ADD `features` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
UPDATE `membership` SET `role` = 'owner', `features` = '["roster","staff","protected","payroll","settings","billing","exports"]' WHERE `role` = 'admin';--> statement-breakpoint
UPDATE `membership` SET `role` = 'instructor' WHERE `role` IN ('senior_instructor', 'welfare_officer');
