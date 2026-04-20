-- Enable pgvector extension if not exists
CREATE EXTENSION IF NOT EXISTS vector;

-- Restore embedding column to course_chunks table
ALTER TABLE course_chunks ADD COLUMN IF NOT EXISTS embedding vector(384);

-- Create index for similarity search
CREATE INDEX IF NOT EXISTS course_chunks_embedding_idx ON course_chunks USING hnsw (embedding vector_cosine_ops);
