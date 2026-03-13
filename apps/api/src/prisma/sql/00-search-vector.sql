-- Full-text search for courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_courses_search
  ON courses USING GIN(search_vector);

CREATE OR REPLACE FUNCTION update_course_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.short_description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_courses_search_vector
  BEFORE INSERT OR UPDATE OF title, short_description, description
  ON courses
  FOR EACH ROW
  EXECUTE FUNCTION update_course_search_vector();
