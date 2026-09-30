-- ActivityRoster — D1 statements to run in the Cloudflare D1 console.
-- Run ONE statement at a time. SQLite has no "ADD COLUMN IF NOT EXISTS",
-- so a "duplicate column name" or "table already exists" error just means it
-- is already applied — skip that line and continue.

-- ============================================================
-- MUST RUN (new this session)
-- ============================================================

ALTER TABLE organisation ADD setup_purchased_at integer;
ALTER TABLE platform_pricing ADD setup_price real NOT NULL DEFAULT 850;
ALTER TABLE platform_pricing ADD setup_enabled integer NOT NULL DEFAULT 1;

ALTER TABLE org_settings ADD enforce_licence_checks integer NOT NULL DEFAULT 0;
ALTER TABLE org_settings ADD enforce_ratio_checks integer NOT NULL DEFAULT 0;
ALTER TABLE org_settings ADD enforce_conflict_checks integer NOT NULL DEFAULT 0;

ALTER TABLE course ADD source text;
ALTER TABLE course ADD external_ref text;

-- ============================================================
-- RUN ONLY IF NOT ALREADY APPLIED (earlier work)
-- ============================================================

ALTER TABLE org_settings ADD availability_weeks_ahead integer NOT NULL DEFAULT 4;
ALTER TABLE integration ADD token text;

-- integration table (only if it does not exist yet)
CREATE TABLE integration (
  id text PRIMARY KEY NOT NULL,
  organisation_id text NOT NULL,
  provider text NOT NULL,
  kind text DEFAULT 'ics' NOT NULL,
  feed_url text,
  token text,
  status text DEFAULT 'connected' NOT NULL,
  auto_sync integer DEFAULT 1 NOT NULL,
  last_synced_at integer,
  last_result text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  FOREIGN KEY (organisation_id) REFERENCES organisation(id) ON DELETE cascade
);
CREATE INDEX integration_org_idx ON integration (organisation_id);

-- blog_post table (only if it does not exist yet)
CREATE TABLE blog_post (
  id text PRIMARY KEY NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  excerpt text DEFAULT '' NOT NULL,
  body text DEFAULT '' NOT NULL,
  category text DEFAULT 'Guides' NOT NULL,
  tags text DEFAULT '' NOT NULL,
  author text DEFAULT 'The ActivityRoster Team' NOT NULL,
  cover_emoji text NOT NULL DEFAULT '',
  seo_title text,
  seo_description text,
  status text DEFAULT 'draft' NOT NULL,
  publish_at integer,
  created_at integer NOT NULL,
  updated_at integer NOT NULL
);
CREATE UNIQUE INDEX blog_post_slug_uq ON blog_post (slug);
CREATE INDEX blog_post_publish_idx ON blog_post (publish_at);
CREATE INDEX blog_post_status_idx ON blog_post (status);
