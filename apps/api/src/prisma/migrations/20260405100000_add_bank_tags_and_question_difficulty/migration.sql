-- CreateTable: question_bank_tags
CREATE TABLE "question_bank_tags" (
    "id" TEXT NOT NULL,
    "bank_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "question_bank_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "question_bank_tags_bank_id_idx" ON "question_bank_tags"("bank_id");

-- CreateIndex
CREATE UNIQUE INDEX "question_bank_tags_bank_id_name_key" ON "question_bank_tags"("bank_id", "name");

-- AddForeignKey
ALTER TABLE "question_bank_tags" ADD CONSTRAINT "question_bank_tags_bank_id_fkey"
    FOREIGN KEY ("bank_id") REFERENCES "question_banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add difficulty and tag_ids to question_bank_items
ALTER TABLE "question_bank_items" ADD COLUMN "difficulty" "CourseLevel";
ALTER TABLE "question_bank_items" ADD COLUMN "tag_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
