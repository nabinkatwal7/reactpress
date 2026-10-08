-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "searchVector" tsvector;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "searchVector" tsvector;

-- CreateIndex
CREATE INDEX "Page_searchVector_idx" ON "Page" USING GIN ("searchVector");

-- CreateIndex
CREATE INDEX "Post_searchVector_idx" ON "Post" USING GIN ("searchVector");

-- Plain text of a block array: every block's "text" field, space-joined.
CREATE OR REPLACE FUNCTION rp_blocks_text(content jsonb) RETURNS text AS $$
  SELECT COALESCE(string_agg(elem->>'text', ' '), '')
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(content) = 'array' THEN content ELSE '[]'::jsonb END
  ) AS elem
  WHERE jsonb_typeof(elem) = 'object';
$$ LANGUAGE sql IMMUTABLE;

-- Title weighs more (A) than body (B).
CREATE OR REPLACE FUNCTION rp_update_search_vector() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', rp_blocks_text(NEW.content)), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_search_vector BEFORE INSERT OR UPDATE OF title, content ON "Post"
  FOR EACH ROW EXECUTE FUNCTION rp_update_search_vector();
CREATE TRIGGER page_search_vector BEFORE INSERT OR UPDATE OF title, content ON "Page"
  FOR EACH ROW EXECUTE FUNCTION rp_update_search_vector();

-- Backfill existing rows
UPDATE "Post" SET title = title;
UPDATE "Page" SET title = title;
