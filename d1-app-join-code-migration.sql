-- Migration 0034: company codes for the instructor app + phone on user.
-- Run once in the D1 console (not via db:migrate:remote). Codes are generated
-- the first time a centre's Settings page (or the app) asks for one.
ALTER TABLE `organisation` ADD `join_code` text;
CREATE UNIQUE INDEX `organisation_join_code_uq` ON `organisation` (`join_code`);
ALTER TABLE `user` ADD `phone` text;
