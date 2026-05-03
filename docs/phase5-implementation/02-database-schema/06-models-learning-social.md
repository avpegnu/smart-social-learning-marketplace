# 06 — Module 4-5: Learning & Social (20 Models)

> Giải thích hệ thống tracking tiến độ học, quiz, certificates, và mạng xã hội (posts, chat, groups, feed).

---

## PART A: MODULE 4 — LEARNING (8 Models)

---

## 1. LESSONPROGRESS — Theo dõi tiến độ học

```prisma
model LessonProgress {
  userId          String  @map("user_id")
  lessonId        String  @map("lesson_id")
  lastPosition    Int     @default(0)         // Giây — vị trí cuối cùng xem video
  watchedSegments Json?   @map("watched_segments")  // Các đoạn đã xem
  watchedPercent  Float   @default(0)         // 0.0 → 1.0
  isCompleted     Boolean @default(false)

  @@id([userId, lessonId])     // Composite PK — mỗi user-lesson 1 record
}
```

### 1.1 Composite Primary Key

```prisma
@@id([userId, lessonId])
```

Thay vì tạo `id` CUID riêng, dùng cặp (userId, lessonId) làm PK. Đảm bảo:

- 1 user chỉ có 1 progress record per lesson
- Query nhanh: `WHERE userId = ? AND lessonId = ?`

### 1.2 `watchedSegments` — Segment merging

Lưu **các đoạn video đã xem** dạng JSON array:

```json
// Student xem video 10 phút:
// Lần 1: xem 0:00 → 3:00
// Lần 2: xem 2:00 → 5:00
// Lần 3: xem 7:00 → 9:00

// watchedSegments sau merge:
[
  [0, 180],
  [420, 540]
]
// Đoạn 1: giây 0 → 180 (0:00 → 3:00, merged lần 1+2)
// Đoạn 2: giây 420 → 540 (7:00 → 9:00)
// Chưa xem: 3:00 → 7:00 và 9:00 → 10:00
```

**Tại sao cần segment tracking?**

Tránh gian lận: student tua nhanh đến cuối video → `watchedPercent` chỉ tính phần **thực sự xem**.

### 1.3 `isCompleted` — Lesson hoàn thành

```
isCompleted = true khi:
├── VIDEO: watchedPercent ≥ 0.80 (80% — platform setting)
├── TEXT: Đánh dấu đã đọc (manual)
└── QUIZ: Đạt passingScore trong QuizAttempt
```

### 1.4 Tính `progress` của Enrollment

```
enrollment.progress = COUNT(isCompleted = true) / COUNT(total lessons)
```

Ví dụ: 8/10 lessons completed → progress = 0.8 (80%).

---

## 2. QUIZ ATTEMPTS — Làm bài kiểm tra

### 2.1 QuizAttempt

```prisma
model QuizAttempt {
  id        String    @id @default(cuid())
  userId    String    @map("user_id")
  quizId    String    @map("quiz_id")
  score     Float                      // 0.0 → 1.0 (0% → 100%)
  passed    Boolean                    // score ≥ quiz.passingScore?
  startedAt DateTime                   // Bắt đầu làm bài
  endedAt   DateTime?                  // Nộp bài (null = đang làm)

  answers QuizAnswer[]

  @@index([userId, quizId])
}
```

**Flow làm quiz:**

```
1. Student bấm "Start Quiz"
   → tạo QuizAttempt: startedAt = now(), endedAt = null
   → check maxAttempts: đã làm bao nhiêu lần?

2. Student chọn đáp án cho từng câu
   → tạo QuizAnswer cho mỗi câu

3. Student bấm "Submit"
   → tính score = correct answers / total questions
   → passed = score ≥ quiz.passingScore
   → endedAt = now()
   → nếu passed → lesson.isCompleted = true
```

### 2.2 QuizAnswer

