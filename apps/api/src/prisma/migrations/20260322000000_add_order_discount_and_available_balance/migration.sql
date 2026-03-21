-- AlterTable
ALTER TABLE "order_items" ADD COLUMN "discount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "instructor_profiles" ADD COLUMN "available_balance" DOUBLE PRECISION NOT NULL DEFAULT 0;
