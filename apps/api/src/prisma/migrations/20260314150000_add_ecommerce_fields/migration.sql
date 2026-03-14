-- AlterTable
ALTER TABLE "coupons" ADD COLUMN     "max_uses_per_user" INTEGER DEFAULT 1;

-- AlterTable
ALTER TABLE "earnings" ADD COLUMN     "available_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "order_code" TEXT NOT NULL,
ADD COLUMN     "paid_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_code_key" ON "orders"("order_code");
