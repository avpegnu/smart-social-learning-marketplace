# Phase 2: DATABASE DESIGN — Smart Social Learning Marketplace

## Tổng quan

| Metric               | Value                               |
| -------------------- | ----------------------------------- |
| **Tổng số entities** | 65 models                           |
| **Enums**            | 26                                  |
| **Database**         | PostgreSQL 16 (Neon.tech free tier) |
| **Extensions**       | pgvector (RAG), pg_trgm (search)    |
| **ORM**              | Prisma (schema-first)               |
| **Storage limit**    | 0.5GB (Neon free)                   |

---

## 1. DESIGN DECISIONS

### 1.1 ID Strategy: CUID

```
✅ Chọn: cuid() (Collision-resistant Unique ID)
❌ Không chọn: UUID v4 (dài hơn, sort kém), Auto-increment (lộ count, khó distributed)

Lý do:
  - URL-safe, sortable by time (k-sortable)
  - Ngắn hơn UUID (25 chars vs 36 chars) → tiết kiệm index space
  - Không lộ tổng số records (khác auto-increment)
  - Prisma native support: @default(cuid())
```

### 1.2 Naming Convention

```
Prisma model:  PascalCase   (User, CourseTag, LessonProgress)
DB table:      snake_case   (users, course_tags, lesson_progress) — via @@map()
Prisma field:  camelCase    (userId, createdAt, avatarUrl)
DB column:     camelCase    (giữ nguyên — Prisma default)
Enum:          UPPER_SNAKE  (PENDING_REVIEW, MULTIPLE_CHOICE)
```

### 1.3 Soft Delete

```
Áp dụng cho 3 entities quan trọng (có deletedAt field):
  - User      — không xóa thật, ẩn khỏi hệ thống
  - Course    — instructor ẩn khóa, admin remove
  - Post      — xóa post nhưng giữ data cho audit

Các entity khác: Hard delete (CASCADE từ parent)
```

### 1.4 Denormalized Counters

```
Thay vì COUNT(*) mỗi lần query (chậm trên large tables), lưu counter trực tiếp:

  User:     followerCount, followingCount
  Course:   totalStudents, totalLessons, totalDuration, avgRating, reviewCount, viewCount
  Chapter:  lessonsCount, totalDuration
  Tag:      courseCount
  Post:     likeCount, commentCount, shareCount
  Group:    memberCount
  Question: viewCount, answerCount
  Answer:   voteCount
  Coupon:   usageCount

→ Update counter bằng atomic operation: SET count = count + 1
→ Consistency check bằng cron job weekly (reconcile)
```

### 1.5 JSON Fields (thay vì tạo thêm bảng)

```
Dùng JSONB cho data linh hoạt, ít query:

  User.notificationPreferences  — {POST_LIKED: {inApp: true, email: false}}
  InstructorProfile.qualifications — [{name, institution, year}]
  InstructorProfile.socialLinks — {github, linkedin, website}
  Media.urls                    — {original, "480p", "720p"}
  LessonProgress.watchedSegments — [[0,240],[480,960]]
  Withdrawal.bankInfo           — {bankName, accountNumber, accountName}
  Post.codeSnippet              — {language, code}
  Question.codeSnippet          — {language, code}
  Notification.data             — {actorId, targetId, message, url}
  PlacementQuestion.options     — [{id, text}]
  PlacementTest.scores          — {beginner: 5, intermediate: 3}
  AnalyticsSnapshot.data        — Flexible analytics
  PlatformSetting.value         — Any JSON value

→ JSONB cho phép index (GIN) nếu cần query bên trong
→ Tránh tạo 10+ bảng phụ cho data ít thay đổi
```

### 1.6 Composite Primary Keys

```
Dùng cho junction tables và progress tracking:

  CourseTag:      @@id([courseId, tagId])
  CouponCourse:   @@id([couponId, courseId])
  Follow:         @@id([followerId, followingId])
  LessonProgress: @@id([userId, lessonId])
  DailyActivity:  @@id([userId, activityDate])
```

### 1.7 Unique Constraints

