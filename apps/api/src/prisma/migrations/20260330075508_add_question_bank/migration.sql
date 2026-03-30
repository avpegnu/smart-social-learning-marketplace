-- CreateTable
CREATE TABLE "question_banks" (
    "id" TEXT NOT NULL,
    "instructor_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "question_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_bank_items" (
    "id" TEXT NOT NULL,
    "bank_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "explanation" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_bank_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_bank_options" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "question_bank_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "question_banks_instructor_id_idx" ON "question_banks"("instructor_id");

-- CreateIndex
CREATE INDEX "question_bank_items_bank_id_idx" ON "question_bank_items"("bank_id");

-- CreateIndex
CREATE INDEX "question_bank_options_question_id_idx" ON "question_bank_options"("question_id");

-- AddForeignKey
ALTER TABLE "question_banks" ADD CONSTRAINT "question_banks_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_bank_items" ADD CONSTRAINT "question_bank_items_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "question_banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_bank_options" ADD CONSTRAINT "question_bank_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "question_bank_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
