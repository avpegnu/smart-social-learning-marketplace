-- Enable pgvector extension (supported by Neon.tech)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to course_chunks table
ALTER TABLE course_chunks ADD COLUMN IF NOT EXISTS embedding vector(384);