```
Business rules enforce qua DB unique:

  Enrollment:         @@unique([userId, courseId])     — 1 enrollment/course
  ChapterPurchase:    @@unique([userId, chapterId])    — mua 1 lần
  Review:             @@unique([userId, courseId])      — 1 review/course
  Wishlist:           @@unique([userId, courseId])      — 1 wishlist/course
  Like:               @@unique([userId, postId])        — 1 like/post
  Bookmark:           @@unique([userId, postId])        — 1 bookmark/post
  Vote:               @@unique([userId, answerId])      — 1 vote/answer
  ConversationMember: @@unique([conversationId, userId])
  GroupMember:        @@unique([groupId, userId])
  GroupJoinRequest:   @@unique([groupId, userId])
  QuestionBankTag:    @@unique([bankId, name])
  UserSkill:          @@unique([userId, tagId])
  Certificate:        @@unique([userId, courseId])
  CourseSimilarity:   @@unique([courseId, similarCourseId, algorithm])
```

---

## 2. ENTITY RELATIONSHIP DIAGRAMS

### 2.1 Module 1: Auth & Users

```
┌──────────────────────┐
│        User          │
│──────────────────────│
│ id (PK, cuid)        │
│ email (unique)       │
│ passwordHash?        │
│ fullName             │
│ avatarUrl?           │
│ bio?                 │
│ role (enum)          │
│ status (enum)        │
│ provider (enum)      │
│ providerId?          │
│ verificationToken?   │
│ resetToken?          │
│ followerCount        │
│ followingCount       │
│ notifPreferences?    │
│ createdAt            │
│ updatedAt            │
│ deletedAt?           │
└──────┬───────────────┘
       │
       │ 1:N
       ├────────────────► RefreshToken (token, expiresAt)
       │
       │ 1:1
       ├────────────────► InstructorProfile (expertise[], experience, qualifications)
       │
       │ 1:N
       └────────────────► InstructorApplication (status, cvUrl, certificateUrls)
                              │
                              │ N:1 (reviewedBy)
                              └──── User (Admin)
```

### 2.2 Module 2: Course Structure

```
                         ┌─────────────────┐
                         │    Category      │
                         │─────────────────│
                         │ id, name, slug   │
                         │ parentId? ──┐    │  ← Self-referencing (subcategory)
                         │             │    │
                         └──────┬──────┘────┘
                                │ 1:N
                                ▼
┌──────────┐    N:N    ┌─────────────────────────┐
│   Tag    │◄─────────►│        Course           │
│──────────│  CourseTag │─────────────────────────│
│ id, name │           │ id, title, slug          │
│ slug     │           │ instructorId → User      │
│ courseCount│          │ categoryId → Category    │
└──────────┘           │ level, language, price   │
                       │ status (enum)            │
                       │ totalStudents, avgRating │
                       │ viewCount, totalDuration │
                       └──────────┬───────────────┘
                                  │ 1:N
                                  ▼
                       ┌──────────────────┐
                       │    Section       │
                       │──────────────────│
                       │ id, title, order │
                       └──────┬───────────┘
                              │ 1:N
                              ▼
                       ┌──────────────────────────┐
                       │      Chapter              │
                       │──────────────────────────│
                       │ id, title, price, order   │
                       │ isFreePreview             │
                       │ lessonsCount, totalDuration│
                       └──────┬────────────────────┘
                              │ 1:N
                              ▼
                       ┌──────────────────────────┐
                       │       Lesson              │
                       │──────────────────────────│
                       │ id, title, type, order    │
                       │ textContent?              │
                       │ estimatedDuration?        │
                       └──┬──────┬──────┬──────────┘
                          │      │      │
                    1:N   │  1:N │  1:1 │
                     ▼    │   ▼  │   ▼
                   Media  │ LessonAttachment  Quiz
                          │                     │
                          │                 1:N │
                          │                  ▼  │
                          │            QuizQuestion
                          │                  │
                          │              1:N │
                          │               ▼  │
                          │            QuizOption

User (Instructor) ──1:N──► QuestionBank ──1:N──► QuestionBankItem ──1:N──► QuestionBankOption
                                │
                                └──1:N──► QuestionBankTag
```

### 2.3 Module 3: Ecommerce

