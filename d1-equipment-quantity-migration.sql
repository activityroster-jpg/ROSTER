-- Migration 0028: quantity on equipment types (how many of each, e.g. 12 Pico dinghies).
-- Run once in the D1 console (not via db:migrate:remote).
ALTER TABLE equipment_type ADD quantity integer;
