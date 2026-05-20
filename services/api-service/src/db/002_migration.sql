ALTER TABLE media_files ADD COLUMN title TEXT;
ALTER TABLE media_files ADD COLUMN search_vector TSVECTOR;
CREATE INDEX idx_search_vector ON media_files USING GIN(search_vector);

CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.title, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_search_vector
BEFORE INSERT OR UPDATE ON media_files
FOR EACH ROW EXECUTE FUNCTION update_search_vector();
