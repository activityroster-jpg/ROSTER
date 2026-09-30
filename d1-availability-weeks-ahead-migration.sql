-- How many weeks ahead instructors can set availability (default 4).
-- Run once in the Cloudflare D1 console.
ALTER TABLE org_settings ADD availability_weeks_ahead integer DEFAULT 4 NOT NULL;
