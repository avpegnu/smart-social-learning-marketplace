-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column (384 dimensions — all-MiniLM-L6-v2)
ALTER TABLE course_chunks ADD COLUMN IF NOT EXISTS embedding vector(384);

-- IVFFlat index
CREATE INDEX IF NOT EXISTS idx_course_chunks_embedding
  ON course_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
