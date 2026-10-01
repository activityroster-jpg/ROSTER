CREATE TABLE platform_task (
  id text PRIMARY KEY NOT NULL,
  title text NOT NULL,
  category text,
  priority text NOT NULL DEFAULT 'medium',
  due_date text,
  status text NOT NULL DEFAULT 'upcoming',
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at integer NOT NULL,
  updated_at integer NOT NULL
);
CREATE INDEX platform_task_status_idx ON platform_task (status);
