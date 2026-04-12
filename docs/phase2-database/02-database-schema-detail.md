# Phase 2: DATABASE SCHEMA DETAIL — Smart Social Learning Marketplace

> Chi tiết từng table, từng field, và cách liên kết giữa các module trong hệ thống.
> Tổng cộng: **60 models**, **24 enums**, **10 modules**.

---

## Tổng quan kiến trúc

```
                          +--- Category (tree)
                          |
User --- InstructorProfile|
  |                       |
  +-- Course -------------+
  |     +-- Section -> Chapter -> Lesson -> Media
  |     |                         |          +-- LessonAttachment
  |     |                         +-- Quiz -> QuizQuestion -> QuizOption
  |     +-- CourseTag --> Tag --> UserSkill
  |     +-- Enrollment --> LessonProgress
  |     +-- Review                   +-- QuizAttempt -> QuizAnswer
  |     +-- Wishlist                 +-- Certificate
  |     +-- AiChatSession -> AiChatMessage
  |     +-- CourseChunk (RAG vectors)
  |     +-- CourseSimilarity
  |     +-- Group -> GroupMember
  |
  +-- CartItem -> Order -> OrderItem -> Earning -> Withdrawal
  |                 +-- CouponUsage -> Coupon -> CouponCourse
  |
  +-- Post -> PostImage, Like, Comment (nested), Bookmark, FeedItem
  +-- Follow (self M:N)
  +-- Conversation -> ConversationMember -> Message
  +-- Question -> Answer -> Vote
  +-- Notification
  +-- Report
  +-- DailyActivity
  +-- PlacementTest
```

---

## MODULE 1: AUTH & USERS (4 models)

### 1.1 `users` — Bảng trung tâm của hệ thống

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | Primary key, auto-generate |
| `email` | String UNIQUE | Email đăng nhập |
| `password_hash` | String? | Bcrypt hash (null nếu đăng nhập bằng Google) |
| `full_name` | String | Họ tên hiển thị |
| `avatar_url` | String? | URL ảnh đại diện (Cloudinary) |
| `bio` | String? | Giới thiệu bản thân |
| `role` | Role | `STUDENT` / `INSTRUCTOR` / `ADMIN` |
| `status` | UserStatus | `UNVERIFIED` / `ACTIVE` / `SUSPENDED` |
| `provider` | AuthProvider | `LOCAL` / `GOOGLE` |
| `provider_id` | String? | Google OAuth ID |
| `verification_token` | String? | Token xác thực email |
| `verification_expires_at` | DateTime? | Hết hạn token xác thực |
| `reset_token` | String? | Token reset password |
| `reset_token_expires_at` | DateTime? | Hết hạn token reset |
| `follower_count` | Int (default: 0) | Số người theo dõi (denormalized) |
| `following_count` | Int (default: 0) | Số người đang follow (denormalized) |
| `notification_preferences` | Json? | `{POST_LIKED: {inApp: true, email: false}}` |
| `created_at` | DateTime | Ngày tạo |
| `updated_at` | DateTime | Cập nhật cuối |
| `deleted_at` | DateTime? | Soft delete — ẩn user thay vì xóa |

**User là bảng có nhiều relation nhất** (25+ quan hệ), vì mọi hành động đều gắn với user:

```
User --1:N--> RefreshToken        (đăng nhập nhiều device)
     --1:1--> InstructorProfile   (chỉ instructor có)
     --1:N--> InstructorApplication (nộp đơn làm instructor)
     --1:N--> Course              (instructor tạo khóa)
     --1:N--> Enrollment          (student ghi danh)
     --1:N--> CartItem            (giỏ hàng)
     --1:N--> Order               (đơn hàng)
     --1:N--> Review              (đánh giá khóa học)
     --1:N--> Wishlist            (yêu thích)
     --1:N--> Earning             (thu nhập instructor)
     --1:N--> Withdrawal          (rút tiền)
     --1:N--> Post                (bài viết social)
     --1:N--> Comment             (bình luận)
     --1:N--> Like                (thích bài viết)
     --1:N--> Bookmark            (lưu bài viết)
     --M:N--> Follow              (theo dõi nhau)
     --1:N--> Group               (tạo nhóm)
     --M:N--> GroupMember          (tham gia nhóm)
     --M:N--> ConversationMember   (tham gia chat)
     --1:N--> Message             (gửi tin nhắn)
     --1:N--> Question            (đặt câu hỏi Q&A)
     --1:N--> Answer              (trả lời Q&A)
     --1:N--> Vote                (vote câu trả lời)
     --1:N--> Notification        (nhận thông báo)
     --1:N--> AiChatSession       (chat AI)
     --1:N--> Report              (báo cáo vi phạm)
     --1:N--> LessonProgress      (tiến độ học)
     --1:N--> Certificate         (chứng chỉ)
     --1:N--> DailyActivity       (hoạt động hàng ngày)
     --1:N--> UserSkill           (kỹ năng)
     --1:N--> PlacementTest       (bài kiểm tra đầu vào)
```

---

### 1.2 `refresh_tokens` — Quản lý phiên đăng nhập

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `token` | String UNIQUE | Refresh token value |
| `user_id` | String | FK -> `users.id` |
| `expires_at` | DateTime | Hết hạn (7 ngày) |
| `created_at` | DateTime | Ngày tạo |

**Indexes:** `[userId]`, `[expiresAt]`
**onDelete:** Cascade (xóa user -> xóa hết token)

**Flow:** Login -> tạo accessToken (memory, 15 phút) + refreshToken (httpOnly cookie, 7 ngày). Khi access hết hạn -> dùng refresh để lấy cặp token mới.

---

