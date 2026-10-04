ALTER TABLE `compliance_type` ADD `is_vetting` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `compliance_type` SET `is_vetting` = 1 WHERE `code` IN ('DBS','PVG','ACCESSNI','GARDA','VETTING');
