-- ============================================================================
-- ActivityRoster — pending D1 migrations
-- Run these in the Cloudflare D1 console for the `activityroster` database.
-- Run each block ONCE. Re-running an ALTER that already exists will error
-- ("duplicate column name"); re-running a CREATE TABLE that already exists will
-- error ("table already exists"). If a block errors that way, you've already
-- run it — skip it and move on.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- BLOCK A — Error reporting (admin error log + "report it" flow)   [PENDING]
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- BLOCK B — Instructor notification preference                     [PENDING]
-- ----------------------------------------------------------------------------
ALTER TABLE instructor ADD notify_email integer DEFAULT 1 NOT NULL;

-- ----------------------------------------------------------------------------
-- BLOCK C — "Courses each instructor can teach" (explicit approvals) [PENDING]
-- ----------------------------------------------------------------------------
CREATE TABLE instructor_course_type (
  id text PRIMARY KEY NOT NULL,
  organisation_id text NOT NULL,
  instructor_id text NOT NULL,
  course_type_id text NOT NULL,
  created_at integer NOT NULL,
  FOREIGN KEY (organisation_id) REFERENCES organisation(id) ON DELETE cascade,
  FOREIGN KEY (instructor_id) REFERENCES instructor(id) ON DELETE cascade,
  FOREIGN KEY (course_type_id) REFERENCES course_type(id) ON DELETE restrict
);
CREATE INDEX instructor_course_type_org_idx ON instructor_course_type (organisation_id);
CREATE INDEX instructor_course_type_instructor_idx ON instructor_course_type (instructor_id);

-- ============================================================================
-- The blocks below were sent in earlier rounds. Run them ONLY if you have not
-- already. If you get "duplicate column name" / "table already exists", that
-- block is done — skip it.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- BLOCK D — Pricing config + per-centre overrides + user PIN   [maybe already run]
-- ----------------------------------------------------------------------------
CREATE TABLE platform_pricing (
  id text PRIMARY KEY DEFAULT 'default' NOT NULL,
  monthly_price real DEFAULT 75 NOT NULL,
  annual_price real DEFAULT 750 NOT NULL,
  currency text DEFAULT 'GBP' NOT NULL,
  free_first_month integer DEFAULT 1 NOT NULL,
  trial_days integer DEFAULT 30 NOT NULL,
  updated_at integer NOT NULL
);
ALTER TABLE organisation ADD discount_percent real DEFAULT 0 NOT NULL;
ALTER TABLE organisation ADD custom_monthly_price real;
ALTER TABLE organisation ADD custom_annual_price real;
ALTER TABLE organisation ADD free_months integer DEFAULT 0 NOT NULL;
ALTER TABLE organisation ADD billing_note text;
ALTER TABLE user ADD pin_hash text;
ALTER TABLE user ADD pin_failed_count integer DEFAULT 0 NOT NULL;
ALTER TABLE user ADD pin_locked_until integer;

-- ----------------------------------------------------------------------------
-- BLOCK E — Marketing prospects CRM                          [maybe already run]
-- ----------------------------------------------------------------------------
CREATE TABLE marketing_prospect (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  region text,
  address_line1 text,
  address_line2 text,
  city text,
  postcode text,
  country text DEFAULT 'United Kingdom' NOT NULL,
  email text,
  website text,
  linkedin_url text,
  contact_name text,
  contact_role text,
  status text DEFAULT 'new' NOT NULL,
  notes text,
  source text DEFAULT 'manual' NOT NULL,
  created_at integer NOT NULL,
  updated_at integer NOT NULL
);
CREATE INDEX marketing_prospect_status_idx ON marketing_prospect (status);
CREATE INDEX marketing_prospect_region_idx ON marketing_prospect (region);

-- ----------------------------------------------------------------------------
-- BLOCK F — Course audience/category + session style + feature flags
--                                                            [likely already run]
-- (You confirmed "This query successfully executed" for this earlier.)
-- ----------------------------------------------------------------------------
ALTER TABLE course_type ADD audience text DEFAULT 'all' NOT NULL;
ALTER TABLE course_type ADD category text;
ALTER TABLE org_settings ADD slot_style text DEFAULT 'slots' NOT NULL;
ALTER TABLE org_settings ADD enabled_features text DEFAULT '[]' NOT NULL;
