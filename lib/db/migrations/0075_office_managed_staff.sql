ALTER TABLE `instructor` ADD `managed_by` text;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `staff_managed_by` text DEFAULT 'staff' NOT NULL;