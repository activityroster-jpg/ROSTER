-- Migration 0026: pricing tier on organisation.
-- Small Club (£35, hard-capped at 10 people) vs Standard (£65, unlimited).
-- Existing centres default to 'standard' so none is ever retroactively capped.
-- Run once in the D1 console (not via db:migrate:remote).
ALTER TABLE organisation ADD tier text DEFAULT 'standard' NOT NULL;
