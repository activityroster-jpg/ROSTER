-- Marketing prospects: multi-select outreach statuses.
-- Run in the D1 console (hand-applied). Adds the column, then backfills each
-- prospect's existing single status into the new JSON array.
ALTER TABLE marketing_prospect ADD statuses text;
UPDATE marketing_prospect SET statuses = '["' || status || '"]' WHERE statuses IS NULL;