```
User ──1:N──► CartItem ──N:1──► Course/Chapter

User ──1:N──► Order ──1:N──► OrderItem ──N:1──► Course/Chapter
                │                  │
                │ 1:1              │ 1:1
                ▼                  ▼
            CouponUsage         Earning ──N:1──► User (Instructor)
                │
                │ N:1
                ▼
              Coupon ──N:N──► Course (via CouponCourse)

User ──1:N──► Enrollment ──N:1──► Course
                (FULL / PARTIAL)

User ──1:N──► ChapterPurchase ──N:1──► Chapter

User ──1:N──► Review ──N:1──► Course
User ──1:N──► Wishlist ──N:1──► Course

User (Instructor) ──1:N──► Withdrawal
                               │ N:1 (reviewedBy)
                               └──── User (Admin)
```

**Order Flow:**

```
CartItem[] → Order (PENDING) → SePay QR → Webhook → Order (COMPLETED)
                                                        │
                                                        ├──► Enrollment (FULL/PARTIAL)
                                                        ├──► ChapterPurchase[] (nếu mua lẻ)
                                                        ├──► Earning (instructor's share)
                                                        └──► Notification
```

### 2.4 Module 4: Learning

```
User + Lesson → LessonProgress
                │  userId + lessonId (composite PK)
                │  lastPosition (resume video)
                │  watchedSegments (JSONB: [[0,240],[480,960]])
                │  watchedPercent (0.0 - 1.0)
                │  isCompleted (true khi >= 80%)
                │
                │  ↓ Tính toán
                │
                ▼
User + Course → Enrollment.progress
                │  = completedLessons / accessibleLessons
                │
                │  100% complete?
                ▼
              Certificate (auto-generate PDF)

User ──1:N──► QuizAttempt ──1:N──► QuizAnswer
                  │
                  └──N:1──► Quiz

User ──1:N──► DailyActivity (streak tracking)
User ──1:N──► UserSkill (skills map)
User ──1:N──► PlacementTest → PlacementQuestion (pool)
```

### 2.5 Module 5: Social

```
User ──1:N──► Post ──1:N──► PostImage
                │
                ├──1:N──► Like      (@@unique userId+postId)
                ├──1:N──► Comment   (self-ref: parentId → nested)
                ├──1:N──► Bookmark  (@@unique userId+postId)
                ├──1:N──► FeedItem  (fanout on write)
                │
                └──► Post? (sharedPostId — shared post reference)

User ◄──N:N──► User (Follow: followerId ↔ followingId)

User ──N:N──► Conversation (via ConversationMember)
                │
                └──1:N──► Message (text, image, code, file)

User ──1:N──► Group ──1:N──► GroupMember
                │              (role: OWNER/ADMIN/MEMBER)
                │
                ├──1:N──► GroupJoinRequest (PENDING/APPROVED/REJECTED)
                ├──1:N──► Post (groupId)
                │
                └──1:1──► Course? (auto-created group)
```

**Fanout on Write:**

```
User B tạo Post
    │
    ▼
INSERT posts → Lấy followers của B: [A, C, D]
    │
    ▼
INSERT feed_items: (userId=A, postId), (userId=C, postId), (userId=D, postId)
    │
    ▼
User A load feed → SELECT FROM feed_items WHERE userId=A ORDER BY createdAt DESC
    → JOIN posts → Fast! (indexed)
```

### 2.6 Module 6: Q&A Forum

```
User ──1:N──► Question ──1:N──► Answer ──1:N──► Vote (+1/-1)
                │                  │
                │ bestAnswerId     │ authorId → User
                └──────1:1────────►│
                                   │
                                   └── bestForQuestion?
```

### 2.7 Modules 7-10: Notifications, AI, Admin, Recommendation

```
MODULE 7 — NOTIFICATIONS:
  User ──1:N──► Notification (type, data JSON, isRead)

MODULE 8 — AI:
  User + Course ──► AiChatSession ──1:N──► AiChatMessage
  Course + Lesson ──► CourseChunk (content + embedding vector(384))

MODULE 9 — ADMIN:
  User ──1:N──► Report (targetType + targetId — polymorphic)
  CommissionTier (minRevenue → rate)
  PlatformSetting (key → value JSON)
  AnalyticsSnapshot (date + type → data JSON)

MODULE 10 — RECOMMENDATION:
  Course ──N:N──► Course (via CourseSimilarity)
    score, algorithm (CONTENT/COLLABORATIVE/HYBRID)
    Pre-computed by nightly cron
```

