ALTER TABLE organisation ADD setup_purchased_at integer;
ALTER TABLE platform_pricing ADD setup_price real NOT NULL DEFAULT 850;
ALTER TABLE platform_pricing ADD setup_enabled integer NOT NULL DEFAULT 1;
