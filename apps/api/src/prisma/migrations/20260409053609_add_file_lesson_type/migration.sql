-- AlterEnum
ALTER TYPE "LessonType" ADD VALUE 'FILE';

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "file_extracted_text" TEXT,
ADD COLUMN     "file_mime_type" TEXT,
ADD COLUMN     "file_url" TEXT;
