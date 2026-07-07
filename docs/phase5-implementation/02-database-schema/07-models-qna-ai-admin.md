# 07 — Module 6-10: Q&A, Notifications, AI, Admin, Recommendation (12 Models)

> Giải thích các modules còn lại: diễn đàn hỏi đáp, thông báo, AI tutor, quản trị, và gợi ý.

---

## PART A: MODULE 6 — Q&A FORUM (3 Models)

---

## 1. QUESTION — Câu hỏi

```prisma
model Question {
  id           String  @id @default(cuid())
  title        String
  content      String
  codeSnippet  Json?   @map("code_snippet")
  authorId     String  @map("author_id")
  courseId     String? @map("course_id")      // Hỏi về khóa học cụ thể
  tagId        String? @map("tag_id")         // Chủ đề
  bestAnswerId String? @unique @map("best_answer_id")  // Câu trả lời hay nhất

  viewCount   Int @default(0) @map("view_count")
  answerCount Int @default(0) @map("answer_count")

  bestAnswer Answer?  @relation("best_answer", fields: [bestAnswerId], references: [id])
  answers    Answer[] @relation("question_answers")
}
```

### 1.1 Thiết kế giống Stack Overflow

```
Question: "Làm sao handle authentication trong NestJS?"
├── Tags: NestJS
├── Course: "NestJS Complete Guide" (optional)
├── viewCount: 156
├── answerCount: 3
│
├── Answer 1 (voteCount: 5) ⭐ Best Answer
├── Answer 2 (voteCount: 2)
└── Answer 3 (voteCount: -1)
```

### 1.2 `bestAnswerId @unique` — One-to-one optional

```prisma
bestAnswerId String? @unique
```

- `@unique`: Mỗi Answer chỉ là best answer của **tối đa 1** Question
- `String?`: Question có thể chưa có best answer

Author của Question có thể chọn 1 answer làm "best answer" — giống StackOverflow accepted answer.

### 1.3 Dual relations trên Answer

```prisma
// Trong Question:
bestAnswer Answer?  @relation("best_answer", ...)     // 1:1 optional
answers    Answer[] @relation("question_answers")      // 1:N

// Trong Answer:
question        Question  @relation("question_answers", ...) // Belongs to question
bestForQuestion Question? @relation("best_answer")           // Is best answer of question
```

Cần 2 named relations vì Answer liên kết với Question theo 2 cách khác nhau.

---

## 2. ANSWER & VOTE — Câu trả lời và bình chọn

### 2.1 Answer

```prisma
model Answer {
  id          String @id @default(cuid())
  content     String
  codeSnippet Json?
  authorId    String @map("author_id")
  questionId  String @map("question_id")
  voteCount   Int    @default(0)    // Upvotes - Downvotes

  @@index([voteCount(sort: Desc)])   // Sắp xếp theo votes
}
```

### 2.2 Vote — Upvote/Downvote

```prisma
model Vote {
  id       String @id @default(cuid())
  userId   String @map("user_id")
  answerId String @map("answer_id")
  value    Int    // +1 (upvote) hoặc -1 (downvote)

  @@unique([userId, answerId])   // 1 user chỉ vote 1 lần per answer
}
```

**Flow:**

```
User upvote answer:
├── Tạo Vote: value = +1
├── answer.voteCount += 1
└── Nếu đã downvote trước đó: xóa vote cũ (-1), tạo mới (+1) → voteCount += 2

User remove vote:
├── Xóa Vote record
└── answer.voteCount -= value
```

### 2.3 `@@index([voteCount(sort: Desc)])` — Sorted index

```prisma
@@index([voteCount(sort: Desc)])
```

Hiển thị answers **nhiều votes nhất lên đầu** — mặc định sort order trong Q&A.

---

## PART B: MODULE 7 — NOTIFICATIONS (1 Model)

---

## 3. NOTIFICATION

```prisma
model Notification {
  id          String           @id @default(cuid())
  recipientId String           @map("recipient_id")
  type        NotificationType              // 14 loại notification
  data        Json                          // Data khác nhau tùy type
  isRead      Boolean          @default(false)

  @@index([recipientId, isRead])              // Đếm unread nhanh
  @@index([recipientId, createdAt(sort: Desc)])  // Load notifications mới nhất
}
```

### 3.1 `data` field — Flexible data theo type

Mỗi type notification cần data khác nhau:

```json
// type = FOLLOW
{
  "followerId": "user_xxx",
  "followerName": "Nguyễn Văn A",
  "followerAvatar": "https://..."
}

// type = COURSE_ENROLLED
{
  "courseId": "course_xxx",
  "courseTitle": "NestJS Guide",
  "studentName": "Trần Thị B"
}

// type = ORDER_COMPLETED
{
  "orderId": "order_xxx",
  "amount": 499000
}
```

Dùng `Json` vì tạo model riêng cho 14 types sẽ quá phức tạp.