### 1.3 `instructor_profiles` — Thông tin mở rộng của instructor

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `user_id` | String UNIQUE | FK -> `users.id` (1:1) |
| `headline` | String? | "Senior Developer tại FPT" |
| `biography` | String? | Mô tả chi tiết |
| `expertise` | String[] | `["React", "Node.js", "Python"]` |
| `experience` | String? | Kinh nghiệm làm việc |
| `qualifications` | Json? | `[{name, institution, year}]` |
| `social_links` | Json? | `{github, linkedin, website}` |
| `total_students` | Int (default: 0) | Tổng học viên (denormalized) |
| `total_courses` | Int (default: 0) | Tổng khóa học |
| `total_revenue` | Float (default: 0) | Tổng doanh thu |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

**Tại sao tách riêng?** Không phải user nào cũng là instructor. Chỉ tạo profile khi user được approved làm instructor -> tiết kiệm storage.

---

### 1.4 `instructor_applications` — Đơn đăng ký instructor

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `user_id` | String | FK -> `users.id` (người nộp) |
| `status` | ApplicationStatus | `PENDING` / `APPROVED` / `REJECTED` |
| `expertise` | String[] | Lĩnh vực chuyên môn |
| `experience` | String? | Mô tả kinh nghiệm |
| `motivation` | String? | Lý do muốn dạy |
| `cv_url` | String? | Link CV (Cloudinary) |
| `certificate_urls` | String[] | Bằng cấp, chứng chỉ |
| `reviewed_by_id` | String? | FK -> `users.id` (admin review) |
| `review_note` | String? | Ghi chú của admin |
| `reviewed_at` | DateTime? | Thời điểm review |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

**Flow:** Student nộp đơn (`PENDING`) -> Admin xem xét -> `APPROVED` (tạo InstructorProfile, đổi role) hoặc `REJECTED`.

---

## MODULE 2: COURSE STRUCTURE (10 models)

### Cấu trúc phân cấp 4 tầng

```
Category (Web Development)
  +-- Course (React Masterclass)
        +-- Section (Phần 1: Cơ bản)
              +-- Chapter (Chương 1: JSX)          <-- có thể mua riêng
                    +-- Lesson (Bài 1: JSX là gì?) <-- VIDEO / TEXT / QUIZ
                          +-- Media (video file)
                          +-- LessonAttachment (tài liệu đính kèm)
                          +-- Quiz -> QuizQuestion -> QuizOption
```

---

### 2.1 `categories` — Danh mục (tree structure)

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `name` | String | "Lập trình Web" |
| `slug` | String UNIQUE | "lap-trinh-web" |
| `icon_url` | String? | Icon danh mục |
| `parent_id` | String? | FK -> `categories.id` (self-reference) |
| `order` | Int (default: 0) | Thứ tự hiển thị |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

**Ví dụ tree:**

```
Lập trình         (parent_id = null)
  +-- Web          (parent_id = "Lập trình")
  +-- Mobile       (parent_id = "Lập trình")
  +-- Data Science (parent_id = "Lập trình")
```

---

### 2.2 `tags` + `course_tags` — Tag hệ thống

**tags:**

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `name` | String UNIQUE | "React" |
| `slug` | String UNIQUE | "react" |
| `course_count` | Int (default: 0) | Số khóa gắn tag (denormalized) |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

**course_tags (junction table — quan hệ M:N):**

| Field | Type | Mô tả |
|-------|------|-------|
| `course_id` | String | FK -> `courses.id` |
| `tag_id` | String | FK -> `tags.id` |

**PK:** `(course_id, tag_id)` — composite key

Mỗi course có nhiều tag, mỗi tag gắn nhiều course. Tag cũng được dùng cho Q&A (`questions.tag_id`) và UserSkill (`user_skills.tag_id`).

---

### 2.3 `courses` — Khóa học (core business entity)

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `title` | String | "React Masterclass 2026" |
| `slug` | String UNIQUE | "react-masterclass-2026" |
| `short_description` | String? | Mô tả ngắn (hiện trên card) |
| `description` | String? | Mô tả đầy đủ (rich text) |
| `thumbnail_url` | String? | Ảnh thumbnail (Cloudinary) |
| `promo_video_url` | String? | Video giới thiệu |
| `level` | CourseLevel | `BEGINNER` / `INTERMEDIATE` / `ADVANCED` / `ALL_LEVELS` |
| `language` | String (default: "vi") | Ngôn ngữ khóa học |
| `price` | Float (default: 0) | Giá bán (0 = miễn phí) |
| `original_price` | Float? | Giá gốc (hiện gạch ngang) |
| `status` | CourseStatus | `DRAFT` / `PENDING_REVIEW` / `APPROVED` / `PUBLISHED` / `REJECTED` / `ARCHIVED` |
| `instructor_id` | String | FK -> `users.id` |
| `category_id` | String? | FK -> `categories.id` |
| **Denormalized counters** | | |
| `total_students` | Int (default: 0) | Tổng học viên |
| `total_lessons` | Int (default: 0) | Tổng bài học |
| `total_duration` | Int (default: 0) | Tổng thời lượng (giây) |
| `avg_rating` | Float (default: 0) | Điểm đánh giá trung bình |
| `review_count` | Int (default: 0) | Số lượt đánh giá |
| `view_count` | Int (default: 0) | Lượt xem |
| | | |
| `published_at` | DateTime? | Ngày publish |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |
| `deleted_at` | DateTime? | Soft delete |

**Indexes:** `[instructor_id]`, `[category_id]`, `[status]`, `[avg_rating]`, `[price]`, `[published_at]`

**Course status flow:**

```
DRAFT --> PENDING_REVIEW --> APPROVED --> PUBLISHED
                         --> REJECTED (instructor sửa --> PENDING_REVIEW lại)
PUBLISHED --> ARCHIVED (instructor tự ẩn)
```

**Tại sao denormalize?** Trang browse courses cần hiện `totalStudents`, `avgRating`... cho hàng trăm card. Nếu JOIN + COUNT mỗi lần -> rất chậm. Thay vào đó update atomic (`SET total_students = total_students + 1`) khi có enrollment mới.

---

### 2.4 `sections` — Phần của khóa học

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `title` | String | "Phần 1: React Cơ bản" |
| `order` | Int (default: 0) | Thứ tự trong course |
| `course_id` | String | FK -> `courses.id` |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