```prisma
model QuizAnswer {
  id               String  @id @default(cuid())
  attemptId        String  @map("attempt_id")
  questionId       String  @map("question_id")
  selectedOptionId String? @map("selected_option_id")  // Option student chọn
  isCorrect        Boolean                              // Đúng hay sai
}
```

`selectedOptionId` nullable — student có thể bỏ qua câu hỏi.

---

## 3. CERTIFICATE — Chứng chỉ

```prisma
model Certificate {
  id             String @id @default(cuid())
  userId         String @map("user_id")
  courseId       String @map("course_id")
  certificateUrl String @map("certificate_url")   // URL ảnh certificate
  verifyCode     String @unique @map("verify_code")  // Mã xác thực

  @@unique([userId, courseId])   // 1 certificate per user-course
}
```

**Flow:**

```
1. Student hoàn thành 100% khóa học (tất cả lessons completed)
2. Backend generate certificate image (PDF/PNG) → upload Cloudinary
3. Tạo verifyCode unique (ví dụ: "CERT-ABC123XYZ")
4. Student download certificate
5. Bất kỳ ai có verifyCode → verify tại /certificates/verify/CERT-ABC123XYZ
```

---

## 4. DAILYACTIVITY — Chuỗi hoạt động (Streaks)

```prisma
model DailyActivity {
  userId           String   @map("user_id")
  activityDate     DateTime @map("activity_date") @db.Date   // Chỉ ngày, không giờ
  lessonsCompleted Int      @default(0)
  quizzesPassed    Int      @default(0)
  minutesSpent     Int      @default(0)

  @@id([userId, activityDate])
}
```

### 4.1 `@db.Date` — Kiểu Date (không có time)

```sql
-- PostgreSQL: DATE type (chỉ yyyy-mm-dd)
activity_date DATE    -- 2024-06-15 (không có giờ phút giây)
```

Mỗi ngày student hoạt động → 1 record. Dùng để:

- Hiển thị **streak** (chuỗi ngày học liên tục) giống GitHub contribution graph
- Thống kê: "Tuần này học 5 giờ, hoàn thành 12 bài"

### 4.2 Composite PK

```prisma
@@id([userId, activityDate])
```

Mỗi user chỉ có 1 record per ngày. Backend `upsert` mỗi khi student hoạt động.

---

## 5. USERSKILL & PLACEMENT TEST

### 5.1 UserSkill — Trình độ theo tag

```prisma
model UserSkill {
  userId String @map("user_id")
  tagId  String @map("tag_id")
  level  Float  @default(0)    // 0.0 → 1.0

  @@unique([userId, tagId])
}
```

Tự động cập nhật khi student hoàn thành courses/quizzes liên quan đến tag đó.

### 5.2 PlacementQuestion & PlacementTest

```prisma
model PlacementQuestion {
  id       String      @id @default(cuid())
  question String
  options  Json           // [{text: "A", ...}, {text: "B", ...}]
  answer   String         // Đáp án đúng
  level    CourseLevel    // Câu hỏi dành cho level nào
  tagIds   String[]       // Liên quan đến tags nào
}

model PlacementTest {
  id               String      @id @default(cuid())
  userId           String      @map("user_id")
  scores           Json           // {react: 0.8, typescript: 0.6}
  recommendedLevel CourseLevel    // Đề xuất level
}
```

**Placement test**: Test đầu vào khi student mới đăng ký — xác định trình độ → gợi ý khóa học phù hợp.

---

## PART B: MODULE 5 — SOCIAL (12 Models)

---

## 6. POST — Bài đăng

```prisma
model Post {
  id           String   @id @default(cuid())
  authorId     String   @map("author_id")
  type         PostType @default(TEXT)     // TEXT | CODE | LINK | SHARED
  content      String?
  codeSnippet  Json?    @map("code_snippet")
  linkUrl      String?  @map("link_url")
  groupId      String?  @map("group_id")      // null = public feed
  sharedPostId String?  @map("shared_post_id")  // null = original post

  // Denormalized counters
  likeCount    Int @default(0)
  commentCount Int @default(0)
  shareCount   Int @default(0)

  deletedAt DateTime? @map("deleted_at")   // Soft delete
}
```

