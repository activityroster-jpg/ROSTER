-- Append-only logs, with retention: recent rows can never be changed or
-- deleted while their owner exists; rows past the retention period
-- (audit_log 3 years, security_event 12 months, docs/retention.md) may be
-- deleted by the retention sweep. Updates are never allowed.
DROP TRIGGER IF EXISTS audit_log_no_delete;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS audit_log_no_delete BEFORE DELETE ON audit_log WHEN EXISTS (SELECT 1 FROM organisation WHERE id = OLD.organisation_id) AND OLD.created_at > (strftime('%s','now') - 3*365*86400) * 1000 BEGIN SELECT RAISE(ABORT, 'audit_log is append-only for 3 years while its centre exists'); END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS security_event_no_delete;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS security_event_no_delete BEFORE DELETE ON security_event WHEN EXISTS (SELECT 1 FROM user WHERE id = OLD.user_id) AND OLD.created_at > (strftime('%s','now') - 365*86400) * 1000 BEGIN SELECT RAISE(ABORT, 'security_event is append-only for 12 months while its user exists'); END;