---

### 2.5 `chapters` — Chương (có thể mua riêng)

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `title` | String | "Chương 1: JSX & Components" |
| `description` | String? | Mô tả chương |
| `order` | Int (default: 0) | Thứ tự trong section |
| `price` | Float? | Giá mua lẻ (null = không mua lẻ) |
| `is_free_preview` | Boolean (default: false) | Cho xem thử miễn phí? |
| `lessons_count` | Int (default: 0) | Số bài (denormalized) |
| `total_duration` | Int (default: 0) | Tổng thời lượng (giây) |
| `section_id` | String | FK -> `sections.id` |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

---

### 2.6 `lessons` — Bài học

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `title` | String | "Bài 1: JSX là gì?" |
| `type` | LessonType | `VIDEO` / `TEXT` / `QUIZ` |
| `order` | Int (default: 0) | Thứ tự trong chapter |
| `text_content` | String? | Nội dung bài text (rich text) |
| `estimated_duration` | Int? | Thời lượng dự kiến (giây) |
| `chapter_id` | String | FK -> `chapters.id` |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

**Cascade:** Xóa Course -> xóa tất cả Section -> Chapter -> Lesson.

---

### 2.7 `media` — Video/Image trên Cloudinary

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `type` | MediaType | `VIDEO` / `IMAGE` / `ATTACHMENT` |
| `status` | MediaStatus | `UPLOADING` -> `PROCESSING` -> `READY` / `FAILED` |
| `original_name` | String | "bai-1-jsx.mp4" |
| `mime_type` | String | "video/mp4" |
| `size` | Int | File size (bytes) |
| `urls` | Json? | `{original, "480p", "720p", "1080p"}` |
| `public_id` | String? | Cloudinary public ID (để xóa) |
| `duration` | Int? | Thời lượng video (giây) |
| `lesson_id` | String? | FK -> `lessons.id` |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

**Flow upload:** Frontend upload -> Cloudinary -> webhook callback -> API update status `READY` + `urls` JSON với nhiều quality levels.

---

### 2.8 `lesson_attachments` — Tài liệu đính kèm

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `name` | String | "slides-chapter-1.pdf" |
| `url` | String | Cloudinary URL |
| `size` | Int | File size (bytes) |
| `mime_type` | String | "application/pdf" |
| `lesson_id` | String | FK -> `lessons.id` |
| `created_at` | DateTime | |

---

### 2.9 `quizzes` — Bài kiểm tra (1:1 với Lesson type=QUIZ)

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `lesson_id` | String UNIQUE | FK -> `lessons.id` (1:1) |
| `passing_score` | Float (default: 0.7) | Cần đúng 70% để pass |
| `max_attempts` | Int? | Giới hạn số lần làm (null = không giới hạn) |
| `time_limit_seconds` | Int? | Giới hạn thời gian (null = không giới hạn) |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

---

### 2.10 `quiz_questions` — Câu hỏi quiz

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `quiz_id` | String | FK -> `quizzes.id` |
| `question` | String | "React hook nào dùng để..." |
| `explanation` | String? | Giải thích đáp án |
| `order` | Int (default: 0) | Thứ tự câu hỏi |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

---

### 2.11 `quiz_options` — Lựa chọn câu trả lời

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `question_id` | String | FK -> `quiz_questions.id` |
| `text` | String | "useState" |
| `is_correct` | Boolean (default: false) | Đáp án đúng? |
| `order` | Int (default: 0) | Thứ tự option |

---

## MODULE 3: ECOMMERCE (10 models)

### Luồng mua hàng hoàn chỉnh

```
Student browse -> Add to Cart -> Checkout (apply coupon) -> Create Order (PENDING)
    -> Hiện QR SePay -> Student chuyển khoản -> SePay webhook -> Order COMPLETED
    -> Auto tạo Enrollment + Earning cho instructor
```

---

### 3.1 `cart_items` — Giỏ hàng

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `user_id` | String | FK -> `users.id` |
| `course_id` | String? | FK -> `courses.id` (mua cả khóa) |
| `chapter_id` | String? | FK -> `chapters.id` (mua lẻ chapter) |
| `price` | Float | Giá tại thời điểm add |
| `created_at` | DateTime | |

**Lưu ý:** `course_id` HOẶC `chapter_id` — không cả hai. Hỗ trợ mua lẻ từng chapter.

---

### 3.2 `orders` — Đơn hàng

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `user_id` | String | FK -> `users.id` |
| `total_amount` | Float | Tổng trước giảm giá |
| `discount_amount` | Float (default: 0) | Số tiền giảm |
| `final_amount` | Float | Tổng sau giảm = total - discount |
| `status` | OrderStatus | `PENDING` / `COMPLETED` / `EXPIRED` / `REFUNDED` |
| `payment_ref` | String? | Mã giao dịch SePay |
| `expires_at` | DateTime? | Hết hạn thanh toán (30 phút) |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

**Indexes:** `[userId]`, `[status]`, `[expiresAt]`

---

### 3.3 `order_items` — Chi tiết đơn hàng

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `order_id` | String | FK -> `orders.id` |
| `type` | OrderItemType | `COURSE` / `CHAPTER` |
| `course_id` | String? | FK -> `courses.id` |
| `chapter_id` | String? | FK -> `chapters.id` |
| `price` | Float | Giá item tại thời điểm mua |
| `title` | String | Tên khóa/chương (snapshot) |

**Tại sao lưu `title`?** Vì course có thể đổi tên sau. Order history cần giữ tên tại thời điểm mua (snapshot pattern).

---

### 3.4 `enrollments` — Ghi danh học

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `user_id` | String | FK -> `users.id` |
| `course_id` | String | FK -> `courses.id` |
| `type` | EnrollmentType | `FULL` (cả khóa) / `PARTIAL` (1 chapter) |
| `progress` | Float (default: 0) | 0.0 -> 1.0 (0% -> 100%) |
| `created_at` | DateTime | Ngày ghi danh |
| `updated_at` | DateTime | |

