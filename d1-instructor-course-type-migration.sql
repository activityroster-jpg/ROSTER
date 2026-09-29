CREATE TABLE instructor_course_type (
  id text PRIMARY KEY NOT NULL,
  organisation_id text NOT NULL,
  instructor_id text NOT NULL,
  course_type_id text NOT NULL,
  created_at integer NOT NULL,
  FOREIGN KEY (organisation_id) REFERENCES organisation(id) ON DELETE cascade,
  FOREIGN KEY (instructor_id) REFERENCES instructor(id) ON DELETE cascade,
  FOREIGN KEY (course_type_id) REFERENCES course_type(id) ON DELETE restrict
);
CREATE INDEX instructor_course_type_org_idx ON instructor_course_type (organisation_id);
CREATE INDEX instructor_course_type_instructor_idx ON instructor_course_type (instructor_id);
