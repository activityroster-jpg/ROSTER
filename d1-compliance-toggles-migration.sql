ALTER TABLE org_settings ADD enforce_licence_checks integer NOT NULL DEFAULT 0;
ALTER TABLE org_settings ADD enforce_ratio_checks integer NOT NULL DEFAULT 0;
ALTER TABLE org_settings ADD enforce_conflict_checks integer NOT NULL DEFAULT 0;