**UNIQUE:** `(user_id, course_id)` — mỗi user chỉ enroll 1 lần/course

---

### 3.5 `chapter_purchases` — Mua lẻ chapter

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `user_id` | String | FK -> `users.id` |
| `chapter_id` | String | FK -> `chapters.id` |
| `created_at` | DateTime | |

**UNIQUE:** `(user_id, chapter_id)`

---

### 3.6 `coupons` — Mã giảm giá

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `code` | String UNIQUE | "SUMMER2026" |
| `type` | CouponType | `PERCENTAGE` / `FIXED_AMOUNT` |
| `value` | Float | 20 (= 20% hoặc 20.000đ) |
| `min_order_amount` | Float? | Đơn tối thiểu để áp dụng |
| `max_discount` | Float? | Giảm tối đa (cho PERCENTAGE) |
| `usage_limit` | Int? | Giới hạn lượt dùng (null = không giới hạn) |
| `usage_count` | Int (default: 0) | Đã dùng bao nhiêu lần |
| `start_date` | DateTime | Bắt đầu hiệu lực |
| `end_date` | DateTime | Hết hiệu lực |
| `is_active` | Boolean (default: true) | Instructor có thể tắt |
| `instructor_id` | String | Instructor tạo coupon |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

---

### 3.7 `coupon_courses` — Coupon áp dụng cho course nào (M:N)

| Field | Type | Mô tả |
|-------|------|-------|
| `coupon_id` | String | FK -> `coupons.id` |
| `course_id` | String | FK -> `courses.id` |

**PK:** `(coupon_id, course_id)`

---

### 3.8 `coupon_usages` — Tracking sử dụng coupon

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `coupon_id` | String | FK -> `coupons.id` |
| `order_id` | String UNIQUE | FK -> `orders.id` (1:1 — mỗi order chỉ dùng 1 coupon) |
| `discount` | Float | Số tiền đã giảm |
| `created_at` | DateTime | |

---

### 3.9 `reviews` — Đánh giá khóa học

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `user_id` | String | FK -> `users.id` |
| `course_id` | String | FK -> `courses.id` |
| `rating` | Int | 1-5 sao |
| `comment` | String? | Nội dung đánh giá |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

**UNIQUE:** `(user_id, course_id)` — 1 review/user/course

Khi tạo/sửa review -> update `courses.avg_rating` và `courses.review_count` (denormalized).

---

### 3.10 `wishlists` — Yêu thích

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `user_id` | String | FK -> `users.id` |
| `course_id` | String | FK -> `courses.id` |
| `created_at` | DateTime | |

**UNIQUE:** `(user_id, course_id)`

---

### 3.11 `earnings` — Doanh thu instructor

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `instructor_id` | String | FK -> `users.id` |
| `order_item_id` | String UNIQUE | FK -> `order_items.id` (1:1) |
| `amount` | Float | Giá bán gốc |
| `commission_rate` | Float | 0.15 (15% hoa hồng platform) |
| `commission_amount` | Float | `amount * commission_rate` |
| `net_amount` | Float | `amount - commission_amount` |
| `status` | EarningStatus | `PENDING` (hold 30 ngày) -> `AVAILABLE` -> `WITHDRAWN` |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

---

### 3.12 `withdrawals` — Rút tiền

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `instructor_id` | String | FK -> `users.id` |
| `amount` | Float | Số tiền rút |
| `bank_info` | Json | `{bankName, accountNumber, accountName}` |
| `status` | WithdrawalStatus | `PENDING` -> `PROCESSING` -> `COMPLETED` / `REJECTED` |
| `reviewed_by_id` | String? | FK -> `users.id` (admin) |
| `review_note` | String? | Ghi chú admin |
| `reviewed_at` | DateTime? | |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

**Revenue flow:**

```
Student mua -> OrderItem -> Earning (PENDING, hold 30 ngày)
  -> 30 ngày sau -> cron job chuyển AVAILABLE
  -> Instructor request -> Withdrawal (PENDING)
  -> Admin approve -> chuyển khoản -> COMPLETED -> Earning = WITHDRAWN
```

---

## MODULE 4: LEARNING (7 models)

### 4.1 `lesson_progress` — Tiến độ học video

| Field | Type | Mô tả |
|-------|------|-------|
| `user_id` | String | FK -> `users.id` |
| `lesson_id` | String | FK -> `lessons.id` |
| `last_position` | Int (default: 0) | Vị trí video cuối cùng (giây) |
| `watched_segments` | Json? | `[[0,240],[480,960]]` — đoạn đã xem |
| `watched_percent` | Float (default: 0) | % đã xem thực tế |
| `is_completed` | Boolean (default: false) | Đã hoàn thành? (>=90% = done) |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

**PK:** `(user_id, lesson_id)` — composite key, không cần id riêng

**Tại sao `watched_segments`?** Chống gian lận — student không thể tua đến cuối rồi báo "đã xem". Hệ thống track từng đoạn đã xem thật sự. Ví dụ `[[0,240],[480,960]]` = xem từ 0:00-4:00 và 8:00-16:00, bỏ qua 4:00-8:00.

---

### 4.2 `quiz_attempts` — Lần làm quiz

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `user_id` | String | FK -> `users.id` |
| `quiz_id` | String | FK -> `quizzes.id` |
| `score` | Float | 0.0-1.0 (tỷ lệ đúng) |
| `passed` | Boolean | `score >= passing_score`? |
| `started_at` | DateTime | Bắt đầu làm |
| `ended_at` | DateTime? | Kết thúc (null = đang làm) |
| `created_at` | DateTime | |

---

### 4.3 `quiz_answers` — Câu trả lời của student

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `attempt_id` | String | FK -> `quiz_attempts.id` |
| `question_id` | String | FK -> `quiz_questions.id` |
| `selected_option_id` | String? | Option student chọn |
| `is_correct` | Boolean | Đúng hay sai? |

