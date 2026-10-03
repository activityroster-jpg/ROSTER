-- Append-only logs, enforced in the database rather than by convention.
-- audit_log (per centre) and security_event (per user) can never be updated,
-- and can only be deleted as part of removing their owner (GDPR erasure):
-- the parent row is already gone when the cascade reaches them, so the
-- WHEN clause lets that through and blocks everything else.
CREATE TRIGGER IF NOT EXISTS audit_log_no_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS audit_log_no_delete BEFORE DELETE ON audit_log WHEN EXISTS (SELECT 1 FROM organisation WHERE id = OLD.organisation_id) BEGIN SELECT RAISE(ABORT, 'audit_log is append-only while its centre exists'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS security_event_no_update BEFORE UPDATE ON security_event BEGIN SELECT RAISE(ABORT, 'security_event is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS security_event_no_delete BEFORE DELETE ON security_event WHEN EXISTS (SELECT 1 FROM user WHERE id = OLD.user_id) BEGIN SELECT RAISE(ABORT, 'security_event is append-only while its user exists'); END;
