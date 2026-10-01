CREATE TABLE call_availability (
	id text PRIMARY KEY NOT NULL,
	day_of_week integer NOT NULL,
	start_minute integer NOT NULL,
	end_minute integer NOT NULL,
	active integer DEFAULT true NOT NULL,
	created_at integer NOT NULL,
	updated_at integer NOT NULL
);
CREATE INDEX call_availability_day_idx ON call_availability (day_of_week);
CREATE TABLE call_booking (
	id text PRIMARY KEY NOT NULL,
	start_at integer NOT NULL,
	duration_min integer DEFAULT 30 NOT NULL,
	name text NOT NULL,
	email text NOT NULL,
	centre text,
	notes text,
	status text DEFAULT 'booked' NOT NULL,
	created_at integer NOT NULL
);
CREATE INDEX call_booking_start_idx ON call_booking (start_at);