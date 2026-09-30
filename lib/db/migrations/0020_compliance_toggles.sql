ALTER TABLE `org_settings` ADD `enforce_licence_checks` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `enforce_ratio_checks` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `org_settings` ADD `enforce_conflict_checks` integer DEFAULT false NOT NULL;