---

## 3. ENTITY SUMMARY TABLE

### Module 1: Auth & Users (4 entities)

| #   | Entity                | Mô tả                                 | Records ước tính |
| --- | --------------------- | ------------------------------------- | ---------------- |
| 1   | User                  | Người dùng (Student/Instructor/Admin) | ~10,000          |
| 2   | RefreshToken          | JWT refresh token (7 ngày TTL)        | ~5,000           |
| 3   | InstructorProfile     | Hồ sơ instructor (1-1 User)           | ~200             |
| 4   | InstructorApplication | Đơn đăng ký instructor                | ~500             |

### Module 2: Course Structure (16 entities)

| #   | Entity             | Mô tả                               | Records ước tính |
| --- | ------------------ | ----------------------------------- | ---------------- |
| 5   | Category           | Danh mục (có subcategory)           | ~50              |
| 6   | Tag                | Tags cho recommendation             | ~200             |
| 7   | Course             | Khóa học                            | ~1,000           |
| 8   | CourseTag          | Course ↔ Tag junction               | ~5,000           |
| 9   | Section            | Nhóm chapters                       | ~3,000           |
| 10  | Chapter            | Chương (đơn vị mua lẻ)              | ~10,000          |
| 11  | Lesson             | Bài học (video/text/quiz)           | ~50,000          |
| 12  | Media              | Video/image upload tracking         | ~30,000          |
| 13  | LessonAttachment   | Tài liệu đính kèm                   | ~5,000           |
| 14  | Quiz               | Quiz gắn với lesson                 | ~5,000           |
| 15  | QuizQuestion       | Câu hỏi quiz                        | ~25,000          |
| 16  | QuizOption         | Lựa chọn trả lời                    | ~100,000         |
| 17  | QuestionBank       | Pool câu hỏi tái sử dụng (instructor) | ~500          |
| 18  | QuestionBankTag    | Tag phân loại trong bank            | ~2,000           |
| 19  | QuestionBankItem   | Câu hỏi trong bank                  | ~10,000          |
| 20  | QuestionBankOption | Lựa chọn trả lời bank              | ~40,000          |

### Module 3: Ecommerce (12 entities)

| #   | Entity          | Mô tả                    | Records ước tính |
| --- | --------------- | ------------------------ | ---------------- |
| 21  | CartItem        | Giỏ hàng                 | ~2,000           |
| 22  | Order           | Đơn hàng                 | ~20,000          |
| 23  | OrderItem       | Chi tiết đơn hàng        | ~25,000          |
| 24  | Enrollment      | Đăng ký học              | ~30,000          |
| 25  | ChapterPurchase | Mua lẻ chapter           | ~10,000          |
| 26  | Coupon          | Mã giảm giá              | ~500             |
| 27  | CouponCourse    | Coupon ↔ Course junction | ~2,000           |
| 28  | CouponUsage     | Tracking sử dụng coupon  | ~5,000           |
| 29  | Review          | Đánh giá khóa học        | ~15,000          |
| 30  | Wishlist        | Danh sách yêu thích      | ~10,000          |
| 31  | Earning         | Thu nhập instructor      | ~25,000          |
| 32  | Withdrawal      | Yêu cầu rút tiền         | ~1,000           |

### Module 4: Learning (8 entities)

| #   | Entity            | Mô tả                        | Records ước tính |
| --- | ----------------- | ---------------------------- | ---------------- |
| 33  | LessonProgress    | Tiến trình bài học           | ~200,000         |
| 34  | QuizAttempt       | Lần làm quiz                 | ~50,000          |
| 35  | QuizAnswer        | Câu trả lời quiz             | ~250,000         |
| 36  | Certificate       | Chứng chỉ                    | ~5,000           |
| 37  | DailyActivity     | Hoạt động hàng ngày (streak) | ~100,000         |
| 38  | UserSkill         | Skills map                   | ~20,000          |
| 39  | PlacementQuestion | Pool câu hỏi placement       | ~500             |
| 40  | PlacementTest     | Kết quả placement test       | ~5,000           |

