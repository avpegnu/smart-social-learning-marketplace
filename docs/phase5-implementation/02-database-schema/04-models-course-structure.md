# 04 — Module 2: Course Structure (12 Models)

> Giải thích cấu trúc khóa học: Category, Tag, Course, Section, Chapter, Lesson, Media, Quiz, và các model phụ.

---

## 1. TỔNG QUAN CẤU TRÚC KHÓA HỌC

```
Category (danh mục)
  └── Course (khóa học)
        ├── CourseTag (tags — N:M)
        ├── Section (phần)
        │     └── Chapter (chương)
        │           └── Lesson (bài học)
        │                 ├── Media (video/image)
        │                 ├── LessonAttachment (tài liệu)
        │                 └── Quiz (bài kiểm tra)
        │                       ├── QuizQuestion
        │                       └── QuizOption
        └── Tag (thẻ nhãn)
```

### Hierarchy: Course → Section → Chapter → Lesson

```
Ví dụ thực tế:

📚 Course: "NestJS Complete Guide"
├── 📂 Section 1: "Fundamentals"
│   ├── 📖 Chapter 1: "Introduction to NestJS"
│   │   ├── 🎬 Lesson 1: "What is NestJS?" (VIDEO, 10 phút)
│   │   ├── 📝 Lesson 2: "Installation Guide" (TEXT)
│   │   └── ❓ Lesson 3: "Check Understanding" (QUIZ)
│   └── 📖 Chapter 2: "Modules & Controllers"
│       ├── 🎬 Lesson 1: "Creating Modules" (VIDEO, 15 phút)
│       └── 🎬 Lesson 2: "Controllers Deep Dive" (VIDEO, 20 phút)
├── 📂 Section 2: "Database"
│   ├── 📖 Chapter 3: "Prisma Setup"
│   └── 📖 Chapter 4: "CRUD Operations"
└── 📂 Section 3: "Advanced"
    └── ...
```

**Tại sao 4 cấp (Course → Section → Chapter → Lesson)?**

- **Section**: Nhóm lớn, chia khóa học thành phần (Fundamentals, Database, Advanced)
- **Chapter**: Nhóm nhỏ hơn, có thể bán lẻ (mua từng chương)
- **Lesson**: Đơn vị học nhỏ nhất — 1 video, 1 bài text, hoặc 1 quiz

Thiết kế này giống Udemy: Section → Chapter (they call "Section") → Lesson (they call "Lecture").

---

## 2. MODEL CATEGORY — Danh mục (hỗ trợ nested)

```prisma
model Category {
  id       String  @id @default(cuid())
  name     String
  slug     String  @unique
  iconUrl  String? @map("icon_url")
  parentId String? @map("parent_id")
  order    Int     @default(0)

  parent   Category?  @relation("subcategories", fields: [parentId], references: [id])
  children Category[] @relation("subcategories")
  courses  Course[]

  @@index([parentId])
  @@map("categories")
}
```

### 2.1 Self-referencing relation — Nested categories

```prisma
parent   Category?  @relation("subcategories", fields: [parentId], references: [id])
children Category[] @relation("subcategories")
```

Category trỏ về **chính nó** — cho phép tạo cây danh mục:

```
Web Development (parentId = null)
├── Frontend (parentId = "web-dev-id")
│   ├── React (parentId = "frontend-id")
│   └── Vue.js (parentId = "frontend-id")
└── Backend (parentId = "web-dev-id")
    ├── Node.js
    └── Python
```

### 2.2 Slug — URL-friendly identifier

```prisma
slug String @unique    // "web-development", "data-science"
```

Slug dùng trong URL thay vì ID: `/categories/web-development` thay vì `/categories/clx1abc2d...`

```typescript
// Tạo slug từ name
import slugify from 'slugify';
const slug = slugify('Web Development', { lower: true }); // "web-development"
```

### 2.3 Order — Sắp xếp thủ công

```prisma
order Int @default(0)
```

