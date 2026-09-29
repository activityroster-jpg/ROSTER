CREATE TABLE error_report (
  id text PRIMARY KEY NOT NULL,
  organisation_id text,
  organisation_slug text,
  user_id text,
  user_email text,
  path text,
  message text NOT NULL,
  digest text,
  user_agent text,
  status text DEFAULT 'new' NOT NULL,
  created_at integer NOT NULL
);
CREATE INDEX error_report_org_idx ON error_report (organisation_id);
CREATE INDEX error_report_status_idx ON error_report (status);
