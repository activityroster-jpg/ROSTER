-- Migration 0027: admin account-recovery email on the user table.
-- A secondary email for account recovery, never used as a sign-in identity.
-- Run once in the D1 console (not via db:migrate:remote).
ALTER TABLE user ADD recovery_email text;
