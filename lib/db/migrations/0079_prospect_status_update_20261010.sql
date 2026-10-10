-- Prospects, 10 October 2026 (Conor). A one-off data update; no table changes.
-- 1. A prospect with no statuses list keeps its single status as the list.
UPDATE marketing_prospect SET statuses = json_array(status) WHERE statuses IS NULL OR json_valid(statuses) = 0;
--> statement-breakpoint
-- 2. LinkedIn has its own tab and tracker: anyone contacted there is "contacted, no response" until updated.
UPDATE marketing_prospect SET linkedin_status = 'no_response' WHERE EXISTS (SELECT 1 FROM json_each(marketing_prospect.statuses) WHERE value = 'linkedin_contacted');
--> statement-breakpoint
-- 3. The 17 clubs whose letters went out: Letter sent (keeping rejected, signed up, emailed or called).
UPDATE marketing_prospect SET statuses = (SELECT json_group_array(value) FROM (SELECT 'letter_sent' AS value UNION ALL SELECT value FROM json_each(marketing_prospect.statuses) WHERE value IN ('rejected', 'purchased', 'email_sent', 'called', 'flyer_sent', 'booklet_sent'))) WHERE lower(trim(replace(replace(name, '-', ' '), '  ', ' '))) IN ('blithfield sailing club ltd', 'blithfield sailing club', 'bitthfield sailing club', 'cardiff bay yacht club', 'bartley sailing club', 'barnt green sailing club', 'barry yacht club', 'bala sailing club', 'anglesey school of yachting', 'anglesey school of yachting (shantih marine)', 'shantih marine', 'yarmouth sailing club', 'whitstable yacht club', 'aldridge sailing club', 'shoreham sailing club', 'sea cadets whale island', 'sea cadets whale island boat station', 'dalgety bay sailing club ltd', 'dalgety bay sailing club', 'lee on the solent sailing club', 'warsash sailing club', 'royal victoria yacht club', 'worthing sailing club');
--> statement-breakpoint
-- 4. Everyone else marked Letter sent was printed but not posted: Ready to send.
UPDATE marketing_prospect SET statuses = (SELECT json_group_array(CASE WHEN value = 'letter_sent' THEN 'ready_to_send' ELSE value END) FROM json_each(marketing_prospect.statuses)) WHERE EXISTS (SELECT 1 FROM json_each(marketing_prospect.statuses) WHERE value = 'letter_sent') AND NOT (lower(trim(replace(replace(name, '-', ' '), '  ', ' '))) IN ('blithfield sailing club ltd', 'blithfield sailing club', 'bitthfield sailing club', 'cardiff bay yacht club', 'bartley sailing club', 'barnt green sailing club', 'barry yacht club', 'bala sailing club', 'anglesey school of yachting', 'anglesey school of yachting (shantih marine)', 'shantih marine', 'yarmouth sailing club', 'whitstable yacht club', 'aldridge sailing club', 'shoreham sailing club', 'sea cadets whale island', 'sea cadets whale island boat station', 'dalgety bay sailing club ltd', 'dalgety bay sailing club', 'lee on the solent sailing club', 'warsash sailing club', 'royal victoria yacht club', 'worthing sailing club'));
--> statement-breakpoint
-- 5. Retired values leave the list ("new" is simply no ticks; LinkedIn lives on its own tab).
UPDATE marketing_prospect SET statuses = (SELECT json_group_array(value) FROM json_each(marketing_prospect.statuses) WHERE value NOT IN ('new', 'linkedin_contacted')) WHERE EXISTS (SELECT 1 FROM json_each(marketing_prospect.statuses) WHERE value IN ('new', 'linkedin_contacted'));
--> statement-breakpoint
-- 6. The single status column follows the furthest tick (lib/marketing PROSPECT_STATUS_ORDER).
UPDATE marketing_prospect SET status = CASE
  WHEN EXISTS (SELECT 1 FROM json_each(marketing_prospect.statuses) WHERE value = 'rejected') THEN 'rejected'
  WHEN EXISTS (SELECT 1 FROM json_each(marketing_prospect.statuses) WHERE value = 'purchased') THEN 'purchased'
  WHEN EXISTS (SELECT 1 FROM json_each(marketing_prospect.statuses) WHERE value = 'booklet_sent') THEN 'booklet_sent'
  WHEN EXISTS (SELECT 1 FROM json_each(marketing_prospect.statuses) WHERE value = 'flyer_sent') THEN 'flyer_sent'
  WHEN EXISTS (SELECT 1 FROM json_each(marketing_prospect.statuses) WHERE value = 'letter_sent') THEN 'letter_sent'
  WHEN EXISTS (SELECT 1 FROM json_each(marketing_prospect.statuses) WHERE value = 'ready_to_send') THEN 'ready_to_send'
  WHEN EXISTS (SELECT 1 FROM json_each(marketing_prospect.statuses) WHERE value = 'called') THEN 'called'
  WHEN EXISTS (SELECT 1 FROM json_each(marketing_prospect.statuses) WHERE value = 'email_sent') THEN 'email_sent'
  ELSE 'new' END;
