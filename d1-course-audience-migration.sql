-- Phase 3 schema additions: course audience/category + session style + feature flags.
-- Safe to run once against the production D1 (activityroster) console.
-- (These mirror lib/db/migrations/0008_course_audience_slotstyle.sql and are
--  applied automatically on deploy via `wrangler d1 migrations apply` — run them
--  by hand only if you are not applying migrations on deploy.)

ALTER TABLE course_type ADD audience text DEFAULT 'all' NOT NULL;
ALTER TABLE course_type ADD category text;
ALTER TABLE org_settings ADD slot_style text DEFAULT 'slots' NOT NULL;
ALTER TABLE org_settings ADD enabled_features text DEFAULT '[]' NOT NULL;