### 3.2 Real-time notifications

Notification được tạo trong DB **và** push qua **Socket.io** cùng lúc:

```
Backend tạo notification:
├── INSERT INTO notifications → persistent storage
└── Socket.io emit to recipient → real-time bell icon update
```

### 3.3 Indexes

```prisma
@@index([recipientId, isRead])              // WHERE recipientId = ? AND isRead = false
@@index([recipientId, createdAt(sort: Desc)])  // ORDER BY createdAt DESC
```

2 queries phổ biến:

- Đếm unread: `COUNT(*) WHERE recipientId = ? AND isRead = false`
- Load notifications: `WHERE recipientId = ? ORDER BY createdAt DESC LIMIT 20`

---

## PART C: MODULE 8 — AI (3 Models)

---

## 4. AICHATSESSION & AICHATMESSAGE

### 4.1 AiChatSession

```prisma
model AiChatSession {
  id       String  @id @default(cuid())
  userId   String  @map("user_id")
  courseId String  @map("course_id")     // Mỗi session thuộc 1 khóa học
  title    String?                       // Tự động tạo từ câu hỏi đầu tiên

  messages AiChatMessage[]
}
```

**Tại sao mỗi session gắn với 1 course?**

AI Tutor sử dụng **RAG** — trả lời dựa trên nội dung khóa học cụ thể. Gắn `courseId` để:

- Tìm kiếm chunks chỉ trong course đó
- Giới hạn context → câu trả lời chính xác hơn
- Student có thể có nhiều sessions cho nhiều courses

### 4.2 AiChatMessage

```prisma
model AiChatMessage {
  id        String        @id @default(cuid())
  sessionId String        @map("session_id")
  role      AiMessageRole              // USER hoặc ASSISTANT
  content   String                     // Nội dung tin nhắn

  @@index([sessionId])
}
```

Lưu lại **toàn bộ lịch sử chat** giữa student và AI. `role` phân biệt tin nhắn của student vs AI.

---

## 5. COURSECHUNK — Nội dung cho RAG

```prisma
model CourseChunk {
  id       String  @id @default(cuid())
  courseId String  @map("course_id")
  lessonId String? @map("lesson_id")
  content  String                    // Text content của chunk
  // embedding vector(384) — thêm qua raw SQL

  @@index([courseId])
  @@index([lessonId])
}
```

### 5.1 Chunking process

Khi instructor publish khóa học:

```
Course content (video transcripts, text lessons)
        │
        ▼
┌──────────────────┐
│  Text Splitter   │  Chia thành chunks ~500 tokens
│  (overlapping)   │  mỗi chunk overlap 50 tokens với chunk trước
└──────────────────┘
        │
        ▼
┌──────────────────┐
│  Embedding Model │  all-MiniLM-L6-v2 (Transformers.js)
│  vector(384)     │  Mỗi chunk → 384-dimension vector
└──────────────────┘
        │
        ▼
┌──────────────────┐
│  course_chunks   │  INSERT content + embedding
│  table           │
└──────────────────┘
```

### 5.2 `embedding` column

Cột `embedding` **không khai báo trong Prisma** vì Prisma chưa hỗ trợ kiểu `vector`. Thêm qua raw SQL:

```sql
ALTER TABLE course_chunks ADD COLUMN embedding vector(384);
```

Query embedding phải dùng **raw SQL** trong Prisma:

```typescript
const chunks = await prisma.$queryRaw`
  SELECT id, content, 1 - (embedding <=> ${questionVector}::vector) AS similarity
  FROM course_chunks
  WHERE course_id = ${courseId}
  ORDER BY embedding <=> ${questionVector}::vector
  LIMIT 5
`;
```

---

## PART D: MODULE 9 — ADMIN (4 Models)

---

## 6. REPORT — Báo cáo vi phạm

```prisma
model Report {
  id           String           @id @default(cuid())
  reporterId   String           @map("reporter_id")
  targetType   ReportTargetType @map("target_type")   // USER, COURSE, POST, ...
  targetId     String           @map("target_id")     // ID của đối tượng bị report
  reason       String                                  // Lý do
  description  String?                                 // Chi tiết
  status       ReportStatus     @default(PENDING)
  reviewedById String?
  reviewNote   String?
  reviewedAt   DateTime?

  @@index([targetType, targetId])    // Tìm reports theo đối tượng
  @@index([status])                  // Filter theo status
}
```

### 6.1 Polymorphic association — `targetType` + `targetId`

```
Report 1: targetType = POST, targetId = "post_abc"     → Báo cáo bài viết
Report 2: targetType = USER, targetId = "user_xyz"     → Báo cáo người dùng
Report 3: targetType = COURSE, targetId = "course_123" → Báo cáo khóa học
```

**Tại sao không dùng nhiều foreign keys?**