### Module 5: Social (13 entities)

| #   | Entity             | Mô tả                          | Records ước tính |
| --- | ------------------ | ------------------------------ | ---------------- |
| 41  | Post               | Bài đăng                       | ~50,000          |
| 42  | PostImage          | Hình ảnh trong post            | ~20,000          |
| 43  | Like               | Lượt thích                     | ~200,000         |
| 44  | Comment            | Bình luận (nested)             | ~100,000         |
| 45  | Bookmark           | Lưu post                       | ~30,000          |
| 46  | Follow             | Quan hệ follow                 | ~50,000          |
| 47  | Conversation       | Cuộc hội thoại                 | ~10,000          |
| 48  | ConversationMember | Thành viên hội thoại           | ~25,000          |
| 49  | Message            | Tin nhắn chat                  | ~200,000         |
| 50  | Group              | Nhóm học tập                   | ~2,000           |
| 51  | GroupMember        | Thành viên nhóm                | ~30,000          |
| 52  | GroupJoinRequest   | Yêu cầu tham gia nhóm private | ~5,000           |
| 53  | FeedItem           | Pre-computed feed              | ~500,000         |

### Module 6: Q&A Forum (3 entities)

| #   | Entity   | Mô tả           | Records ước tính |
| --- | -------- | --------------- | ---------------- |
| 54  | Question | Câu hỏi         | ~10,000          |
| 55  | Answer   | Câu trả lời     | ~30,000          |
| 56  | Vote     | Upvote/downvote | ~50,000          |

### Module 7-10: Notifications, AI, Admin, Recommendation (9 entities)

| #   | Entity            | Mô tả                       | Records ước tính |
| --- | ----------------- | --------------------------- | ---------------- |
| 57  | Notification      | Thông báo                   | ~500,000         |
| 58  | AiChatSession     | AI tutor session            | ~10,000          |
| 59  | AiChatMessage     | AI chat message             | ~50,000          |
| 60  | CourseChunk       | RAG text chunks + embedding | ~100,000         |
| 61  | Report            | Báo cáo vi phạm             | ~1,000           |
| 62  | CommissionTier    | Cấu hình hoa hồng           | ~5               |
| 63  | PlatformSetting   | Cấu hình hệ thống           | ~20              |
| 64  | AnalyticsSnapshot | Thống kê pre-computed       | ~1,000           |
| 65  | CourseSimilarity  | Similarity matrix           | ~50,000          |

**Tổng: 65 models** (kể cả junction tables CourseTag, CouponCourse, Follow, DailyActivity dùng composite PK)

---

## 4. INDEX STRATEGY

### 4.1 Primary & Unique Indexes (tự động bởi Prisma)

```
Mỗi @id → PRIMARY KEY index
Mỗi @unique → UNIQUE index
Mỗi @@id → Composite PRIMARY KEY
Mỗi @@unique → Composite UNIQUE index
```

### 4.2 Foreign Key Indexes

```
Prisma KHÔNG tự tạo index cho foreign keys (khác MySQL).
→ Phải thêm @@index() thủ công cho mọi FK thường xuyên query.

Đã thêm cho tất cả FK quan trọng (xem schema.prisma).
```

### 4.3 Composite & Specialized Indexes

| Table           | Index                           | Lý do                                              |
| --------------- | ------------------------------- | -------------------------------------------------- |
| `feed_items`    | `(userId, createdAt DESC)`      | Feed query: WHERE userId=X ORDER BY createdAt DESC |
| `notifications` | `(recipientId, isRead)`         | Unread count badge                                 |
| `notifications` | `(recipientId, createdAt DESC)` | Notification list                                  |
| `messages`      | `(conversationId, createdAt)`   | Chat history                                       |
| `courses`       | `(status)`                      | Filter by status                                   |
| `courses`       | `(avgRating)`                   | Sort by rating                                     |
| `courses`       | `(price)`                       | Filter/sort by price                               |
| `courses`       | `(publishedAt)`                 | Sort by newest                                     |
| `reports`       | `(targetType, targetId)`        | Find reports for entity                            |
| `quiz_attempts` | `(userId, quizId)`              | Check attempts count                               |