Admin sắp xếp thứ tự hiển thị categories trên UI. `ORDER BY order ASC` → hiển thị theo thứ tự mong muốn.

---

## 3. MODEL TAG — Thẻ nhãn

```prisma
model Tag {
  id         String @id @default(cuid())
  name       String @unique
  slug       String @unique
  courseCount Int    @default(0) @map("course_count")

  courseTags CourseTag[]
  userSkills UserSkill[]
  questions  Question[]

  @@map("tags")
}
```

### Tag vs Category

|            | Category             | Tag                               |
| ---------- | -------------------- | --------------------------------- |
| Mỗi course | Thuộc **1** category | Có **nhiều** tags                 |
| Cấu trúc   | Hierarchical (cây)   | Flat (phẳng)                      |
| Mục đích   | Phân loại chính      | Gắn nhãn chi tiết                 |
| Ví dụ      | "Web Development"    | "React", "TypeScript", "REST API" |

Course "NestJS Complete Guide":

- Category: Web Development > Backend
- Tags: NestJS, TypeScript, Node.js, REST API, PostgreSQL

### `courseCount` — Denormalized counter

```prisma
courseCount Int @default(0) @map("course_count")
```

Đếm số courses gắn tag này. Cập nhật khi thêm/xóa CourseTag. Dùng hiển thị: "React (245 courses)".

---

## 4. MODEL COURSE — Trung tâm module

```prisma
model Course {
  id               String       @id @default(cuid())
  title            String
  slug             String       @unique
  shortDescription String?      @map("short_description")
  description      String?
  thumbnailUrl     String?      @map("thumbnail_url")
  promoVideoUrl    String?      @map("promo_video_url")
  level            CourseLevel  @default(ALL_LEVELS)
  language         String       @default("vi")
  price            Float        @default(0)
  originalPrice    Float?       @map("original_price")
  status           CourseStatus @default(DRAFT)
  instructorId     String       @map("instructor_id")
  categoryId       String?      @map("category_id")

  // Denormalized counters
  totalStudents Int   @default(0) @map("total_students")
  totalLessons  Int   @default(0) @map("total_lessons")
  totalDuration Int   @default(0) @map("total_duration")
  avgRating     Float @default(0) @map("avg_rating")
  reviewCount   Int   @default(0) @map("review_count")
  viewCount     Int   @default(0) @map("view_count")
  // ...
}
```

### 4.1 Price & originalPrice — Hiển thị giảm giá

```
price = 299000         ← Giá hiện tại
originalPrice = 499000 ← Giá gốc (gạch ngang)

UI hiển thị: ₫299,000  ₫499,000  (giảm 40%)
```

`price = 0` → khóa học miễn phí.

### 4.2 Denormalized counters giải thích

```prisma
totalStudents Int @default(0)   // = COUNT(enrollments)
totalLessons  Int @default(0)   // = COUNT(lessons across all chapters)
totalDuration Int @default(0)   // = SUM(lesson.estimatedDuration) — tính bằng giây
avgRating     Float @default(0) // = AVG(reviews.rating)
reviewCount   Int @default(0)   // = COUNT(reviews)
viewCount     Int @default(0)   // Mỗi lần view course detail page
```

Tất cả đều có thể tính bằng JOIN + aggregate, nhưng **rất chậm** khi hiển thị danh sách courses (mỗi course cần 5 JOIN queries). Denormalize → 1 query đơn giản.

### 4.3 Indexes trên Course

```prisma
@@index([instructorId])    // Lấy courses của instructor
@@index([categoryId])      // Filter courses theo category
@@index([status])          // Filter courses theo status (PUBLISHED, DRAFT...)
@@index([avgRating])       // Sort by rating
@@index([price])           // Filter/sort by price
@@index([publishedAt])     // Sort by newest
```

**Tại sao cần nhiều index?**

Course là model được query nhiều nhất:

- Browse page: filter by category, level, price range, sort by rating/newest
- Instructor dashboard: lấy courses của mình
- Admin: filter by status (pending review)

Mỗi index = PostgreSQL B-tree → lookup O(log n) thay vì O(n).

