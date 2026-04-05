/*
  Warnings:

  - A unique constraint covering the columns `[user_id,course_id,chapter_id]` on the table `cart_items` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "cart_items_user_id_course_id_chapter_id_key" ON "cart_items"("user_id", "course_id", "chapter_id");