### 4.4 Full-Text Search Index (Raw SQL)

```sql
-- GIN index cho course search
-- Xem chi tiết trong migration: 00-search-vector.sql
ALTER TABLE courses ADD COLUMN search_vector tsvector;
CREATE INDEX idx_courses_search ON courses USING GIN(search_vector);
```

### 4.5 Vector Index (pgvector)

```sql
-- IVFFlat index cho RAG embedding search
-- Xem chi tiết trong migration: 01-pgvector.sql
CREATE INDEX idx_course_chunks_embedding ON course_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

## 5. RAW SQL MIGRATIONS

> Prisma không hỗ trợ trực tiếp tsvector và pgvector columns.
> Cần thêm raw SQL migrations sau khi chạy `prisma migrate`.

### 5.1 Full-Text Search (tsvector)

```sql
-- File: prisma/migrations/00-search-vector.sql

-- Thêm search_vector column
ALTER TABLE courses ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Tạo GIN index
CREATE INDEX IF NOT EXISTS idx_courses_search
  ON courses USING GIN(search_vector);

-- Function update search vector
CREATE OR REPLACE FUNCTION update_course_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW."shortDescription", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: auto-update khi INSERT/UPDATE course
CREATE TRIGGER trg_courses_search_vector
  BEFORE INSERT OR UPDATE OF title, "shortDescription", description
  ON courses
  FOR EACH ROW
  EXECUTE FUNCTION update_course_search_vector();

-- Backfill existing data
UPDATE courses SET search_vector =
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce("shortDescription", '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(description, '')), 'C');
```

### 5.2 pgvector Extension & Embedding Column

```sql
-- File: prisma/migrations/01-pgvector.sql

-- Enable pgvector extension (Neon.tech đã hỗ trợ sẵn)
CREATE EXTENSION IF NOT EXISTS vector;

-- Thêm embedding column (384 dimensions — all-MiniLM-L6-v2)
ALTER TABLE course_chunks ADD COLUMN IF NOT EXISTS embedding vector(384);

-- IVFFlat index cho cosine similarity search
-- lists = sqrt(N) → ~316 nếu 100K chunks, dùng 100 cho safety
CREATE INDEX IF NOT EXISTS idx_course_chunks_embedding
  ON course_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Query mẫu: Tìm 5 chunks gần nhất với query embedding
-- SELECT id, content, 1 - (embedding <=> $1::vector) AS similarity
-- FROM course_chunks
-- WHERE "courseId" = $2
-- ORDER BY embedding <=> $1::vector
-- LIMIT 5;
```

### 5.3 Auto-Expire Orders (Cron hoặc pg_cron)

```sql
-- File: prisma/migrations/02-order-expiry.sql

-- Function: expire pending orders sau 15 phút
CREATE OR REPLACE FUNCTION expire_pending_orders()
RETURNS void AS $$
BEGIN
  UPDATE orders
  SET status = 'EXPIRED', "updatedAt" = now()
  WHERE status = 'PENDING'
    AND "expiresAt" < now();
END;
$$ LANGUAGE plpgsql;

-- Gọi bằng @nestjs/schedule cron mỗi phút:
-- await this.prisma.$executeRaw`SELECT expire_pending_orders();`
```

### 5.4 Cleanup Cron Jobs

```sql
-- Chạy bằng @nestjs/schedule

-- 1. Cleanup expired refresh tokens (daily)
DELETE FROM refresh_tokens WHERE "expiresAt" < now();

-- 2. Cleanup old feed items (keep max 1000/user)
DELETE FROM feed_items
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY "userId" ORDER BY "createdAt" DESC
    ) as rn
    FROM feed_items
  ) ranked
  WHERE rn > 1000
);

-- 3. Cleanup unfinished uploads (24h)
UPDATE media SET status = 'FAILED'
WHERE status = 'UPLOADING'
  AND "createdAt" < now() - INTERVAL '24 hours';
```

---

## 6. STORAGE ESTIMATION (Neon Free: 0.5GB)

```
Ước tính sử dụng storage cho 1,000 users, 100 courses:

Core tables (users, courses, sections, chapters, lessons):    ~20MB
Quiz data (questions, options):                                 ~10MB
Ecommerce (orders, enrollments, earnings):                      ~15MB
Social (posts, comments, likes, follows):                       ~30MB
Messages:                                                       ~20MB
Feed items:                                                     ~25MB
Lesson progress:                                                ~15MB
Notifications:                                                  ~20MB
Course chunks + embeddings (vector 384 × 100K):                ~200MB
Course similarity matrix:                                       ~10MB
Indexes:                                                        ~80MB
Other:                                                          ~20MB
────────────────────────────────────────────────────────────────
TOTAL:                                                         ~465MB

→ Vừa đủ 0.5GB limit cho demo thesis!
→ Nếu cần thêm: upgrade Neon ($19/mo) hoặc giảm embedding chunks
```

---

## 7. SEEDING PLAN

### Admin Account (always present)

```javascript
// prisma/seed.ts
const admin = await prisma.user.create({
  data: {
    email: 'admin@ssml.com',
    passwordHash: await bcrypt.hash('Admin@123', 12),
    fullName: 'System Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    provider: 'LOCAL',
  },
});
```

### Categories (initial)

```javascript
const categories = [
  { name: 'Web Development', slug: 'web-development' },
  { name: 'Mobile Development', slug: 'mobile-development' },
  { name: 'Data Science', slug: 'data-science' },
  { name: 'DevOps & Cloud', slug: 'devops-cloud' },
  { name: 'Programming Languages', slug: 'programming-languages' },
  { name: 'Database', slug: 'database' },
  { name: 'UI/UX Design', slug: 'ui-ux-design' },
  { name: 'Cybersecurity', slug: 'cybersecurity' },
];
```

### Tags (initial)

```javascript
const tags = [
  'JavaScript',
  'TypeScript',
  'React',
  'Next.js',
  'Vue.js',
  'Angular',
  'Node.js',
  'NestJS',
  'Express',
  'Python',
  'Django',
  'FastAPI',
  'Java',
  'Spring Boot',
  'Go',
  'Rust',
  'C#',
  '.NET',
  'SQL',
  'PostgreSQL',
  'MongoDB',
  'Redis',
  'GraphQL',
  'REST API',
  'Docker',
  'Kubernetes',
  'AWS',
  'Git',
  'CI/CD',
  'Linux',
  'HTML',
  'CSS',
  'Tailwind',
  'Sass',
  'Figma',
  'React Native',
  'Flutter',
  'Swift',
  'Kotlin',
  'Machine Learning',
  'Deep Learning',
  'NLP',
  'Computer Vision',
];
```

### Commission Tiers

```javascript
const tiers = [
  { minRevenue: 0, rate: 0.3 }, // Mới: 30%
  { minRevenue: 10000000, rate: 0.25 }, // > 10M: 25%
  { minRevenue: 50000000, rate: 0.2 }, // > 50M: 20%
];
```

### Platform Settings

```javascript
const settings = [
  { key: 'min_withdrawal_amount', value: 200000 },
  { key: 'order_expiry_minutes', value: 15 },
  { key: 'refund_period_days', value: 7 },
  { key: 'refund_max_progress', value: 0.1 },
  { key: 'ai_daily_limit', value: 10 },
  { key: 'review_min_progress', value: 0.3 },
  { key: 'lesson_complete_threshold', value: 0.8 },
];
```

---

## 8. PRISMA SCHEMA FILE

> Schema đầy đủ: [`prisma/schema.prisma`](../../prisma/schema.prisma)
>
> **65 models** | **26 enums** | Comments chi tiết bằng tiếng Việt

---

## 9. MIGRATION WORKFLOW

```bash
# 1. Tạo database (Neon.tech dashboard → Create Project)
# 2. Copy connection string → .env
DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"

# 3. Generate Prisma client
npx prisma generate

# 4. Tạo migration
npx prisma migrate dev --name init

# 5. Chạy raw SQL migrations (sau Prisma migrate)
npx prisma db execute --file prisma/migrations/00-search-vector.sql
npx prisma db execute --file prisma/migrations/01-pgvector.sql

# 6. Seed data
npx prisma db seed

# 7. Kiểm tra với Prisma Studio
npx prisma studio
```