### 6.1 Bốn loại Post

| Type   | Fields dùng                | Ví dụ                             |
| ------ | -------------------------- | --------------------------------- |
| TEXT   | `content`                  | "Vừa hoàn thành khóa React!"      |
| CODE   | `content` + `codeSnippet`  | Share code snippet kèm giải thích |
| LINK   | `content` + `linkUrl`      | Share link bài viết hay           |
| SHARED | `content` + `sharedPostId` | Share/repost bài người khác       |

### 6.2 `codeSnippet` (Json)

```json
{
  "language": "typescript",
  "code": "const [count, setCount] = useState(0);\n...",
  "fileName": "Counter.tsx"
}
```

### 6.3 Self-referencing — Share post

```prisma
sharedPost Post?  @relation("shared_posts", fields: [sharedPostId], references: [id])
shares     Post[] @relation("shared_posts")
```

Post trỏ về chính nó — bài share chứa reference đến bài gốc.

### 6.4 `groupId` — Post trong group

- `groupId = null` → bài đăng trên **public feed**
- `groupId = "xxx"` → bài đăng trong **group cụ thể**

---

## 7. POSTIMAGE, LIKE, COMMENT, BOOKMARK

### 7.1 PostImage

```prisma
model PostImage {
  id       String  @id @default(cuid())
  postId   String  @map("post_id")
  url      String              // Cloudinary URL
  publicId String?             // Để xóa ảnh trên Cloudinary
  order    Int     @default(0)  // Thứ tự hiển thị
}
```

Mỗi post có thể có nhiều ảnh (carousel).

### 7.2 Like — Thích bài viết

```prisma
model Like {
  userId String @map("user_id")
  postId String @map("post_id")

  @@unique([userId, postId])   // 1 user chỉ like 1 lần
}
```

Like → `post.likeCount += 1`. Unlike → `post.likeCount -= 1`. Dùng **optimistic update** trên frontend.

### 7.3 Comment — Bình luận (nested)

```prisma
model Comment {
  id       String  @id @default(cuid())
  content  String
  authorId String  @map("author_id")
  postId   String  @map("post_id")
  parentId String? @map("parent_id")       // null = top-level comment

  parent  Comment?  @relation("nested_comments", fields: [parentId], references: [id], onDelete: Cascade)
  replies Comment[] @relation("nested_comments")
}
```

**Nested comments** (self-referencing):

```
Comment 1: "Great post!"
├── Reply 1.1: "Thanks!"
│   └── Reply 1.1.1: "You're welcome"
└── Reply 1.2: "I agree"
Comment 2: "Can you explain more?"
```

`onDelete: Cascade` → xóa comment → xóa tất cả replies.

### 7.4 Bookmark — Lưu bài viết

```prisma
model Bookmark {
  userId String @map("user_id")
  postId String @map("post_id")

  @@unique([userId, postId])
}
```

---

## 8. FOLLOW — Theo dõi người dùng

```prisma
model Follow {
  followerId  String @map("follower_id")
  followingId String @map("following_id")

  follower  User @relation("follower", fields: [followerId], references: [id], onDelete: Cascade)
  following User @relation("following", fields: [followingId], references: [id], onDelete: Cascade)

  @@id([followerId, followingId])
  @@index([followingId])
}
```

### 8.1 Giải thích relation names

Đây là phần **dễ nhầm lẫn nhất** trong schema:

```
User A follows User B:
├── Follow record: followerId = A, followingId = B
├── A.following includes this Follow (A đang follow B)
└── B.followers includes this Follow (B được A follow)
```

Trong model User:

```prisma
followers Follow[] @relation("following")  // Người follow mình (followingId = mình)
following Follow[] @relation("follower")   // Mình follow ai (followerId = mình)
```

