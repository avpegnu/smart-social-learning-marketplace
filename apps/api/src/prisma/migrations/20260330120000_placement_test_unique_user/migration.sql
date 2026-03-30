-- DropIndex
DROP INDEX IF EXISTS "placement_tests_user_id_idx";

-- CreateIndex (unique constraint, one result per user)
CREATE UNIQUE INDEX "placement_tests_user_id_key" ON "placement_tests"("user_id");
