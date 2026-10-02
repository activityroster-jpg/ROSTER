-- Migration 0030: course types can be kept off the regular list (one-offs).
-- Run once in the D1 console (not via db:migrate:remote). Existing types stay listed.
ALTER TABLE `course_type` ADD `listed` integer DEFAULT 1 NOT NULL;