---

## 5. MODEL COURSETAG — Junction table (N:M)

```prisma
model CourseTag {
  courseId String @map("course_id")
  tagId   String @map("tag_id")

  course Course @relation(fields: [courseId], references: [id], onDelete: Cascade)
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([courseId, tagId])     // Composite primary key
  @@index([tagId])
  @@map("course_tags")
}
```

### Junction table là gì?

Quan hệ **many-to-many** (N:M) cần bảng trung gian:

```
Course 1 ←──── CourseTag ────→ Tag "React"
Course 1 ←──── CourseTag ────→ Tag "TypeScript"
Course 2 ←──── CourseTag ────→ Tag "React"
```

### Composite primary key

```prisma
@@id([courseId, tagId])    // PK = courseId + tagId
```

Thay vì dùng `id` CUID riêng, dùng **composite key** = cặp (courseId, tagId). Đảm bảo:

- 1 course không gắn cùng 1 tag 2 lần
- Tiết kiệm 1 cột id

---

## 6. SECTION, CHAPTER, LESSON — Cấu trúc nội dung

### 6.1 Section — Nhóm lớn

```prisma
model Section {
  id       String @id @default(cuid())
  title    String
  order    Int    @default(0)
  courseId String @map("course_id")

  course   Course    @relation(fields: [courseId], references: [id], onDelete: Cascade)
  chapters Chapter[]

  @@index([courseId])
}
```

Đơn giản: title + order + thuộc về 1 course. `onDelete: Cascade` → xóa course → xóa sections.

### 6.2 Chapter — Đơn vị bán lẻ

```prisma
model Chapter {
  id            String  @id @default(cuid())
  title         String
  description   String?
  order         Int     @default(0)
  price         Float?                              // Giá bán lẻ chương
  isFreePreview Boolean @default(false)             // Cho xem miễn phí
  lessonsCount  Int     @default(0)                 // Denormalized
  totalDuration Int     @default(0)                 // Denormalized
  sectionId     String  @map("section_id")

  section          Section           @relation(...)
  lessons          Lesson[]
  chapterPurchases ChapterPurchase[]    // Ai đã mua chương này
  cartItems        CartItem[]           // Đang trong giỏ hàng
  orderItems       OrderItem[]          // Đã thanh toán
}
```

**`price` field**: SSLM cho phép **bán lẻ từng chương** — student có thể mua 1 chương thay vì cả khóa:

```
Course "NestJS Guide" — 499,000đ
├── Chapter 1: "Basics" — miễn phí (isFreePreview = true)
├── Chapter 2: "Database" — 99,000đ
├── Chapter 3: "Auth" — 99,000đ
└── Chapter 4: "Advanced" — 149,000đ
```

### 6.3 Lesson — Đơn vị học nhỏ nhất

```prisma
model Lesson {
  id                String     @id @default(cuid())
  title             String
  type              LessonType @default(VIDEO)      // VIDEO | TEXT | QUIZ
  order             Int        @default(0)
  textContent       String?    @map("text_content")  // Nội dung bài text
  estimatedDuration Int?       @map("estimated_duration")  // Giây
  chapterId         String     @map("chapter_id")

  media            Media[]             // Video/image files
  attachments      LessonAttachment[]  // Tài liệu đính kèm
  quiz             Quiz?               // Quiz (nếu type = QUIZ)
  lessonProgresses LessonProgress[]    // Tiến độ học viên
  courseChunks      CourseChunk[]       // AI Tutor chunks
}
```

**3 loại Lesson:**

| Type  | Nội dung           | Fields dùng                                |
| ----- | ------------------ | ------------------------------------------ |
| VIDEO | Video bài giảng    | `media` (video files), `estimatedDuration` |
| TEXT  | Bài viết rich text | `textContent` (HTML/Markdown)              |
| QUIZ  | Bài kiểm tra       | `quiz` (relation to Quiz model)            |

---

## 7. MEDIA & ATTACHMENTS

### 7.1 Media — Video/Image upload