> Tên relation `"following"` / `"follower"` match với **field name** trong Follow model, không phải nghĩa logic. Đọc kỹ sẽ thấy hợp lý:
>
> - `followers` dùng relation `"following"` vì query qua `followingId`
> - `following` dùng relation `"follower"` vì query qua `followerId`

---

## 9. CONVERSATION & MESSAGE — Chat

### 9.1 Conversation

```prisma
model Conversation {
  id        String  @id @default(cuid())
  isGroup   Boolean @default(false)    // Chat 1:1 hoặc group chat
  name      String?                    // Tên group (null cho 1:1)
  avatarUrl String?                    // Avatar group

  members  ConversationMember[]
  messages Message[]
}
```

### 9.2 ConversationMember

```prisma
model ConversationMember {
  id             String    @id @default(cuid())
  conversationId String    @map("conversation_id")
  userId         String    @map("user_id")
  lastReadAt     DateTime? @map("last_read_at")   // Đánh dấu đã đọc đến đâu

  @@unique([conversationId, userId])
}
```

**`lastReadAt`**: So sánh với `message.createdAt` để tính **unread count**.

### 9.3 Message

```prisma
model Message {
  id             String      @id @default(cuid())
  conversationId String      @map("conversation_id")
  senderId       String      @map("sender_id")
  type           MessageType @default(TEXT)   // TEXT | IMAGE | CODE | FILE
  content        String
  fileUrl        String?     @map("file_url")
  fileName       String?     @map("file_name")

  @@index([conversationId, createdAt])
}
```

Index `[conversationId, createdAt]` → load tin nhắn theo thời gian (pagination).

---

## 10. GROUP — Nhóm học tập

```prisma
model Group {
  id          String  @id @default(cuid())
  name        String
  description String?
  avatarUrl   String?
  ownerId     String  @map("owner_id")
  courseId    String? @unique @map("course_id")   // Nhóm tự động cho khóa học
  memberCount Int     @default(1)

  members GroupMember[]
  posts   Post[]
}
```

**`courseId @unique`**: Mỗi course tối đa 1 group tự động. Khi instructor tạo khóa → tạo group. Students enrolled → tự động join.

### GroupMember

```prisma
model GroupMember {
  groupId String    @map("group_id")
  userId  String    @map("user_id")
  role    GroupRole @default(MEMBER)   // OWNER | ADMIN | MEMBER
}
```

---

## 11. FEEDITEM — News feed (Fanout on Write)

```prisma
model FeedItem {
  id     String @id @default(cuid())
  userId String @map("user_id")
  postId String @map("post_id")

  @@index([userId, createdAt(sort: Desc)])
  @@index([postId])
}
```

### 11.1 Fanout on Write strategy

Khi User A tạo post mới:

```
1. A có 500 followers
2. Backend tạo 500 FeedItem records (1 cho mỗi follower)
3. Mỗi follower mở app → query FeedItem WHERE userId = mình ORDER BY createdAt DESC

Ưu: Read nhanh (mỗi user chỉ query feed của mình)
Nhược: Write chậm (tạo N records, N = số followers)
```

**Tại sao chọn Fanout on Write?**

| Strategy        | Read                   | Write                | Phù hợp                |
| --------------- | ---------------------- | -------------------- | ---------------------- |
| Fanout on Write | O(1) — đọc từ FeedItem | O(N) — tạo N records | Few writes, many reads |
| Fanout on Read  | O(N) — merge N feeds   | O(1) — chỉ tạo Post  | Many writes, few reads |

SSLM: users đọc feed nhiều hơn post → Fanout on Write phù hợp.

### 11.2 Sorted index

```prisma
@@index([userId, createdAt(sort: Desc)])
```

`Desc` = newest first. Query feed page: `WHERE userId = ? ORDER BY createdAt DESC LIMIT 20`.
