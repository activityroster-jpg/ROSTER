CREATE INDEX `availability_org_date_idx` ON `availability` (`organisation_id`,`date`);--> statement-breakpoint
CREATE INDEX `hours_record_session_idx` ON `hours_record` (`course_session_id`);