---

### 4.4 `certificates` — Chứng chỉ hoàn thành

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `user_id` | String | FK -> `users.id` |
| `course_id` | String | FK -> `courses.id` |
| `certificate_url` | String | PDF/Image trên Cloudinary |
| `verify_code` | String UNIQUE | "CERT-ABC123" (xác thực) |
| `created_at` | DateTime | Ngày cấp |

**UNIQUE:** `(user_id, course_id)` — 1 cert/user/course

Auto-generate khi enrollment progress = 100%.

---

### 4.5 `daily_activities` — Learning streak

| Field | Type | Mô tả |
|-------|------|-------|
| `user_id` | String | FK -> `users.id` |
| `activity_date` | Date | Ngày (không có giờ) |
| `lessons_completed` | Int (default: 0) | Số bài hoàn thành trong ngày |
| `quizzes_passed` | Int (default: 0) | Số quiz pass trong ngày |
| `minutes_spent` | Int (default: 0) | Phút học trong ngày |

**PK:** `(user_id, activity_date)` — mỗi ngày 1 record

Dùng để hiện learning streak (giống GitHub contribution graph) và thống kê "bạn đã học X phút hôm nay".

---

### 4.6 `user_skills` — Skill level theo tag

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `user_id` | String | FK -> `users.id` |
| `tag_id` | String | FK -> `tags.id` (ví dụ: "React") |
| `level` | Float (default: 0) | 0.0-1.0 (trình độ) |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

**UNIQUE:** `(user_id, tag_id)`

Phục vụ recommendation — gợi ý khóa học dựa trên skill hiện tại.

---

### 4.7 `placement_questions` — Ngân hàng câu hỏi đầu vào

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `question` | String | Nội dung câu hỏi |
| `options` | Json | `[{id, text}]` |
| `answer` | String | ID đáp án đúng |
| `level` | CourseLevel | Độ khó câu hỏi |
| `tag_ids` | String[] | Thuộc tag nào |
| `created_at` | DateTime | |

---

### 4.8 `placement_tests` — Bài kiểm tra đầu vào

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `user_id` | String | FK -> `users.id` |
| `scores` | Json | `{beginner: 5, intermediate: 3}` |
| `recommended_level` | CourseLevel | Kết quả đề xuất |
| `created_at` | DateTime | |

---

## MODULE 5: SOCIAL (12 models)

### 5.1 `posts` — Bài viết

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `author_id` | String | FK -> `users.id` |
| `type` | PostType | `TEXT` / `CODE` / `LINK` / `SHARED` |
| `content` | String? | Nội dung text |
| `code_snippet` | Json? | `{language: "js", code: "..."}` |
| `link_url` | String? | URL khi type=LINK |
| `group_id` | String? | FK -> `groups.id` (null = public feed) |
| `shared_post_id` | String? | FK -> `posts.id` (repost/share) |
| **Denormalized counters** | | |
| `like_count` | Int (default: 0) | |
| `comment_count` | Int (default: 0) | |
| `share_count` | Int (default: 0) | |
| | | |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |
| `deleted_at` | DateTime? | Soft delete |

---

### 5.2 `post_images` — Nhiều ảnh/post

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `post_id` | String | FK -> `posts.id` |
| `url` | String | Cloudinary URL |
| `public_id` | String? | Để xóa trên Cloudinary |
| `order` | Int (default: 0) | Thứ tự ảnh |

---

### 5.3 `likes` — Thích bài viết

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `user_id` | String | FK -> `users.id` |
| `post_id` | String | FK -> `posts.id` |
| `created_at` | DateTime | |

**UNIQUE:** `(user_id, post_id)` — like 1 lần/post

---

### 5.4 `comments` — Bình luận (nested tree)

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `content` | String | Nội dung comment |
| `author_id` | String | FK -> `users.id` |
| `post_id` | String | FK -> `posts.id` |
| `parent_id` | String? | FK -> `comments.id` (reply — self-reference) |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

`parent_id` cho phép nested replies: Comment A -> Reply B -> Reply C.

---

### 5.5 `bookmarks` — Lưu bài viết

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `user_id` | String | FK -> `users.id` |
| `post_id` | String | FK -> `posts.id` |
| `created_at` | DateTime | |

**UNIQUE:** `(user_id, post_id)`

---

### 5.6 `follows` — Theo dõi (self M:N)

| Field | Type | Mô tả |
|-------|------|-------|
| `follower_id` | String | FK -> `users.id` (người follow) |
| `following_id` | String | FK -> `users.id` (người được follow) |
| `created_at` | DateTime | |

**PK:** `(follower_id, following_id)`

User A follow User B: `follower_id=A, following_id=B`. Khi tạo/xóa -> update denormalized count trên cả 2 user.

---

### 5.7 `feed_items` — News feed (fan-out on write)

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `user_id` | String | Người nhận feed |
| `post_id` | String | FK -> `posts.id` |
| `created_at` | DateTime | Để sort theo thời gian |

**Index:** `(user_id, created_at DESC)`

**Thuật toán fan-out:** Khi User A đăng post -> lấy tất cả followers của A -> tạo FeedItem cho mỗi follower. Khi User B mở feed -> `SELECT * FROM feed_items WHERE user_id = B ORDER BY created_at DESC`.

---

### 5.8 `conversations` — Cuộc hội thoại

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `is_group` | Boolean (default: false) | false = DM, true = group chat |
| `name` | String? | Tên nhóm chat (null cho DM) |
| `avatar_url` | String? | Ảnh nhóm chat |
| `created_at` | DateTime | |
| `updated_at` | DateTime | Cập nhật khi có tin nhắn mới |

---

### 5.9 `conversation_members` — Thành viên cuộc hội thoại

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `conversation_id` | String | FK -> `conversations.id` |
| `user_id` | String | FK -> `users.id` |
| `last_read_at` | DateTime? | Lần đọc cuối (tính unread) |
| `created_at` | DateTime | |

