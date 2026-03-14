# Phase 5.2 — DATABASE SCHEMA & MIGRATION

> Tài liệu chi tiết implement full Prisma schema (61 models, 30+ enums) và migration.
> Tham chiếu: `docs/phase2-database/01-database-design.md`

---

## Mục lục

- [Step 1: Chuẩn bị Docker PostgreSQL với pgvector](#step-1-chuẩn-bị-docker-postgresql-với-pgvector)
- [Step 2: Cập nhật Prisma generator & datasource](#step-2-cập-nhật-prisma-generator--datasource)
- [Step 3: Viết tất cả Enums](#step-3-viết-tất-cả-enums)
- [Step 4: Module 1 — Auth & Users (4 models)](#step-4-module-1--auth--users-4-models)
- [Step 5: Module 2 — Course Structure (12 models)](#step-5-module-2--course-structure-12-models)
- [Step 6: Module 3 — Ecommerce (12 models)](#step-6-module-3--ecommerce-12-models)
- [Step 7: Module 4 — Learning (8 models)](#step-7-module-4--learning-8-models)
- [Step 8: Module 5 — Social (12 models)](#step-8-module-5--social-12-models)
- [Step 9: Module 6 — Q&A Forum (3 models)](#step-9-module-6--qa-forum-3-models)
- [Step 10: Module 7-10 — Notifications, AI, Admin, Recommendation (10 models)](#step-10-module-7-10--notifications-ai-admin-recommendation-10-models)
- [Step 11: Chạy Migration](#step-11-chạy-migration)
- [Step 12: Raw SQL Migrations (tsvector, pgvector)](#step-12-raw-sql-migrations-tsvector-pgvector)
- [Step 13: Seed Data](#step-13-seed-data)
- [Step 14: Validate & Verify](#step-14-validate--verify)

---

## Step 1: Chuẩn bị Docker PostgreSQL với pgvector

### 1.1 Cập nhật `docker-compose.yml` — đổi image PostgreSQL

```yaml
# Đổi image từ postgres:16 sang pgvector/pgvector:pg16
services:
  postgres:
    image: pgvector/pgvector:pg16
    # ... giữ nguyên phần còn lại
```

> Image `pgvector/pgvector:pg16` đã có sẵn extension `vector`, chỉ cần `CREATE EXTENSION vector;`

### 1.2 Khởi động lại containers

```bash
docker compose down
docker compose up -d
```

### 1.3 Verify pgvector

```bash
docker exec -it sslm-postgres psql -U postgres -d sslm_dev -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

---

## Step 2: Cập nhật Prisma generator & datasource

### 2.1 File `apps/api/src/prisma/schema.prisma`

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearchPostgres"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

> `fullTextSearchPostgres` — cần cho full-text search features sau này.

---

## Step 3: Viết tất cả Enums

```prisma
// ============================================
// ENUMS
// ============================================

// --- Auth & Users ---
enum Role {
  STUDENT
  INSTRUCTOR
  ADMIN
}

enum UserStatus {
  UNVERIFIED
  ACTIVE
  SUSPENDED
}

enum AuthProvider {
  LOCAL
  GOOGLE
}

enum ApplicationStatus {
  PENDING
  APPROVED
  REJECTED
}

// --- Course ---
enum CourseLevel {
  BEGINNER
  INTERMEDIATE
  ADVANCED
  ALL_LEVELS
}

enum CourseStatus {
  DRAFT
  PENDING_REVIEW
  APPROVED
  PUBLISHED
  REJECTED
  ARCHIVED
}

enum LessonType {
  VIDEO
  TEXT
  QUIZ
}

enum MediaType {
  VIDEO
  IMAGE
  ATTACHMENT
}

enum MediaStatus {
  UPLOADING
  PROCESSING
  READY
  FAILED
}

// --- Ecommerce ---
enum OrderStatus {
  PENDING
  COMPLETED
  EXPIRED
  REFUNDED
}

enum OrderItemType {
  COURSE
  CHAPTER
}

enum EnrollmentType {
  FULL
  PARTIAL
}

enum CouponType {
  PERCENTAGE
  FIXED_AMOUNT
}

enum EarningStatus {
  PENDING
  AVAILABLE
  WITHDRAWN
}

enum WithdrawalStatus {
  PENDING
  PROCESSING
  COMPLETED
  REJECTED
}

// --- Social ---
enum PostType {
  TEXT
  CODE
  LINK
  SHARED
}

enum MessageType {
  TEXT
  IMAGE
  CODE
  FILE
}

enum GroupRole {
  OWNER
  ADMIN
  MEMBER
}

// --- Notifications ---
enum NotificationType {
  FOLLOW
  POST_LIKE
  POST_COMMENT
  COURSE_ENROLLED
  COURSE_APPROVED
  COURSE_REJECTED
  ORDER_COMPLETED
  ORDER_EXPIRED
  NEW_MESSAGE
  QUESTION_ANSWERED
  ANSWER_VOTED
  WITHDRAWAL_COMPLETED
  WITHDRAWAL_REJECTED
  SYSTEM
}

// --- AI ---
enum AiMessageRole {
  USER
  ASSISTANT
}

// --- Admin ---
enum ReportTargetType {
  USER
  COURSE
  POST
  COMMENT
  QUESTION
  ANSWER
  MESSAGE
}

enum ReportStatus {
  PENDING
  REVIEWED
  ACTION_TAKEN
  DISMISSED
}

enum SimilarityAlgorithm {
  CONTENT
  COLLABORATIVE
  HYBRID
}

enum AnalyticsType {
  DAILY_USERS
  DAILY_REVENUE
  DAILY_ENROLLMENTS
  DAILY_COURSES
}
```

---

## Step 4: Module 1 — Auth & Users (4 models)

```prisma
// ============================================
// MODULE 1: AUTH & USERS
// ============================================

model User {
  id                      String             @id @default(cuid())
  email                   String             @unique
  passwordHash            String?            @map("password_hash")
  fullName                String             @map("full_name")
  avatarUrl               String?            @map("avatar_url")
  bio                     String?
  role                    Role               @default(STUDENT)
  status                  UserStatus         @default(UNVERIFIED)
  provider                AuthProvider       @default(LOCAL)
  providerId              String?            @map("provider_id")
  verificationToken       String?            @map("verification_token")
  verificationExpiresAt   DateTime?          @map("verification_expires_at")
  resetToken              String?            @map("reset_token")
  resetTokenExpiresAt     DateTime?          @map("reset_token_expires_at")
  followerCount           Int                @default(0) @map("follower_count")
  followingCount          Int                @default(0) @map("following_count")
  notificationPreferences Json?              @map("notification_preferences")

  createdAt               DateTime           @default(now()) @map("created_at")
  updatedAt               DateTime           @updatedAt @map("updated_at")
  deletedAt               DateTime?          @map("deleted_at")

  // Relations
  refreshTokens           RefreshToken[]
  instructorProfile       InstructorProfile?
  instructorApplications  InstructorApplication[] @relation("applicant")
  reviewedApplications    InstructorApplication[] @relation("reviewer")

  courses                 Course[]
  enrollments             Enrollment[]
  chapterPurchases        ChapterPurchase[]
  cartItems               CartItem[]
  orders                  Order[]
  reviews                 Review[]
  wishlists               Wishlist[]
  earnings                Earning[]
  withdrawals             Withdrawal[]         @relation("instructor_withdrawals")
  reviewedWithdrawals     Withdrawal[]         @relation("admin_reviewed_withdrawals")

  posts                   Post[]
  comments                Comment[]
  likes                   Like[]
  bookmarks               Bookmark[]
  followers               Follow[]             @relation("following")
  following               Follow[]             @relation("follower")
  ownedGroups             Group[]
  groupMemberships        GroupMember[]
  conversationMembers     ConversationMember[]
  messages                Message[]
  feedItems               FeedItem[]

  questions               Question[]
  answers                 Answer[]
  votes                   Vote[]

  notifications           Notification[]
  aiChatSessions          AiChatSession[]
  reports                 Report[]             @relation("reporter")
  reportedReports         Report[]             @relation("reviewer")

  lessonProgresses        LessonProgress[]
  quizAttempts            QuizAttempt[]
  certificates            Certificate[]
  dailyActivities         DailyActivity[]
  userSkills              UserSkill[]
  placementTests          PlacementTest[]

  @@map("users")
}

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String   @map("user_id")
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@map("refresh_tokens")
}

model InstructorProfile {
  id              String   @id @default(cuid())
  userId          String   @unique @map("user_id")
  headline        String?
  biography       String?
  expertise       String[]
  experience      String?
  qualifications  Json?
  socialLinks     Json?    @map("social_links")
  totalStudents   Int      @default(0) @map("total_students")
  totalCourses    Int      @default(0) @map("total_courses")
  totalRevenue    Float    @default(0) @map("total_revenue")

  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("instructor_profiles")
}

model InstructorApplication {
  id              String            @id @default(cuid())
  userId          String            @map("user_id")
  status          ApplicationStatus @default(PENDING)
  expertise       String[]
  experience      String?
  motivation      String?
  cvUrl           String?           @map("cv_url")
  certificateUrls String[]          @map("certificate_urls")
  reviewedById    String?           @map("reviewed_by_id")
  reviewNote      String?           @map("review_note")
  reviewedAt      DateTime?         @map("reviewed_at")

  createdAt       DateTime          @default(now()) @map("created_at")
  updatedAt       DateTime          @updatedAt @map("updated_at")

  user            User              @relation("applicant", fields: [userId], references: [id], onDelete: Cascade)
  reviewedBy      User?             @relation("reviewer", fields: [reviewedById], references: [id])

  @@index([userId])
  @@index([status])
  @@map("instructor_applications")
}
```

---

## Step 5: Module 2 — Course Structure (12 models)

```prisma
// ============================================
// MODULE 2: COURSE STRUCTURE
// ============================================

model Category {
  id        String     @id @default(cuid())
  name      String
  slug      String     @unique
  iconUrl   String?    @map("icon_url")
  parentId  String?    @map("parent_id")
  order     Int        @default(0)

  createdAt DateTime   @default(now()) @map("created_at")
  updatedAt DateTime   @updatedAt @map("updated_at")

  parent    Category?  @relation("subcategories", fields: [parentId], references: [id])
  children  Category[] @relation("subcategories")
  courses   Course[]

  @@index([parentId])
  @@map("categories")
}

model Tag {
  id          String      @id @default(cuid())
  name        String      @unique
  slug        String      @unique
  courseCount  Int         @default(0) @map("course_count")

  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt @map("updated_at")

  courseTags  CourseTag[]
  userSkills  UserSkill[]
  questions   Question[]

  @@map("tags")
}

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
  totalStudents    Int          @default(0) @map("total_students")
  totalLessons     Int          @default(0) @map("total_lessons")
  totalDuration    Int          @default(0) @map("total_duration")
  avgRating        Float        @default(0) @map("avg_rating")
  reviewCount      Int          @default(0) @map("review_count")
  viewCount        Int          @default(0) @map("view_count")

  publishedAt      DateTime?    @map("published_at")
  createdAt        DateTime     @default(now()) @map("created_at")
  updatedAt        DateTime     @updatedAt @map("updated_at")
  deletedAt        DateTime?    @map("deleted_at")

  instructor       User         @relation(fields: [instructorId], references: [id])
  category         Category?    @relation(fields: [categoryId], references: [id])
  courseTags       CourseTag[]
  sections         Section[]
  enrollments      Enrollment[]
  cartItems        CartItem[]
  orderItems       OrderItem[]
  reviews          Review[]
  wishlists        Wishlist[]
  couponCourses    CouponCourse[]
  aiChatSessions   AiChatSession[]
  courseChunks      CourseChunk[]
  certificates     Certificate[]
  questions        Question[]
  group            Group?
  similarTo        CourseSimilarity[] @relation("source_course")
  similarFrom      CourseSimilarity[] @relation("similar_course")

  @@index([instructorId])
  @@index([categoryId])
  @@index([status])
  @@index([avgRating])
  @@index([price])
  @@index([publishedAt])
  @@map("courses")
}

model CourseTag {
  courseId String @map("course_id")
  tagId   String @map("tag_id")

  course  Course @relation(fields: [courseId], references: [id], onDelete: Cascade)
  tag     Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([courseId, tagId])
  @@index([tagId])
  @@map("course_tags")
}

model Section {
  id       String   @id @default(cuid())
  title    String
  order    Int      @default(0)
  courseId String   @map("course_id")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  course   Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  chapters Chapter[]

  @@index([courseId])
  @@map("sections")
}

model Chapter {
  id            String   @id @default(cuid())
  title         String
  description   String?
  order         Int      @default(0)
  price         Float?
  isFreePreview Boolean  @default(false) @map("is_free_preview")
  lessonsCount  Int      @default(0) @map("lessons_count")
  totalDuration Int      @default(0) @map("total_duration")
  sectionId     String   @map("section_id")

  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  section       Section  @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  lessons       Lesson[]
  chapterPurchases ChapterPurchase[]
  cartItems     CartItem[]
  orderItems    OrderItem[]

  @@index([sectionId])
  @@map("chapters")
}

model Lesson {
  id                String     @id @default(cuid())
  title             String
  type              LessonType @default(VIDEO)
  order             Int        @default(0)
  textContent       String?    @map("text_content")
  estimatedDuration Int?       @map("estimated_duration")
  chapterId         String     @map("chapter_id")

  createdAt         DateTime   @default(now()) @map("created_at")
  updatedAt         DateTime   @updatedAt @map("updated_at")

  chapter           Chapter    @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  media             Media[]
  attachments       LessonAttachment[]
  quiz              Quiz?
  lessonProgresses  LessonProgress[]
  courseChunks      CourseChunk[]

  @@index([chapterId])
  @@map("lessons")
}

model Media {
  id           String      @id @default(cuid())
  type         MediaType
  status       MediaStatus @default(UPLOADING)
  originalName String      @map("original_name")
  mimeType     String      @map("mime_type")
  size         Int
  urls         Json?
  publicId     String?     @map("public_id")
  duration     Int?
  lessonId     String?     @map("lesson_id")

  createdAt    DateTime    @default(now()) @map("created_at")
  updatedAt    DateTime    @updatedAt @map("updated_at")

  lesson       Lesson?     @relation(fields: [lessonId], references: [id], onDelete: SetNull)

  @@index([lessonId])
  @@index([status])
  @@map("media")
}

model LessonAttachment {
  id           String   @id @default(cuid())
  name         String
  url          String
  size         Int
  mimeType     String   @map("mime_type")
  lessonId     String   @map("lesson_id")

  createdAt    DateTime @default(now()) @map("created_at")

  lesson       Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@index([lessonId])
  @@map("lesson_attachments")
}

model Quiz {
  id              String         @id @default(cuid())
  lessonId        String         @unique @map("lesson_id")
  passingScore    Float          @default(0.7) @map("passing_score")
  maxAttempts     Int?           @map("max_attempts")
  timeLimitSeconds Int?          @map("time_limit_seconds")

  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")

  lesson          Lesson         @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  questions       QuizQuestion[]
  quizAttempts    QuizAttempt[]

  @@map("quizzes")
}

model QuizQuestion {
  id            String       @id @default(cuid())
  quizId        String       @map("quiz_id")
  question      String
  explanation   String?
  order         Int          @default(0)

  createdAt     DateTime     @default(now()) @map("created_at")
  updatedAt     DateTime     @updatedAt @map("updated_at")

  quiz          Quiz         @relation(fields: [quizId], references: [id], onDelete: Cascade)
  options       QuizOption[]
  quizAnswers   QuizAnswer[]

  @@index([quizId])
  @@map("quiz_questions")
}

model QuizOption {
  id         String       @id @default(cuid())
  questionId String       @map("question_id")
  text       String
  isCorrect  Boolean      @default(false) @map("is_correct")
  order      Int          @default(0)

  question   QuizQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@index([questionId])
  @@map("quiz_options")
}
```

---

## Step 6: Module 3 — Ecommerce (12 models)

```prisma
// ============================================
// MODULE 3: ECOMMERCE
// ============================================

model CartItem {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  courseId   String?  @map("course_id")
  chapterId  String?  @map("chapter_id")
  price     Float

  createdAt DateTime @default(now()) @map("created_at")

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  course    Course?  @relation(fields: [courseId], references: [id], onDelete: Cascade)
  chapter   Chapter? @relation(fields: [chapterId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("cart_items")
}

model Order {
  id           String      @id @default(cuid())
  userId       String      @map("user_id")
  totalAmount  Float       @map("total_amount")
  discountAmount Float     @default(0) @map("discount_amount")
  finalAmount  Float       @map("final_amount")
  status       OrderStatus @default(PENDING)
  paymentRef   String?     @map("payment_ref")
  expiresAt    DateTime?   @map("expires_at")

  createdAt    DateTime    @default(now()) @map("created_at")
  updatedAt    DateTime    @updatedAt @map("updated_at")

  user         User        @relation(fields: [userId], references: [id])
  items        OrderItem[]
  couponUsage  CouponUsage?

  @@index([userId])
  @@index([status])
  @@index([expiresAt])
  @@map("orders")
}

model OrderItem {
  id        String        @id @default(cuid())
  orderId   String        @map("order_id")
  type      OrderItemType
  courseId   String?       @map("course_id")
  chapterId  String?       @map("chapter_id")
  price     Float
  title     String

  order     Order         @relation(fields: [orderId], references: [id], onDelete: Cascade)
  course    Course?       @relation(fields: [courseId], references: [id])
  chapter   Chapter?      @relation(fields: [chapterId], references: [id])
  earning   Earning?

  @@index([orderId])
  @@map("order_items")
}

model Enrollment {
  id        String         @id @default(cuid())
  userId    String         @map("user_id")
  courseId  String         @map("course_id")
  type      EnrollmentType @default(FULL)
  progress  Float          @default(0)

  createdAt DateTime       @default(now()) @map("created_at")
  updatedAt DateTime       @updatedAt @map("updated_at")

  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  course    Course         @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@unique([userId, courseId])
  @@index([userId])
  @@index([courseId])
  @@map("enrollments")
}

model ChapterPurchase {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  chapterId String   @map("chapter_id")

  createdAt DateTime @default(now()) @map("created_at")

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  chapter   Chapter  @relation(fields: [chapterId], references: [id], onDelete: Cascade)

  @@unique([userId, chapterId])
  @@map("chapter_purchases")
}

model Coupon {
  id            String      @id @default(cuid())
  code          String      @unique
  type          CouponType
  value         Float
  minOrderAmount Float?     @map("min_order_amount")
  maxDiscount   Float?      @map("max_discount")
  usageLimit    Int?        @map("usage_limit")
  usageCount    Int         @default(0) @map("usage_count")
  startDate     DateTime    @map("start_date")
  endDate       DateTime    @map("end_date")
  isActive      Boolean     @default(true) @map("is_active")
  instructorId  String      @map("instructor_id")

  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")

  couponCourses CouponCourse[]
  couponUsages  CouponUsage[]

  @@index([code])
  @@index([instructorId])
  @@map("coupons")
}

model CouponCourse {
  couponId String @map("coupon_id")
  courseId String @map("course_id")

  coupon   Coupon @relation(fields: [couponId], references: [id], onDelete: Cascade)
  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@id([couponId, courseId])
  @@map("coupon_courses")
}

model CouponUsage {
  id       String   @id @default(cuid())
  couponId String   @map("coupon_id")
  orderId  String   @unique @map("order_id")
  discount Float

  createdAt DateTime @default(now()) @map("created_at")

  coupon   Coupon   @relation(fields: [couponId], references: [id])
  order    Order    @relation(fields: [orderId], references: [id])

  @@index([couponId])
  @@map("coupon_usages")
}

model Review {
  id       String   @id @default(cuid())
  userId   String   @map("user_id")
  courseId  String   @map("course_id")
  rating   Int
  comment  String?

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  course   Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@unique([userId, courseId])
  @@index([courseId])
  @@map("reviews")
}

model Wishlist {
  id       String   @id @default(cuid())
  userId   String   @map("user_id")
  courseId  String   @map("course_id")

  createdAt DateTime @default(now()) @map("created_at")

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  course   Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@unique([userId, courseId])
  @@map("wishlists")
}

model Earning {
  id            String        @id @default(cuid())
  instructorId  String        @map("instructor_id")
  orderItemId   String        @unique @map("order_item_id")
  amount        Float
  commissionRate Float        @map("commission_rate")
  commissionAmount Float      @map("commission_amount")
  netAmount     Float         @map("net_amount")
  status        EarningStatus @default(PENDING)

  createdAt     DateTime      @default(now()) @map("created_at")
  updatedAt     DateTime      @updatedAt @map("updated_at")

  instructor    User          @relation(fields: [instructorId], references: [id])
  orderItem     OrderItem     @relation(fields: [orderItemId], references: [id])

  @@index([instructorId])
  @@index([status])
  @@map("earnings")
}

model Withdrawal {
  id           String           @id @default(cuid())
  instructorId String           @map("instructor_id")
  amount       Float
  bankInfo     Json             @map("bank_info")
  status       WithdrawalStatus @default(PENDING)
  reviewedById String?          @map("reviewed_by_id")
  reviewNote   String?          @map("review_note")
  reviewedAt   DateTime?        @map("reviewed_at")

  createdAt    DateTime         @default(now()) @map("created_at")
  updatedAt    DateTime         @updatedAt @map("updated_at")

  instructor   User             @relation("instructor_withdrawals", fields: [instructorId], references: [id])
  reviewedBy   User?            @relation("admin_reviewed_withdrawals", fields: [reviewedById], references: [id])

  @@index([instructorId])
  @@index([status])
  @@map("withdrawals")
}
```

---

## Step 7: Module 4 — Learning (8 models)

```prisma
// ============================================
// MODULE 4: LEARNING
// ============================================

model LessonProgress {
  userId          String   @map("user_id")
  lessonId        String   @map("lesson_id")
  lastPosition    Int      @default(0) @map("last_position")
  watchedSegments Json?    @map("watched_segments")
  watchedPercent  Float    @default(0) @map("watched_percent")
  isCompleted     Boolean  @default(false) @map("is_completed")

  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  lesson          Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@id([userId, lessonId])
  @@map("lesson_progress")
}

model QuizAttempt {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  quizId    String   @map("quiz_id")
  score     Float
  passed    Boolean
  startedAt DateTime @map("started_at")
  endedAt   DateTime? @map("ended_at")

  createdAt DateTime @default(now()) @map("created_at")

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  quiz      Quiz     @relation(fields: [quizId], references: [id], onDelete: Cascade)
  answers   QuizAnswer[]

  @@index([userId, quizId])
  @@map("quiz_attempts")
}

model QuizAnswer {
  id            String       @id @default(cuid())
  attemptId     String       @map("attempt_id")
  questionId    String       @map("question_id")
  selectedOptionId String?   @map("selected_option_id")
  isCorrect     Boolean      @map("is_correct")

  attempt       QuizAttempt  @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  question      QuizQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@index([attemptId])
  @@map("quiz_answers")
}

model Certificate {
  id         String   @id @default(cuid())
  userId     String   @map("user_id")
  courseId   String   @map("course_id")
  certificateUrl String @map("certificate_url")
  verifyCode String   @unique @map("verify_code")

  createdAt  DateTime @default(now()) @map("created_at")

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  course     Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@unique([userId, courseId])
  @@map("certificates")
}

model DailyActivity {
  userId       String   @map("user_id")
  activityDate DateTime @map("activity_date") @db.Date
  lessonsCompleted Int  @default(0) @map("lessons_completed")
  quizzesPassed    Int  @default(0) @map("quizzes_passed")
  minutesSpent     Int  @default(0) @map("minutes_spent")

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, activityDate])
  @@map("daily_activities")
}

model UserSkill {
  id       String   @id @default(cuid())
  userId   String   @map("user_id")
  tagId    String   @map("tag_id")
  level    Float    @default(0)

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tag      Tag      @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@unique([userId, tagId])
  @@map("user_skills")
}

model PlacementQuestion {
  id       String   @id @default(cuid())
  question String
  options  Json
  answer   String
  level    CourseLevel
  tagIds   String[] @map("tag_ids")

  createdAt DateTime @default(now()) @map("created_at")

  @@map("placement_questions")
}

model PlacementTest {
  id       String   @id @default(cuid())
  userId   String   @map("user_id")
  scores   Json
  recommendedLevel CourseLevel @map("recommended_level")

  createdAt DateTime @default(now()) @map("created_at")

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("placement_tests")
}
```

---

## Step 8: Module 5 — Social (12 models)

```prisma
// ============================================
// MODULE 5: SOCIAL
// ============================================

model Post {
  id           String    @id @default(cuid())
  authorId     String    @map("author_id")
  type         PostType  @default(TEXT)
  content      String?
  codeSnippet  Json?     @map("code_snippet")
  linkUrl      String?   @map("link_url")
  groupId      String?   @map("group_id")
  sharedPostId String?   @map("shared_post_id")

  // Denormalized counters
  likeCount    Int       @default(0) @map("like_count")
  commentCount Int       @default(0) @map("comment_count")
  shareCount   Int       @default(0) @map("share_count")

  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  deletedAt    DateTime? @map("deleted_at")

  author       User      @relation(fields: [authorId], references: [id])
  group        Group?    @relation(fields: [groupId], references: [id])
  sharedPost   Post?     @relation("shared_posts", fields: [sharedPostId], references: [id])
  shares       Post[]    @relation("shared_posts")
  images       PostImage[]
  likes        Like[]
  comments     Comment[]
  bookmarks    Bookmark[]
  feedItems    FeedItem[]

  @@index([authorId])
  @@index([groupId])
  @@index([createdAt(sort: Desc)])
  @@map("posts")
}

model PostImage {
  id       String   @id @default(cuid())
  postId   String   @map("post_id")
  url      String
  publicId String?  @map("public_id")
  order    Int      @default(0)

  post     Post     @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@index([postId])
  @@map("post_images")
}

model Like {
  id       String   @id @default(cuid())
  userId   String   @map("user_id")
  postId   String   @map("post_id")

  createdAt DateTime @default(now()) @map("created_at")

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  post     Post     @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@unique([userId, postId])
  @@index([postId])
  @@map("likes")
}

model Comment {
  id       String   @id @default(cuid())
  content  String
  authorId String   @map("author_id")
  postId   String   @map("post_id")
  parentId String?  @map("parent_id")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  author   User     @relation(fields: [authorId], references: [id])
  post     Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  parent   Comment? @relation("nested_comments", fields: [parentId], references: [id], onDelete: Cascade)
  replies  Comment[] @relation("nested_comments")

  @@index([postId])
  @@index([parentId])
  @@map("comments")
}

model Bookmark {
  id       String   @id @default(cuid())
  userId   String   @map("user_id")
  postId   String   @map("post_id")

  createdAt DateTime @default(now()) @map("created_at")

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  post     Post     @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@unique([userId, postId])
  @@map("bookmarks")
}

model Follow {
  followerId  String   @map("follower_id")
  followingId String   @map("following_id")

  createdAt   DateTime @default(now()) @map("created_at")

  follower    User     @relation("follower", fields: [followerId], references: [id], onDelete: Cascade)
  following   User     @relation("following", fields: [followingId], references: [id], onDelete: Cascade)

  @@id([followerId, followingId])
  @@index([followingId])
  @@map("follows")
}

model Conversation {
  id        String               @id @default(cuid())
  isGroup   Boolean              @default(false) @map("is_group")
  name      String?
  avatarUrl String?              @map("avatar_url")

  createdAt DateTime             @default(now()) @map("created_at")
  updatedAt DateTime             @updatedAt @map("updated_at")

  members   ConversationMember[]
  messages  Message[]

  @@map("conversations")
}

model ConversationMember {
  id             String       @id @default(cuid())
  conversationId String       @map("conversation_id")
  userId         String       @map("user_id")
  lastReadAt     DateTime?    @map("last_read_at")

  createdAt      DateTime     @default(now()) @map("created_at")

  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([conversationId, userId])
  @@index([userId])
  @@map("conversation_members")
}

model Message {
  id             String       @id @default(cuid())
  conversationId String       @map("conversation_id")
  senderId       String       @map("sender_id")
  type           MessageType  @default(TEXT)
  content        String
  fileUrl        String?      @map("file_url")
  fileName       String?      @map("file_name")

  createdAt      DateTime     @default(now()) @map("created_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")

  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender         User         @relation(fields: [senderId], references: [id])

  @@index([conversationId, createdAt])
  @@map("messages")
}

model Group {
  id          String        @id @default(cuid())
  name        String
  description String?
  avatarUrl   String?       @map("avatar_url")
  ownerId     String        @map("owner_id")
  courseId    String?       @unique @map("course_id")
  memberCount Int           @default(1) @map("member_count")

  createdAt   DateTime      @default(now()) @map("created_at")
  updatedAt   DateTime      @updatedAt @map("updated_at")

  owner       User          @relation(fields: [ownerId], references: [id])
  course      Course?       @relation(fields: [courseId], references: [id])
  members     GroupMember[]
  posts       Post[]

  @@index([ownerId])
  @@map("groups")
}

model GroupMember {
  id       String    @id @default(cuid())
  groupId  String    @map("group_id")
  userId   String    @map("user_id")
  role     GroupRole @default(MEMBER)

  createdAt DateTime @default(now()) @map("created_at")

  group    Group    @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([groupId, userId])
  @@index([userId])
  @@map("group_members")
}

model FeedItem {
  id       String   @id @default(cuid())
  userId   String   @map("user_id")
  postId   String   @map("post_id")

  createdAt DateTime @default(now()) @map("created_at")

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  post     Post     @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt(sort: Desc)])
  @@index([postId])
  @@map("feed_items")
}
```

---

## Step 9: Module 6 — Q&A Forum (3 models)

```prisma
// ============================================
// MODULE 6: Q&A FORUM
// ============================================

model Question {
  id            String     @id @default(cuid())
  title         String
  content       String
  codeSnippet   Json?      @map("code_snippet")
  authorId      String     @map("author_id")
  courseId      String?    @map("course_id")
  tagId         String?    @map("tag_id")
  bestAnswerId  String?    @unique @map("best_answer_id")

  // Denormalized counters
  viewCount     Int        @default(0) @map("view_count")
  answerCount   Int        @default(0) @map("answer_count")

  createdAt     DateTime   @default(now()) @map("created_at")
  updatedAt     DateTime   @updatedAt @map("updated_at")

  author        User       @relation(fields: [authorId], references: [id])
  course        Course?    @relation(fields: [courseId], references: [id])
  tag           Tag?       @relation(fields: [tagId], references: [id])
  bestAnswer    Answer?    @relation("best_answer", fields: [bestAnswerId], references: [id])
  answers       Answer[]   @relation("question_answers")

  @@index([authorId])
  @@index([courseId])
  @@index([tagId])
  @@index([createdAt(sort: Desc)])
  @@map("questions")
}

model Answer {
  id          String    @id @default(cuid())
  content     String
  codeSnippet Json?     @map("code_snippet")
  authorId    String    @map("author_id")
  questionId  String    @map("question_id")

  // Denormalized counter
  voteCount   Int       @default(0) @map("vote_count")

  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  author      User      @relation(fields: [authorId], references: [id])
  question    Question  @relation("question_answers", fields: [questionId], references: [id], onDelete: Cascade)
  bestForQuestion Question? @relation("best_answer")
  votes       Vote[]

  @@index([questionId])
  @@index([voteCount(sort: Desc)])
  @@map("answers")
}

model Vote {
  id       String   @id @default(cuid())
  userId   String   @map("user_id")
  answerId String   @map("answer_id")
  value    Int      // +1 or -1

  createdAt DateTime @default(now()) @map("created_at")

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  answer   Answer   @relation(fields: [answerId], references: [id], onDelete: Cascade)

  @@unique([userId, answerId])
  @@index([answerId])
  @@map("votes")
}
```

---

## Step 10: Module 7-10 — Notifications, AI, Admin, Recommendation (10 models)

```prisma
// ============================================
// MODULE 7: NOTIFICATIONS
// ============================================

model Notification {
  id          String           @id @default(cuid())
  recipientId String           @map("recipient_id")
  type        NotificationType
  data        Json
  isRead      Boolean          @default(false) @map("is_read")

  createdAt   DateTime         @default(now()) @map("created_at")

  recipient   User             @relation(fields: [recipientId], references: [id], onDelete: Cascade)

  @@index([recipientId, isRead])
  @@index([recipientId, createdAt(sort: Desc)])
  @@map("notifications")
}

// ============================================
// MODULE 8: AI
// ============================================

model AiChatSession {
  id       String          @id @default(cuid())
  userId   String          @map("user_id")
  courseId String          @map("course_id")
  title    String?

  createdAt DateTime       @default(now()) @map("created_at")
  updatedAt DateTime       @updatedAt @map("updated_at")

  user     User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  course   Course          @relation(fields: [courseId], references: [id], onDelete: Cascade)
  messages AiChatMessage[]

  @@index([userId])
  @@index([courseId])
  @@map("ai_chat_sessions")
}

model AiChatMessage {
  id        String        @id @default(cuid())
  sessionId String        @map("session_id")
  role      AiMessageRole
  content   String

  createdAt DateTime      @default(now()) @map("created_at")

  session   AiChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
  @@map("ai_chat_messages")
}

model CourseChunk {
  id       String   @id @default(cuid())
  courseId String   @map("course_id")
  lessonId String?  @map("lesson_id")
  content  String
  // embedding vector(384) — added via raw SQL migration

  createdAt DateTime @default(now()) @map("created_at")

  course   Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  lesson   Lesson?  @relation(fields: [lessonId], references: [id], onDelete: SetNull)

  @@index([courseId])
  @@index([lessonId])
  @@map("course_chunks")
}

// ============================================
// MODULE 9: ADMIN
// ============================================

model Report {
  id           String           @id @default(cuid())
  reporterId   String           @map("reporter_id")
  targetType   ReportTargetType @map("target_type")
  targetId     String           @map("target_id")
  reason       String
  description  String?
  status       ReportStatus     @default(PENDING)
  reviewedById String?          @map("reviewed_by_id")
  reviewNote   String?          @map("review_note")
  reviewedAt   DateTime?        @map("reviewed_at")

  createdAt    DateTime         @default(now()) @map("created_at")
  updatedAt    DateTime         @updatedAt @map("updated_at")

  reporter     User             @relation("reporter", fields: [reporterId], references: [id])
  reviewedBy   User?            @relation("reviewer", fields: [reviewedById], references: [id])

  @@index([targetType, targetId])
  @@index([status])
  @@map("reports")
}

model CommissionTier {
  id         String   @id @default(cuid())
  minRevenue Float    @map("min_revenue")
  rate       Float

  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@map("commission_tiers")
}

model PlatformSetting {
  id    String @id @default(cuid())
  key   String @unique
  value Json

  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("platform_settings")
}

model AnalyticsSnapshot {
  id   String        @id @default(cuid())
  date DateTime      @db.Date
  type AnalyticsType
  data Json

  createdAt DateTime @default(now()) @map("created_at")

  @@unique([date, type])
  @@map("analytics_snapshots")
}

// ============================================
// MODULE 10: RECOMMENDATION
// ============================================

model CourseSimilarity {
  id              String              @id @default(cuid())
  courseId         String              @map("course_id")
  similarCourseId String              @map("similar_course_id")
  score           Float
  algorithm       SimilarityAlgorithm

  createdAt       DateTime            @default(now()) @map("created_at")

  course          Course              @relation("source_course", fields: [courseId], references: [id], onDelete: Cascade)
  similarCourse   Course              @relation("similar_course", fields: [similarCourseId], references: [id], onDelete: Cascade)

  @@unique([courseId, similarCourseId, algorithm])
  @@index([courseId, score(sort: Desc)])
  @@map("course_similarities")
}
```

---

## Step 11: Chạy Migration

### 11.1 Đảm bảo Docker đang chạy

```bash
docker compose up -d
```

### 11.2 Validate schema

```bash
cd apps/api
npx prisma validate
```

### 11.3 Format schema

```bash
npx prisma format
```

### 11.4 Tạo migration

```bash
npx prisma migrate dev --name init_full_schema
```

### 11.5 Generate Prisma Client

```bash
npx prisma generate
```

---

## Step 12: Raw SQL Migrations (tsvector, pgvector)

### 12.1 Tạo file `apps/api/src/prisma/migrations/sql/00-search-vector.sql`

```sql
-- Full-text search for courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_courses_search
  ON courses USING GIN(search_vector);

CREATE OR REPLACE FUNCTION update_course_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.short_description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_courses_search_vector
  BEFORE INSERT OR UPDATE OF title, short_description, description
  ON courses
  FOR EACH ROW
  EXECUTE FUNCTION update_course_search_vector();
```

### 12.2 Tạo file `apps/api/src/prisma/migrations/sql/01-pgvector.sql`

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column (384 dimensions — all-MiniLM-L6-v2)
ALTER TABLE course_chunks ADD COLUMN IF NOT EXISTS embedding vector(384);

-- IVFFlat index
CREATE INDEX IF NOT EXISTS idx_course_chunks_embedding
  ON course_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

### 12.3 Chạy raw SQL

```bash
npx prisma db execute --file src/prisma/migrations/sql/00-search-vector.sql
npx prisma db execute --file src/prisma/migrations/sql/01-pgvector.sql
```

---

## Step 13: Seed Data

### 13.1 Cập nhật `apps/api/package.json`

```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} src/prisma/seed.ts"
  }
}
```

### 13.2 Tạo file `apps/api/src/prisma/seed.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // 1. Admin account
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sslm.com' },
    update: {},
    create: {
      email: 'admin@sslm.com',
      passwordHash: await bcrypt.hash('Admin@123', 12),
      fullName: 'System Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      provider: 'LOCAL',
    },
  });
  console.warn(`Admin created: ${admin.email}`);

  // 2. Categories
  const categoryData = [
    { name: 'Web Development', slug: 'web-development', order: 1 },
    { name: 'Mobile Development', slug: 'mobile-development', order: 2 },
    { name: 'Data Science', slug: 'data-science', order: 3 },
    { name: 'DevOps & Cloud', slug: 'devops-cloud', order: 4 },
    { name: 'Programming Languages', slug: 'programming-languages', order: 5 },
    { name: 'Database', slug: 'database', order: 6 },
    { name: 'UI/UX Design', slug: 'ui-ux-design', order: 7 },
    { name: 'Cybersecurity', slug: 'cybersecurity', order: 8 },
  ];

  for (const cat of categoryData) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.warn(`${categoryData.length} categories created`);

  // 3. Tags
  const tagNames = [
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

  for (const name of tagNames) {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    await prisma.tag.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
  }
  console.warn(`${tagNames.length} tags created`);

  // 4. Commission tiers
  const tiers = [
    { minRevenue: 0, rate: 0.3 },
    { minRevenue: 10000000, rate: 0.25 },
    { minRevenue: 50000000, rate: 0.2 },
  ];

  // Delete existing tiers and recreate
  await prisma.commissionTier.deleteMany();
  for (const tier of tiers) {
    await prisma.commissionTier.create({ data: tier });
  }
  console.warn(`${tiers.length} commission tiers created`);

  // 5. Platform settings
  const settings = [
    { key: 'min_withdrawal_amount', value: 200000 },
    { key: 'order_expiry_minutes', value: 15 },
    { key: 'refund_period_days', value: 7 },
    { key: 'refund_max_progress', value: 0.1 },
    { key: 'ai_daily_limit', value: 10 },
    { key: 'review_min_progress', value: 0.3 },
    { key: 'lesson_complete_threshold', value: 0.8 },
  ];

  for (const s of settings) {
    await prisma.platformSetting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: { key: s.key, value: s.value },
    });
  }
  console.warn(`${settings.length} platform settings created`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

### 13.3 Chạy seed

```bash
npx prisma db seed
```

---

## Step 14: Validate & Verify

### 14.1 Kiểm tra migration status

```bash
npx prisma migrate status
```

### 14.2 Mở Prisma Studio để xem data

```bash
npx prisma studio
```

### 14.3 Đếm models

```bash
# Đếm số model trong schema
grep -c "^model " src/prisma/schema.prisma
# Expected: 61 (bao gồm cả junction tables)
```

### 14.4 Đếm enums

```bash
grep -c "^enum " src/prisma/schema.prisma
# Expected: 30+
```

### 14.5 Checklist

- [ ] 61 models created
- [ ] 30+ enums created
- [ ] All FK indexes added (@@index)
- [ ] All composite keys (@@id) correct
- [ ] All unique constraints (@@unique) correct
- [ ] All @@map() directives for snake_case tables
- [ ] All @map() directives for snake_case columns
- [ ] Migration runs without errors
- [ ] Raw SQL (tsvector, pgvector) executed
- [ ] Seed data created (admin, categories, tags, tiers, settings)
- [ ] Prisma Studio shows all tables
- [ ] Prisma Client generates without errors

### 14.6 Script test tự động (chạy từ `apps/api/`)

```bash
cd apps/api && \
echo "=== 1. Schema Valid ===" && \
npx prisma validate --schema src/prisma/schema.prisma 2>&1 | tail -1 && \
echo "" && \
echo "=== 2. Model Count ===" && \
grep -c "^model " src/prisma/schema.prisma && \
echo "" && \
echo "=== 3. Enum Count ===" && \
grep -c "^enum " src/prisma/schema.prisma && \
echo "" && \
echo "=== 4. Migration Status ===" && \
npx prisma migrate status --schema src/prisma/schema.prisma 2>&1 | grep -E "(up to date|not yet)" && \
echo "" && \
echo "=== 5. DB Tables ===" && \
docker exec sslm-postgres psql -U sslm_user -d sslm_dev -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" && \
echo "" && \
echo "=== 6. Seed Data ===" && \
docker exec sslm-postgres psql -U sslm_user -d sslm_dev -t -c "SELECT 'admin: ' || COUNT(*) FROM users WHERE role = 'ADMIN' UNION ALL SELECT 'categories: ' || COUNT(*) FROM categories UNION ALL SELECT 'tags: ' || COUNT(*) FROM tags UNION ALL SELECT 'tiers: ' || COUNT(*) FROM commission_tiers UNION ALL SELECT 'settings: ' || COUNT(*) FROM platform_settings;" && \
echo "" && \
echo "=== 7. tsvector ===" && \
docker exec sslm-postgres psql -U sslm_user -d sslm_dev -t -c "SELECT column_name || ' (' || data_type || ')' FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'search_vector';" && \
echo "" && \
echo "=== 8. pgvector ===" && \
docker exec sslm-postgres psql -U sslm_user -d sslm_dev -t -c "SELECT column_name || ' (' || udt_name || ')' FROM information_schema.columns WHERE table_name = 'course_chunks' AND column_name = 'embedding';" && \
echo "" && \
echo "=== 9. NestJS Build ===" && \
npx nest build 2>&1 | grep -E "(issues|error|Successfully)"
```

**Expected output:**

```
=== 1. Schema Valid ===
The schema at src/prisma/schema.prisma is valid 🚀

=== 2. Model Count ===
60

=== 3. Enum Count ===
24

=== 4. Migration Status ===
Database schema is up to date!

=== 5. DB Tables ===
    61

=== 6. Seed Data ===
 admin: 1
 categories: 8
 tags: 43
 tiers: 3
 settings: 7

=== 7. tsvector ===
 search_vector (tsvector)

=== 8. pgvector ===
 embedding (vector)

=== 9. NestJS Build ===
>  TSC  Found 0 issues.
Successfully compiled: X files with swc
```
