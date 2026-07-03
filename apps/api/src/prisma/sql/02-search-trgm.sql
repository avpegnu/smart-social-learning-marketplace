-- ============================================================
--  Index trigram (pg_trgm) — tăng tốc tìm kiếm chuỗi con
-- ============================================================
--  Vấn đề : ô tìm kiếm dùng ILIKE '%tu-khoa%' → không dùng được index
--           B-tree thường → quét cả bảng (chậm khi dữ liệu lớn).
--  Cách sửa: index GIN + pg_trgm giúp ILIKE '%...%' chạy qua index.
--           KHÔNG phải sửa code — câu `contains` của Prisma tự hưởng.
--
--  Cách chạy (áp tay, không qua `db push`):
--    npx prisma db execute --file src/prisma/sql/02-search-trgm.sql --schema src/prisma/schema.prisma
--
--  An toàn: chỉ TẠO index, không đụng dữ liệu; muốn gỡ thì DROP INDEX.

-- Bật extension trigram (Neon có sẵn, chỉ cần bật một lần)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---- Tìm kiếm khóa học: tiêu đề, mô tả ngắn, tên giảng viên, tên danh mục ----
CREATE INDEX IF NOT EXISTS idx_courses_title_trgm
  ON courses USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_courses_shortdesc_trgm
  ON courses USING gin (short_description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_fullname_trgm
  ON users USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_categories_name_trgm
  ON categories USING gin (name gin_trgm_ops);

-- ---- Các ô tìm kiếm khác: nhóm, ngân hàng câu hỏi, hỏi đáp, thẻ ----
CREATE INDEX IF NOT EXISTS idx_groups_name_trgm
  ON groups USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_question_banks_name_trgm
  ON question_banks USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_questions_title_trgm
  ON questions USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_questions_content_trgm
  ON questions USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tags_name_trgm
  ON tags USING gin (name gin_trgm_ops);

-- ---- Kiểm tra index có chạy không ----
--  (Bảng ít dữ liệu Postgres sẽ chọn quét bảng vì nhanh hơn → thêm dòng SET để ép)
--    SET enable_seqscan = off;
--    EXPLAIN ANALYZE SELECT id FROM courses WHERE title ILIKE '%react%';
--    → mong đợi thấy: "Bitmap Index Scan using idx_courses_title_trgm"
--  Lưu ý: trigram cần >= 3 ký tự thì index mới phát huy.

-- ---- Muốn gỡ toàn bộ (nếu cần) ----
--    DROP INDEX IF EXISTS idx_courses_title_trgm, idx_courses_shortdesc_trgm,
--      idx_users_fullname_trgm, idx_categories_name_trgm, idx_groups_name_trgm,
--      idx_question_banks_name_trgm, idx_questions_title_trgm,
--      idx_questions_content_trgm, idx_tags_name_trgm;