**UNIQUE:** `(conversation_id, user_id)`

**Unread count:** `SELECT COUNT(*) FROM messages WHERE conversation_id = X AND created_at > member.last_read_at`

---

### 5.10 `messages` — Tin nhắn

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `conversation_id` | String | FK -> `conversations.id` |
| `sender_id` | String | FK -> `users.id` |
| `type` | MessageType | `TEXT` / `IMAGE` / `CODE` / `FILE` |
| `content` | String | Nội dung tin nhắn |
| `file_url` | String? | URL file đính kèm |
| `file_name` | String? | Tên file gốc |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

**Index:** `(conversation_id, created_at)` — load tin nhắn theo thời gian

---

### 5.11 `groups` — Nhóm học tập

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `name` | String | "React Learners VN" |
| `description` | String? | Mô tả nhóm |
| `avatar_url` | String? | Ảnh đại diện nhóm |
| `owner_id` | String | FK -> `users.id` (người tạo) |
| `course_id` | String? UNIQUE | FK -> `courses.id` (1:1 — mỗi course chỉ có 1 group) |
| `member_count` | Int (default: 1) | Denormalized |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

`course_id` UNIQUE -> mỗi course chỉ có 1 group. Auto-create group khi course published.

---

### 5.12 `group_members` — Thành viên nhóm

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `group_id` | String | FK -> `groups.id` |
| `user_id` | String | FK -> `users.id` |
| `role` | GroupRole | `OWNER` / `ADMIN` / `MEMBER` |
| `created_at` | DateTime | |

**UNIQUE:** `(group_id, user_id)`

---

## MODULE 6: Q&A FORUM (3 models)

### 6.1 `questions` — Câu hỏi

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `title` | String | "Cách dùng useEffect đúng?" |
| `content` | String | Chi tiết câu hỏi |
| `code_snippet` | Json? | `{language: "tsx", code: "..."}` |
| `author_id` | String | FK -> `users.id` |
| `course_id` | String? | FK -> `courses.id` (hỏi về khóa nào) |
| `tag_id` | String? | FK -> `tags.id` (chủ đề) |
| `best_answer_id` | String? UNIQUE | FK -> `answers.id` (1:1 — accepted answer) |
| **Denormalized** | | |
| `view_count` | Int (default: 0) | |
| `answer_count` | Int (default: 0) | |
| | | |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

---

### 6.2 `answers` — Câu trả lời

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `content` | String | Nội dung câu trả lời |
| `code_snippet` | Json? | `{language, code}` |
| `author_id` | String | FK -> `users.id` |
| `question_id` | String | FK -> `questions.id` |
| `vote_count` | Int (default: 0) | Tổng vote (denormalized) |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

---

### 6.3 `votes` — Vote câu trả lời

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `user_id` | String | FK -> `users.id` |
| `answer_id` | String | FK -> `answers.id` |
| `value` | Int | `+1` (upvote) hoặc `-1` (downvote) |
| `created_at` | DateTime | |

**UNIQUE:** `(user_id, answer_id)` — 1 vote/user/answer

**Flow:** Question -> nhiều Answer -> author chọn bestAnswer. Users vote answer (+1/-1). Sort answer by `vote_count DESC`.

---

## MODULE 7: NOTIFICATIONS (1 model)

### 7.1 `notifications`

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `recipient_id` | String | FK -> `users.id` (người nhận) |
| `type` | NotificationType | 14 loại (xem bên dưới) |
| `data` | Json | Flexible payload |
| `is_read` | Boolean (default: false) | Đã đọc? |
| `created_at` | DateTime | |

**Indexes:** `(recipient_id, is_read)`, `(recipient_id, created_at DESC)`

**14 notification types và data payload:**

| Type | Data payload | Gửi cho |
|------|-------------|---------|
| `FOLLOW` | `{actorId, actorName}` | Người được follow |
| `POST_LIKE` | `{actorId, postId}` | Author post |
| `POST_COMMENT` | `{actorId, postId, commentId}` | Author post |
| `COURSE_ENROLLED` | `{courseId, studentId}` | Instructor |
| `COURSE_APPROVED` | `{courseId}` | Instructor |
| `COURSE_REJECTED` | `{courseId, reason}` | Instructor |
| `ORDER_COMPLETED` | `{orderId}` | Student |
| `ORDER_EXPIRED` | `{orderId}` | Student |
| `NEW_MESSAGE` | `{conversationId, senderId}` | Người nhận tin |
| `QUESTION_ANSWERED` | `{questionId, answerId}` | Author question |
| `ANSWER_VOTED` | `{answerId, voterId}` | Author answer |
| `WITHDRAWAL_COMPLETED` | `{withdrawalId, amount}` | Instructor |
| `WITHDRAWAL_REJECTED` | `{withdrawalId, reason}` | Instructor |
| `SYSTEM` | `{title, message}` | Broadcast |

**`data` JSON flexible** — mỗi type có payload khác nhau. Frontend đọc `type` -> render UI tương ứng + dùng `data` để tạo link/message.

---

## MODULE 8: AI TUTOR — RAG (3 models)

### 8.1 `ai_chat_sessions` — Phiên chat AI

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `user_id` | String | FK -> `users.id` |
| `course_id` | String | FK -> `courses.id` (hỏi về khóa nào) |
| `title` | String? | Auto-generate từ câu hỏi đầu tiên |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

---

### 8.2 `ai_chat_messages` — Tin nhắn trong phiên AI

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `session_id` | String | FK -> `ai_chat_sessions.id` |
| `role` | AiMessageRole | `USER` / `ASSISTANT` |
| `content` | String | Nội dung tin nhắn |
| `created_at` | DateTime | |

---

### 8.3 `course_chunks` — RAG knowledge base

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `course_id` | String | FK -> `courses.id` |
| `lesson_id` | String? | FK -> `lessons.id` (chunk từ bài nào) |
| `content` | String | Text chunk (~500 tokens) |
| *(embedding)* | *vector(384)* | *pgvector, added via raw SQL migration* |
| `created_at` | DateTime | |