```prisma
model Media {
  id           String      @id @default(cuid())
  type         MediaType                    // VIDEO | IMAGE | ATTACHMENT
  status       MediaStatus @default(UPLOADING)  // Trạng thái upload
  originalName String      @map("original_name")
  mimeType     String      @map("mime_type")
  size         Int                          // Bytes
  urls         Json?                        // Cloudinary URLs (nhiều kích thước)
  publicId     String?     @map("public_id")    // Cloudinary public ID
  duration     Int?                         // Giây (chỉ cho video)
  lessonId     String?     @map("lesson_id")

  lesson Lesson? @relation(fields: [lessonId], references: [id], onDelete: SetNull)
}
```

**Upload flow:**

```
1. Frontend upload file → Cloudinary (direct upload)
2. Cloudinary trả về publicId + URLs
3. Backend tạo Media record: status = UPLOADING
4. Cloudinary webhook → Backend cập nhật: status = READY, urls = {...}
5. Nếu transcoding fail → status = FAILED
```

**`urls` field (Json):**

```json
{
  "original": "https://res.cloudinary.com/.../original.mp4",
  "hls": "https://res.cloudinary.com/.../adaptive.m3u8",
  "thumbnail": "https://res.cloudinary.com/.../thumb.jpg",
  "preview": "https://res.cloudinary.com/.../preview.gif"
}
```

**`onDelete: SetNull`**: Khi xóa Lesson → Media vẫn tồn tại (lessonId = null). Tránh mất file trên Cloudinary — cần cleanup job riêng.

### 7.2 LessonAttachment — Tài liệu đính kèm

```prisma
model LessonAttachment {
  id       String @id @default(cuid())
  name     String          // "slide-chapter-3.pdf"
  url      String          // Cloudinary URL
  size     Int             // Bytes
  mimeType String          // "application/pdf"
  lessonId String

  lesson Lesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)
}
```

Tài liệu bổ sung: PDF, slides, source code, v.v. Khác Media (video chính), attachments là file tải về.

---

## 8. QUIZ SYSTEM — QuizQuestion, QuizOption

### 8.1 Cấu trúc Quiz

```
Lesson (type = QUIZ)
└── Quiz
    ├── passingScore = 0.7 (70%)
    ├── maxAttempts = 3
    ├── timeLimitSeconds = 600 (10 phút)
    │
    ├── QuizQuestion 1: "React hook nào dùng cho side effects?"
    │   ├── QuizOption A: "useState" (isCorrect = false)
    │   ├── QuizOption B: "useEffect" (isCorrect = true) ✅
    │   ├── QuizOption C: "useMemo" (isCorrect = false)
    │   └── QuizOption D: "useRef" (isCorrect = false)
    │
    └── QuizQuestion 2: "..."
        └── ...
```

### 8.2 Quiz model

```prisma
model Quiz {
  id               String @id @default(cuid())
  lessonId         String @unique           // 1:1 với Lesson
  passingScore     Float  @default(0.7)     // 70% để pass
  maxAttempts      Int?                     // null = unlimited
  timeLimitSeconds Int?                     // null = no limit
}
```

### 8.3 `lessonId @unique` — One-to-one

Mỗi Lesson type QUIZ có **đúng 1** Quiz. `@unique` trên foreign key = 1:1 relationship.

### 8.4 QuizQuestion & QuizOption

```prisma
model QuizQuestion {
  id          String @id @default(cuid())
  quizId      String
  question    String              // Nội dung câu hỏi
  explanation String?             // Giải thích đáp án (hiện sau khi submit)
  order       Int    @default(0)  // Thứ tự hiển thị
}

model QuizOption {
  id         String  @id @default(cuid())
  questionId String
  text       String              // Nội dung lựa chọn
  isCorrect  Boolean @default(false)  // Đáp án đúng
  order      Int     @default(0)
}
```

**Multiple correct answers**: Có thể có nhiều `isCorrect = true` cho 1 question → quiz dạng "chọn tất cả đáp án đúng".
