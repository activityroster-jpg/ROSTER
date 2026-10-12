-- Parental permission to work (under 18) is withdrawn from the platform entirely
-- (Conor, 12 Oct 2026): the check and any records of it go. Additive-first rule
-- waived deliberately: the type was retired in 0080 and nothing reads it.
DELETE FROM `compliance_item` WHERE `compliance_type_id` IN (SELECT `id` FROM `compliance_type` WHERE `code` = 'PARENTAL_PERMISSION');--> statement-breakpoint
DELETE FROM `compliance_type` WHERE `code` = 'PARENTAL_PERMISSION';