**RAG flow:**

```
Student hỏi "useEffect cleanup function là gì?"
  -> Embed câu hỏi -> vector search course_chunks (cosine similarity)
  -> Lấy top-5 chunks liên quan
  -> Gửi context + question -> Groq (Llama 3.3 70B)
  -> Trả lời dựa trên nội dung khóa học
```

---

## MODULE 9: ADMIN (4 models)

### 9.1 `reports` — Báo cáo vi phạm (polymorphic)

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `reporter_id` | String | FK -> `users.id` (người báo cáo) |
| `target_type` | ReportTargetType | `USER` / `COURSE` / `POST` / `COMMENT` / `QUESTION` / `ANSWER` / `MESSAGE` |
| `target_id` | String | ID của entity bị report |
| `reason` | String | "Spam" / "Nội dung xấu" |
| `description` | String? | Chi tiết |
| `status` | ReportStatus | `PENDING` -> `REVIEWED` / `ACTION_TAKEN` / `DISMISSED` |
| `reviewed_by_id` | String? | FK -> `users.id` (admin) |
| `review_note` | String? | Ghi chú admin |
| `reviewed_at` | DateTime? | |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

**Index:** `(target_type, target_id)`, `(status)`

**Polymorphic pattern:** Thay vì tạo 7 bảng report riêng (UserReport, CourseReport...), dùng 1 bảng với `target_type` + `target_id`. Query: `WHERE target_type = 'POST' AND target_id = 'xxx'`.

---

### 9.2 `commission_tiers` — Bậc hoa hồng

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `min_revenue` | Float | Ngưỡng doanh thu |
| `rate` | Float | Tỷ lệ hoa hồng |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

**Ví dụ:**

| min_revenue | rate | Ý nghĩa |
|-------------|------|---------|
| 0 | 0.15 | Dưới 10M -> 15% hoa hồng |
| 10000000 | 0.12 | 10M-50M -> 12% hoa hồng |
| 50000000 | 0.10 | Trên 50M -> 10% hoa hồng |

Instructor bán được nhiều -> hoa hồng giảm -> khuyến khích bán nhiều hơn.

---

### 9.3 `platform_settings` — Cấu hình hệ thống (key-value)

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `key` | String UNIQUE | "maintenance_mode", "min_withdrawal_amount" |
| `value` | Json | `true`, `{message: "..."}`, `50000` |
| `updated_at` | DateTime | |

---

### 9.4 `analytics_snapshots` — Dữ liệu thống kê hàng ngày

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `date` | Date | Ngày thống kê |
| `type` | AnalyticsType | `DAILY_USERS` / `DAILY_REVENUE` / `DAILY_ENROLLMENTS` / `DAILY_COURSES` |
| `data` | Json | `{count: 150, details: {...}}` |
| `created_at` | DateTime | |

**UNIQUE:** `(date, type)` — mỗi ngày 1 snapshot/type

Cron job chạy lúc 00:00 hàng ngày -> tính toán thống kê -> lưu vào bảng này. Admin dashboard đọc từ bảng này thay vì query realtime (nhanh hơn nhiều).

---

## MODULE 10: RECOMMENDATION (1 model)

### 10.1 `course_similarities` — Độ tương tự giữa các khóa học (pre-computed)

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | String (CUID) | PK |
| `course_id` | String | FK -> `courses.id` (nguồn) |
| `similar_course_id` | String | FK -> `courses.id` (tương tự) |
| `score` | Float | 0.0-1.0 (độ tương tự) |
| `algorithm` | SimilarityAlgorithm | `CONTENT` / `COLLABORATIVE` / `HYBRID` |
| `created_at` | DateTime | |

**UNIQUE:** `(course_id, similar_course_id, algorithm)`
**Index:** `(course_id, score DESC)`

**3 thuật toán:**

| Algorithm | Cách tính | Mô tả |
|-----------|----------|-------|
| `CONTENT` | Cosine similarity | So sánh description, tags, category |
| `COLLABORATIVE` | Co-purchase pattern | Users mua course A cũng mua course B |
| `HYBRID` | Weighted average | Kết hợp cả 2 |

Cron job chạy hàng đêm -> tính similarity -> lưu vào bảng này. Frontend query: `WHERE course_id = X ORDER BY score DESC LIMIT 6`.

---

## ENUMS THAM CHIẾU

### Auth & Users

```
Role:              STUDENT, INSTRUCTOR, ADMIN
UserStatus:        UNVERIFIED, ACTIVE, SUSPENDED
AuthProvider:      LOCAL, GOOGLE
ApplicationStatus: PENDING, APPROVED, REJECTED
```

### Course

```
CourseLevel:  BEGINNER, INTERMEDIATE, ADVANCED, ALL_LEVELS
CourseStatus: DRAFT, PENDING_REVIEW, APPROVED, PUBLISHED, REJECTED, ARCHIVED
LessonType:  VIDEO, TEXT, QUIZ
MediaType:   VIDEO, IMAGE, ATTACHMENT
MediaStatus: UPLOADING, PROCESSING, READY, FAILED
```

### Ecommerce

```
OrderStatus:      PENDING, COMPLETED, EXPIRED, REFUNDED
OrderItemType:    COURSE, CHAPTER
EnrollmentType:   FULL, PARTIAL
CouponType:       PERCENTAGE, FIXED_AMOUNT
EarningStatus:    PENDING, AVAILABLE, WITHDRAWN
WithdrawalStatus: PENDING, PROCESSING, COMPLETED, REJECTED
```

### Social

```
PostType:    TEXT, CODE, LINK, SHARED
MessageType: TEXT, IMAGE, CODE, FILE
GroupRole:    OWNER, ADMIN, MEMBER
```

### Others