```prisma
// ❌ Phức tạp — 7 optional foreign keys
reportedUserId    String?
reportedCourseId  String?
reportedPostId    String?
reportedCommentId String?
// ... 7 fields, chỉ 1 có giá trị

// ✅ Đơn giản — 2 fields
targetType ReportTargetType   // Enum: USER, COURSE, POST, ...
targetId   String              // ID đa hình
```

Trade-off: Mất foreign key constraint ở DB level → cần validate ở application level.

---

## 7. COMMISSIONTIER — Bậc hoa hồng

```prisma
model CommissionTier {
  id         String @id @default(cuid())
  minRevenue Float  @map("min_revenue")   // Ngưỡng doanh thu
  rate       Float                        // Tỷ lệ hoa hồng

  @@map("commission_tiers")
}
```

Admin cấu hình:

```
Tier 1: minRevenue = 0,         rate = 0.30  (30%)
Tier 2: minRevenue = 10,000,000, rate = 0.25  (25%)
Tier 3: minRevenue = 50,000,000, rate = 0.20  (20%)
```

Khi tính earning cho instructor → lookup tier dựa trên **tổng doanh thu tích lũy**.

---

## 8. PLATFORMSETTING — Cài đặt hệ thống

```prisma
model PlatformSetting {
  id    String @id @default(cuid())
  key   String @unique
  value Json

  @@map("platform_settings")
}
```

Key-value store cho settings toàn hệ thống:

| Key                         | Value  | Mục đích                     |
| --------------------------- | ------ | ---------------------------- |
| `min_withdrawal_amount`     | 200000 | Rút tiền tối thiểu 200,000đ  |
| `order_expiry_minutes`      | 15     | Đơn hàng hết hạn sau 15 phút |
| `refund_period_days`        | 7      | Hoàn tiền trong 7 ngày       |
| `refund_max_progress`       | 0.10   | Hoàn tiền nếu tiến độ < 10%  |
| `ai_daily_limit`            | 10     | Tối đa 10 câu hỏi AI/ngày    |
| `review_min_progress`       | 0.30   | Cần học 30% mới được review  |
| `lesson_complete_threshold` | 0.80   | Xem 80% video = hoàn thành   |

**Tại sao dùng DB thay vì .env?**

Settings có thể thay đổi runtime bởi admin mà **không cần redeploy**. `.env` chỉ đọc khi start server.

---

## 9. ANALYTICSSNAPSHOT — Thống kê tổng hợp

```prisma
model AnalyticsSnapshot {
  id   String        @id @default(cuid())
  date DateTime      @db.Date
  type AnalyticsType              // DAILY_USERS, DAILY_REVENUE, ...
  data Json                       // Data tùy type

  @@unique([date, type])
}
```

**Cron job** chạy hàng ngày lúc 00:00 → tổng hợp data → lưu snapshot:

```json
// type = DAILY_USERS, date = 2024-06-15
{
  "totalUsers": 1520,
  "newUsers": 12,
  "activeUsers": 340
}

// type = DAILY_REVENUE, date = 2024-06-15
{
  "totalRevenue": 5490000,
  "orderCount": 15,
  "avgOrderValue": 366000
}
```

Dùng để vẽ **dashboard charts** cho admin mà không cần query aggregation nặng.

---

## PART E: MODULE 10 — RECOMMENDATION (1 Model)

---

## 10. COURSESIMILARITY — Gợi ý khóa học

```prisma
model CourseSimilarity {
  id              String              @id @default(cuid())
  courseId        String              @map("course_id")
  similarCourseId String              @map("similar_course_id")
  score           Float                          // 0.0 → 1.0
  algorithm       SimilarityAlgorithm            // CONTENT | COLLABORATIVE | HYBRID

  @@unique([courseId, similarCourseId, algorithm])
  @@index([courseId, score(sort: Desc)])
}
```

### 10.1 Ba thuật toán gợi ý

| Algorithm         | Dựa trên                      | Công thức                           |
| ----------------- | ----------------------------- | ----------------------------------- |
| **CONTENT**       | Tags, categories, description | Cosine similarity giữa tag vectors  |
| **COLLABORATIVE** | Hành vi users                 | Jaccard similarity giữa enrollments |
| **HYBRID**        | Kết hợp cả 2                  | Wilson Score Interval               |

### 10.2 Pre-computed scores

Scores được **tính trước** bởi cron job (hàng đêm) → lưu vào bảng → query nhanh khi hiển thị:

```sql
-- "Khóa học tương tự" trên course detail page
SELECT sc.similar_course_id, c.title, sc.score
FROM course_similarities sc
JOIN courses c ON c.id = sc.similar_course_id
WHERE sc.course_id = 'xxx' AND sc.algorithm = 'HYBRID'
ORDER BY sc.score DESC
LIMIT 6;
```

### 10.3 Composite unique constraint

```prisma
@@unique([courseId, similarCourseId, algorithm])
```

Mỗi cặp course chỉ có **1 score per algorithm**. Cron job `upsert` để cập nhật scores.