```
NotificationType:    FOLLOW, POST_LIKE, POST_COMMENT, COURSE_ENROLLED,
                     COURSE_APPROVED, COURSE_REJECTED, ORDER_COMPLETED,
                     ORDER_EXPIRED, NEW_MESSAGE, QUESTION_ANSWERED,
                     ANSWER_VOTED, WITHDRAWAL_COMPLETED, WITHDRAWAL_REJECTED,
                     SYSTEM

AiMessageRole:       USER, ASSISTANT
ReportTargetType:    USER, COURSE, POST, COMMENT, QUESTION, ANSWER, MESSAGE
ReportStatus:        PENDING, REVIEWED, ACTION_TAKEN, DISMISSED
SimilarityAlgorithm: CONTENT, COLLABORATIVE, HYBRID
AnalyticsType:       DAILY_USERS, DAILY_REVENUE, DAILY_ENROLLMENTS, DAILY_COURSES
```

---

## DESIGN PATTERNS SỬ DỤNG

### 1. Denormalized Counters

Thay vì `COUNT(*)` mỗi lần query (chậm trên large tables), lưu counter trực tiếp:

| Model | Counters |
|-------|----------|
| User | `follower_count`, `following_count` |
| Course | `total_students`, `total_lessons`, `total_duration`, `avg_rating`, `review_count`, `view_count` |
| Chapter | `lessons_count`, `total_duration` |
| Tag | `course_count` |
| Post | `like_count`, `comment_count`, `share_count` |
| Group | `member_count` |
| Question | `view_count`, `answer_count` |
| Answer | `vote_count` |
| Coupon | `usage_count` |
| InstructorProfile | `total_students`, `total_courses`, `total_revenue` |

Update counter bằng atomic operation: `SET count = count + 1`. Consistency check bằng cron job weekly (reconcile).

### 2. Soft Delete

Áp dụng cho 3 entities quan trọng (có `deleted_at` field):

- **User** — không xóa thật, ẩn khỏi hệ thống
- **Course** — instructor ẩn khóa, admin remove
- **Post** — xóa post nhưng giữ data cho audit

Các entity khác: Hard delete (`CASCADE` từ parent).

### 3. JSON Fields

Dùng JSONB cho data linh hoạt, ít query:

| Field | Ví dụ |
|-------|-------|
| `User.notificationPreferences` | `{POST_LIKED: {inApp: true, email: false}}` |
| `InstructorProfile.qualifications` | `[{name, institution, year}]` |
| `InstructorProfile.socialLinks` | `{github, linkedin, website}` |
| `Media.urls` | `{original, "480p", "720p"}` |
| `LessonProgress.watchedSegments` | `[[0,240],[480,960]]` |
| `Withdrawal.bankInfo` | `{bankName, accountNumber, accountName}` |
| `Post.codeSnippet` | `{language, code}` |
| `Notification.data` | `{actorId, targetId, message, url}` |
| `PlacementQuestion.options` | `[{id, text}]` |
| `PlacementTest.scores` | `{beginner: 5, intermediate: 3}` |
| `AnalyticsSnapshot.data` | Flexible analytics |
| `PlatformSetting.value` | Any JSON value |

### 4. Composite Primary Keys

Dùng cho junction tables và progress tracking:

| Table | PK |
|-------|----|
| `course_tags` | `(course_id, tag_id)` |
| `coupon_courses` | `(coupon_id, course_id)` |
| `follows` | `(follower_id, following_id)` |
| `lesson_progress` | `(user_id, lesson_id)` |
| `daily_activities` | `(user_id, activity_date)` |

### 5. Polymorphic Pattern

`reports` table dùng `target_type` + `target_id` thay vì tạo nhiều bảng riêng:

```sql
-- Tìm tất cả report của 1 post
SELECT * FROM reports WHERE target_type = 'POST' AND target_id = 'xxx';
```

### 6. Fan-out on Write (Feed)

`feed_items` table phục vụ news feed:

```
User A đăng post
  -> Lấy tất cả followers của A
  -> Tạo 1 FeedItem cho MỖI follower
  -> Khi User B mở feed: SELECT * FROM feed_items WHERE user_id = B ORDER BY created_at DESC
```

Nhanh khi đọc (chỉ 1 query), chậm khi viết (tạo nhiều records), phù hợp cho hệ thống có nhiều đọc hơn viết.

---

## SO SÁNH DATABASE VS FRONTEND PAGES

| Frontend Page | Models cần | Status |
|---------------|-----------|--------|
| Homepage (courses, categories) | Course, Category | Có đủ |
| Course browse (filter, search) | Course, Category, Tag, CourseTag | Có đủ |
| Course detail (reviews, curriculum) | Course, Section, Chapter, Lesson, Review | Có đủ |
| My Learning (progress, certificates) | Enrollment, LessonProgress, Certificate | Có đủ |
| Learning page (video, quiz) | Lesson, Media, Quiz, QuizQuestion, LessonProgress | Có đủ |
| Cart -> Checkout -> Payment | CartItem, Order, OrderItem, Coupon | Có đủ |
| Wishlist | Wishlist | Có đủ |
| Orders history | Order, OrderItem | Có đủ |
| Social feed | Post, Like, Comment, FeedItem, Follow | Có đủ |
| Groups | Group, GroupMember, Post | Có đủ |
| Chat | Conversation, ConversationMember, Message | Có đủ |
| Q&A | Question, Answer, Vote, Tag | Có đủ |
| AI Tutor | AiChatSession, AiChatMessage, CourseChunk | Có đủ |
| Profile / Settings | User, InstructorProfile | Có đủ |
| Notifications | Notification | Có đủ |
| Become instructor | InstructorApplication | Có đủ |
| Instructor dashboard | Course, Earning, Enrollment | Có đủ |
| Instructor coupons | Coupon, CouponCourse | Có đủ |
| Instructor withdrawals | Withdrawal, Earning | Có đủ |
| Admin users/reports/categories | User, Report, Category | Có đủ |
| Admin approvals | InstructorApplication, Course | Có đủ |
| Admin analytics | AnalyticsSnapshot | Có đủ |
| Admin settings | PlatformSetting, CommissionTier | Có đủ |
