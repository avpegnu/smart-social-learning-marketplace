# 2. API ENDPOINTS — Chi tiết từng Module

> Tổng cộng: **~150 endpoints** | Format: REST JSON | Auth: JWT Bearer Token
> Base URL: `/api` | Swagger docs: `/api/docs`

---

# MODULE 1: AUTHENTICATION & AUTHORIZATION

## AUTH — `/api/auth`

### POST `/api/auth/register` — Đăng ký tài khoản

- **Auth:** Public
- **Rate limit:** 3 req/min per IP

```typescript
// Request Body
{
  "email": "user@example.com",        // @IsEmail
  "password": "Password123",          // @MinLength(8), @Matches(/[A-Z].*\d/)
  "fullName": "Nguyễn Văn A"          // @MinLength(2), @MaxLength(100)
}

// Response 201
{
  "message": "Đăng ký thành công. Vui lòng kiểm tra email để xác nhận tài khoản."
}
```

**Business Logic:**

1. Validate input (class-validator)
2. Check email unique (Prisma unique constraint → catch P2002)
3. Hash password: `bcrypt.hash(password, 12)`
4. Generate verification token: `crypto.randomUUID()`
5. Create user: `status: UNVERIFIED, verificationToken, verificationExpiresAt: now + 24h`
6. Queue email job: verification link `${STUDENT_PORTAL_URL}/auth/verify?token=xxx`
7. Return 201

---

### POST `/api/auth/login` — Đăng nhập

- **Auth:** Public
- **Rate limit:** 5 req/min per IP (Redis counter: `login_attempts:{ip}`)

```typescript
// Request Body
{
  "email": "user@example.com",
  "password": "Password123"
}

// Response 200
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "clx...",
      "email": "user@example.com",
      "fullName": "Nguyễn Văn A",
      "role": "STUDENT",
      "avatarUrl": null
    }
  }
}
// + Set-Cookie: refreshToken=uuid; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=604800
```

**Business Logic:**

1. Find user by email → 401 nếu không tồn tại
2. Check `status === ACTIVE` → 401 "Tài khoản chưa xác nhận" hoặc "Tài khoản bị khóa"
3. `bcrypt.compare(password, user.passwordHash)` → 401 nếu sai
4. Check rate limit (Redis): `login_attempts:{ip}` < 5 → 429 nếu quá
5. Generate access token: JWT `{ userId, role }`, TTL 15 phút
6. Generate refresh token: UUID, lưu DB `refresh_tokens`, TTL 7 ngày
7. Set refresh token vào httpOnly cookie
8. Return access token + user info

---

### POST `/api/auth/refresh` — Refresh access token

- **Auth:** Public (dùng refresh token từ cookie)

```typescript
// Request: Cookie refreshToken=uuid

// Response 200
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
// + Set-Cookie: refreshToken=new-uuid (rotation)
```

**Business Logic:**

1. Lấy refresh token từ cookie
2. Tìm trong DB `refresh_tokens` → 401 nếu không tồn tại / hết hạn
3. **Token Rotation:** Xóa token cũ + tạo token mới
4. Generate access token mới
5. Set cookie mới

---

### POST `/api/auth/logout` — Đăng xuất

- **Auth:** Authenticated

```typescript
// Response 200
{ "message": "Đăng xuất thành công" }
// + Clear-Cookie: refreshToken
```

**Business Logic:**

1. Xóa refresh token khỏi DB
2. Clear cookie

---

### GET `/api/auth/verify?token=xxx` — Xác nhận email

- **Auth:** Public

```typescript
// Response 200
{ "message": "Xác nhận email thành công. Bạn có thể đăng nhập." }

// Response 400
{ "message": "Link xác nhận không hợp lệ hoặc đã hết hạn." }
```

**Business Logic:**

1. Find user by `verificationToken`
2. Check `verificationExpiresAt > now()`
3. Update: `status: ACTIVE, verificationToken: null`

---

### POST `/api/auth/forgot-password` — Quên mật khẩu

- **Auth:** Public
- **Rate limit:** 3 req/hour per email

```typescript
// Request Body
{ "email": "user@example.com" }

// Response 200 (luôn trả 200 để không leak email tồn tại)
{ "message": "Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu." }
```

---

### POST `/api/auth/reset-password` — Đặt lại mật khẩu

- **Auth:** Public

```typescript
// Request Body
{
  "token": "reset-token-uuid",
  "password": "NewPassword123"
}

// Response 200
{ "message": "Mật khẩu đã được đặt lại thành công." }
```

---

### POST `/api/auth/google` — Đăng nhập Google OAuth

- **Auth:** Public

```typescript
// Request Body
{ "idToken": "google-id-token" }

// Response 200 — giống /login response
```

**Business Logic:**

1. Verify Google ID token (google-auth-library)
2. Extract email, name, picture
3. Find or create user: `provider: GOOGLE, providerId: googleId, status: ACTIVE`
4. Generate tokens (giống /login)

---

### POST `/api/auth/cross-portal-token` — Tạo One-Time Token (cross-portal)

- **Auth:** Instructor, Admin

```typescript
// Response 200
{
  "data": {
    "ott": "one-time-token-uuid",
    "redirectUrl": "https://manage.example.com/auth/callback?ott=xxx"
  }
}
```

**Business Logic:**

1. Generate OTT (UUID), lưu Redis: `ott:{token}` → userId, TTL 30 giây
2. Return OTT + redirect URL

---

### POST `/api/auth/exchange-ott` — Đổi OTT lấy tokens

- **Auth:** Public

```typescript
// Request Body
{ "ott": "one-time-token-uuid" }

// Response 200 — giống /login response
```

**Business Logic:**

1. Tìm OTT trong Redis → 401 nếu không tồn tại / hết hạn
2. Xóa OTT (single use)
3. Generate tokens cho user

---

# MODULE 2: USER PROFILE

## USERS — `/api/users`

### GET `/api/users/me` — Lấy profile bản thân

- **Auth:** Authenticated

```typescript
// Response 200
{
  "data": {
    "id": "clx...",
    "email": "user@example.com",
    "fullName": "Nguyễn Văn A",
    "avatarUrl": "https://res.cloudinary.com/...",
    "bio": "Sinh viên CNTT...",
    "role": "STUDENT",
    "status": "ACTIVE",
    "followerCount": 25,
    "followingCount": 18,
    "notificationPreferences": { ... },
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### PUT `/api/users/me` — Cập nhật profile

- **Auth:** Authenticated

```typescript
// Request Body (all optional)
{
  "fullName": "Nguyễn Văn B",         // @MinLength(2)
  "bio": "Lập trình viên React...",    // @MaxLength(500)
  "socialLinks": {                      // @IsOptional, @IsObject
    "github": "https://github.com/...",
    "linkedin": "https://linkedin.com/..."
  }
}

// Response 200
{ "data": { ...updated user } }
```

---

### POST `/api/users/me/avatar` — Upload avatar

- **Auth:** Authenticated

```typescript
// Request: multipart/form-data
// Field: "file" — image/jpeg, image/png, image/webp — max 5MB

// Response 200
{
  "data": {
    "avatarUrl": "https://res.cloudinary.com/xxx/w_200,h_200,c_fill/avatar.jpg"
  }
}
```

**Business Logic:**

1. Validate file type & size
2. Upload to Cloudinary (folder: `avatars/{userId}`)
3. Apply transform: `w_200,h_200,c_fill,g_face,q_auto,f_auto`
4. Update `user.avatarUrl`
5. Delete old avatar từ Cloudinary (async, non-blocking)

---

### GET `/api/users/:id` — Xem public profile

- **Auth:** Public

```typescript
// Response 200
{
  "data": {
    "id": "clx...",
    "fullName": "Nguyễn Văn A",
    "avatarUrl": "...",
    "bio": "...",
    "role": "INSTRUCTOR",
    "followerCount": 1200,
    "followingCount": 50,
    "isFollowing": true,               // null nếu chưa login
    "createdAt": "2024-01-01",
    // Instructor extra info (nếu role=INSTRUCTOR)
    "instructorProfile": {
      "expertise": ["React", "Node.js"],
      "totalCourses": 5,
      "totalStudents": 1500,
      "avgRating": 4.7
    }
  }
}
```

---

### POST `/api/users/:id/follow` — Follow user

- **Auth:** Student, Instructor

```typescript
// Response 201
{ "message": "Đã follow" }

// Response 409
{ "message": "Bạn đã follow người này" }
```

**Business Logic:**

1. Check không follow chính mình
2. Insert follow (catch P2002 → 409)
3. Increment `followerCount` + `followingCount` (atomic)
4. Fanout: thêm posts gần đây của followee vào feed của follower (queue job)
5. Notify followee: "User X đã follow bạn"

---

### DELETE `/api/users/:id/follow` — Unfollow user

- **Auth:** Student, Instructor

```typescript
// Response 200
{ "message": "Đã unfollow" }
```

**Business Logic:**

1. Delete follow → 404 nếu chưa follow
2. Decrement counters (atomic)
3. Xóa feed items từ followee khỏi feed của follower (optional, async)

---

### GET `/api/users/:id/followers?page=1&limit=20` — Danh sách followers

### GET `/api/users/:id/following?page=1&limit=20` — Danh sách following

- **Auth:** Public

```typescript
// Response 200 (paginated)
{
  "data": [
    {
      "id": "clx...",
      "fullName": "Nguyễn Văn B",
      "avatarUrl": "...",
      "bio": "...",
      "isFollowing": false            // Mình có follow người này không
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 150 }
}
```

---

### PUT `/api/users/me/notification-preferences` — Cập nhật notification preferences

- **Auth:** Authenticated

```typescript
// Request Body
{
  "POST_LIKED":      { "inApp": true, "email": false },
  "NEW_FOLLOWER":    { "inApp": true, "email": false },
  "ORDER_COMPLETED": { "inApp": true, "email": true },
  "COURSE_APPROVED": { "inApp": true, "email": true }
}

// Response 200
{ "message": "Cập nhật thành công" }
```

---

# MODULE 3: COURSE MARKETPLACE (Public browsing)

## CATEGORIES — `/api/categories`

### GET `/api/categories` — Danh sách categories (tree)

- **Auth:** Public

```typescript
// Response 200
{
  "data": [
    {
      "id": "clx...",
      "name": "Web Development",
      "slug": "web-development",
      "description": "Phát triển web...",
      "iconUrl": "...",
      "parentId": null,
      "order": 1,
      "courseCount": 45,
      "children": [
        { "id": "clx...", "name": "Frontend", "slug": "frontend", "courseCount": 30 }
      ]
    }
  ]
}
```

---

### GET `/api/categories/:slug` — Chi tiết category

- **Auth:** Public

---

## TAGS — `/api/tags`

### GET `/api/tags` — Danh sách tags (public)

- **Auth:** Public

```typescript
// Response 200
{
  "data": [
    { "id": "clx...", "name": "React", "slug": "react", "courseCount": 25 },
    { "id": "clx...", "name": "Node.js", "slug": "nodejs", "courseCount": 18 }
  ]
}
```

---

## COURSES — `/api/courses`

### GET `/api/courses` — Danh sách khóa học (search + filter + sort + pagination)

- **Auth:** Public
- **Cache:** Redis 5 phút (key = hash of query params), invalidate khi course mới publish

```typescript
// Query Parameters
?search=react hooks              // Full-text search (tsvector)
&categorySlug=web-development    // Filter category
&level=INTERMEDIATE              // Filter level
&minPrice=0                      // Filter price range
&maxPrice=500000
&minRating=4                     // Filter min rating
&language=vi                     // Filter language
&sort=popular                    // popular | newest | highest_rated | price_asc | price_desc
&page=1
&limit=20

// Response 200
{
  "data": [
    {
      "id": "clx...",
      "title": "React Mastery 2024",
      "slug": "react-mastery-2024",
      "shortDescription": "Học React từ cơ bản đến nâng cao...",
      "thumbnailUrl": "https://res.cloudinary.com/...",
      "instructor": {
        "id": "clx...",
        "fullName": "Nguyễn Văn A",
        "avatarUrl": "..."
      },
      "category": { "id": "clx...", "name": "Web Development", "slug": "web-development" },
      "level": "INTERMEDIATE",
      "language": "vi",
      "price": 499000,
      "totalStudents": 1250,
      "totalLessons": 48,
      "totalDuration": 45000,         // seconds
      "avgRating": 4.7,
      "reviewCount": 340,
      "tags": ["React", "JavaScript", "Hooks"],
      "publishedAt": "2024-01-01"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Business Logic — Search:**

```sql
-- Full-text search dùng tsvector + GIN index
SELECT c.*, ts_rank(c.search_vector, query) AS rank
FROM courses c, plainto_tsquery('simple', :search) query
WHERE c.search_vector @@ query
  AND c.status = 'APPROVED'
  AND c."deletedAt" IS NULL
  AND (:categoryId IS NULL OR c."categoryId" = :categoryId)
  AND (:level IS NULL OR c.level = :level)
  AND (:minPrice IS NULL OR c.price >= :minPrice)
  AND (:maxPrice IS NULL OR c.price <= :maxPrice)
  AND (:minRating IS NULL OR c."avgRating" >= :minRating)
ORDER BY
  CASE WHEN :sort = 'popular' THEN c."totalStudents" END DESC,
  CASE WHEN :sort = 'newest' THEN c."publishedAt" END DESC,
  CASE WHEN :sort = 'highest_rated' THEN c."avgRating" END DESC,
  CASE WHEN :sort = 'price_asc' THEN c.price END ASC,
  CASE WHEN :sort = 'price_desc' THEN c.price END DESC,
  rank DESC                          -- Default: relevance
LIMIT :limit OFFSET :offset;
```

---

### GET `/api/courses/:slug` — Chi tiết khóa học

- **Auth:** Public (isOwned/isInCart cần login)
- **Cache:** Redis 30 phút per slug

```typescript
// Response 200
{
  "data": {
    "id": "clx...",
    "title": "React Mastery 2024",
    "slug": "react-mastery-2024",
    "description": "<p>Mô tả chi tiết (rich HTML)...</p>",
    "shortDescription": "Học React từ cơ bản...",
    "thumbnailUrl": "...",
    "instructor": {
      "id": "clx...",
      "fullName": "Nguyễn Văn A",
      "avatarUrl": "...",
      "bio": "10 năm kinh nghiệm...",
      "totalCourses": 5,
      "totalStudents": 3000,
      "avgRating": 4.8
    },
    "category": { "id": "clx...", "name": "Web Development" },
    "tags": ["React", "JavaScript", "Hooks", "TypeScript"],
    "level": "INTERMEDIATE",
    "language": "vi",
    "price": 499000,

    "stats": {
      "totalStudents": 1250,
      "totalLessons": 48,
      "totalDuration": 45000,
      "avgRating": 4.7,
      "reviewCount": 340
    },

    // Curriculum — công khai structure, ẩn nội dung
    "curriculum": [
      {
        "sectionId": "clx...",
        "sectionTitle": "Getting Started",
        "chapters": [
          {
            "chapterId": "clx...",
            "title": "Introduction to React",
            "price": 79000,
            "isFreePreview": true,
            "lessonsCount": 5,
            "totalDuration": 2700,
            "isOwned": false,            // null nếu chưa login
            "lessons": [
              {
                "lessonId": "clx...",
                "title": "What is React?",
                "type": "VIDEO",
                "duration": 600,
                "isPreview": true          // Có thể xem free
              }
            ]
          }
        ]
      }
    ],

    // User-specific (chỉ khi đã login)
    "enrollment": null,                   // hoặc { type: "FULL", progress: 0.65 }
    "isInWishlist": false,
    "isInCart": false,

    // Reviews (top 5, phần còn lại load lazy)
    "reviews": [
      {
        "id": "clx...",
        "user": { "fullName": "...", "avatarUrl": "..." },
        "rating": 5,
        "content": "Khóa học rất hay...",
        "createdAt": "2024-01-10"
      }
    ],

    // Recommendations
    "relatedCourses": [...],              // Content-Based (top 5)

    // Smart chapter suggestion (chỉ khi có learning history)
    "chapterSuggestion": null             // hoặc { shouldBuy: [...], canSkip: [...], ... }
  }
}
```

**Business Logic — View count:**

1. Check Redis SET `viewed:{courseId}:{userId|ip}` → nếu đã tồn tại → skip
2. Nếu chưa → SADD + EXPIRE 1h
3. Increment Redis counter `views:{courseId}`
4. Cron 5 phút: batch UPDATE courses SET viewCount FROM Redis counters

---

### GET `/api/courses/:courseId/reviews?page=1&limit=10&sort=newest` — Reviews

- **Auth:** Public

```typescript
// Response 200 (paginated)
{
  "data": [
    {
      "id": "clx...",
      "user": { "id": "...", "fullName": "...", "avatarUrl": "..." },
      "rating": 5,
      "content": "Khóa học rất hay...",
      "createdAt": "2024-01-10"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 340 }
}
```

---

### POST `/api/courses/:courseId/reviews` — Tạo review

- **Auth:** Student, Instructor

```typescript
// Request Body
{
  "rating": 5,                        // @IsInt, @Min(1), @Max(5)
  "content": "Khóa học rất hay..."    // @IsOptional, @MaxLength(2000)
}

// Response 201
{ "data": { ...created review } }
```

**Business Logic:**

1. Check enrollment exists
2. Check `enrollment.progress >= 0.3` (30%)
3. Check unique constraint (1 review/user/course)
4. Create review
5. Update course: `avgRating = ((avgRating * reviewCount) + rating) / (reviewCount + 1)`, `reviewCount++`
6. Notify instructor: "Khóa học X có review mới"
7. Invalidate course detail cache

---

### GET `/api/courses/:courseId/learn/:lessonId` — Course Player (xem bài học)

- **Auth:** Student, Instructor (enrolled)

```typescript
// Response 200
{
  "data": {
    "lesson": {
      "id": "clx...",
      "title": "React Hooks Deep Dive",
      "type": "VIDEO",
      "video": {
        "urls": {
          "480p": "https://res.cloudinary.com/.../c_scale,w_854/video.mp4",
          "720p": "https://res.cloudinary.com/.../c_scale,w_1280/video.mp4"
        },
        "duration": 1845,
        "thumbnailUrl": "..."
      },
      "textContent": null,
      "attachments": [
        { "name": "slides.pdf", "url": "...", "fileSize": 2500000 }
      ],
      "isCompleted": false,
      "progress": {
        "lastPosition": 543,
        "watchedPercent": 0.29,
        "watchedSegments": [[0, 240], [480, 960]]
      }
    },
    "curriculum": [...]                  // Sidebar — với ✅ completion status
  }
}
```

**Access Control:**

1. Check enrollment `type: FULL` → access all lessons
2. OR check `chapter_purchases` → access lessons in purchased chapters
3. OR check `chapter.isFreePreview` → access preview lessons
4. Else → 403

---

# MODULE 4: COURSE MANAGEMENT (Instructor)

## INSTRUCTOR — `/api/instructor`

### GET `/api/instructor/courses` — Danh sách khóa của instructor

- **Auth:** Instructor

```typescript
// Query: ?status=DRAFT&page=1&limit=10

// Response 200 (paginated)
{
  "data": [
    {
      "id": "clx...",
      "title": "React Mastery",
      "status": "DRAFT",
      "price": 499000,
      "totalStudents": 0,
      "avgRating": 0,
      "createdAt": "2024-01-01"
    }
  ],
  "meta": { ... }
}
```

---

### POST `/api/instructor/courses` — Tạo khóa mới (Step 1: thông tin cơ bản)

- **Auth:** Instructor

```typescript
// Request Body
{
  "title": "React Mastery 2024",           // @MinLength(5), @MaxLength(200)
  "description": "Mô tả chi tiết...",      // @MinLength(50)
  "shortDescription": "Mô tả ngắn...",     // @MaxLength(200)
  "categoryId": "clx...",                   // @IsCuid
  "level": "INTERMEDIATE",                  // @IsEnum(CourseLevel)
  "language": "vi",
  "tags": ["react", "javascript"]           // @IsArray, @ArrayMaxSize(10)
}

// Response 201
{ "data": { "id": "clx...", "slug": "react-mastery-2024", ...created course } }
```

**Business Logic:**

1. Generate slug from title (slugify + check unique, append number if collision)
2. Create course: `status: DRAFT, instructorId: userId`
3. Create/link tags (find or create by name)

---

### PUT `/api/instructor/courses/:id` — Cập nhật thông tin khóa học

- **Auth:** Instructor (owner only)

```typescript
// Request Body (partial update)
{
  "title": "React Mastery 2024 — Updated",
  "price": 599000,
  "level": "ADVANCED"
}

// Response 200
{ "data": { ...updated course } }
```

**Business Logic:**

1. Verify ownership (`course.instructorId === userId`)
2. Chỉ cho sửa khi `status: DRAFT` hoặc `REJECTED` (course đã APPROVED thì phải unpublish trước)
3. Nếu sửa title → regenerate slug
4. Update fields

---

### POST `/api/instructor/courses/:id/thumbnail` — Upload thumbnail

- **Auth:** Instructor (owner)

```typescript
// Request: multipart/form-data, field: "file"
// Validate: image/*, max 5MB

// Response 200
{ "data": { "thumbnailUrl": "https://res.cloudinary.com/..." } }
```

---

### POST `/api/instructor/courses/:id/sections` — Tạo section

- **Auth:** Instructor (owner)

```typescript
// Request Body
{
  "title": "Getting Started",            // @MinLength(2)
  "order": 1                              // @IsInt, @Min(0)
}

// Response 201
{ "data": { "id": "clx...", "title": "Getting Started", "order": 1 } }
```

---

### PUT `/api/instructor/courses/:courseId/sections/:sectionId` — Sửa section

### DELETE `/api/instructor/courses/:courseId/sections/:sectionId` — Xóa section

### PUT `/api/instructor/courses/:courseId/sections/reorder` — Sắp xếp lại sections

```typescript
// Reorder: Request Body
{ "sectionIds": ["clx1", "clx3", "clx2"] }    // Thứ tự mới
```

---

### POST `/api/instructor/courses/:courseId/sections/:sectionId/chapters` — Tạo chapter

- **Auth:** Instructor (owner)

```typescript
// Request Body
{
  "title": "Introduction to React",
  "price": 79000,                        // @IsInt, @Min(0) — giá mua lẻ
  "isFreePreview": false,                // @IsBoolean
  "order": 1
}

// Response 201
{ "data": { ...created chapter } }
```

---

### POST `/api/instructor/courses/:courseId/chapters/:chapterId/lessons` — Tạo lesson

- **Auth:** Instructor (owner)

```typescript
// Request Body
{
  "title": "What is React?",
  "type": "VIDEO",                       // VIDEO | TEXT | QUIZ
  "order": 1,
  "textContent": null,                   // Required nếu type=TEXT (rich HTML)
  "estimatedDuration": 600               // seconds, optional
}

// Response 201
{ "data": { ...created lesson } }
```

---

### PUT `/api/instructor/courses/:id/pricing` — Thiết lập giá

- **Auth:** Instructor (owner)

```typescript
// Request Body
{
  "price": 499000,                       // Giá cả khóa
  "chapterPricingEnabled": true          // Cho phép mua lẻ chapter
}

// Response 200
{ "data": { "price": 499000, "valid": true } }
```

**Business Logic — Validation:**

```
totalChapterPrices = SUM(chapter.price for all chapters)
IF chapterPricingEnabled:
  ASSERT totalChapterPrices > course.price    // Mua lẻ phải đắt hơn
  ASSERT each chapter.price > 0               // Mỗi chapter có giá
```

---

### POST `/api/instructor/courses/:id/submit` — Submit khóa để admin review

- **Auth:** Instructor (owner)

```typescript
// Response 200
{ "message": "Khóa học đã được gửi để phê duyệt." }

// Response 400
{ "message": "Khóa học cần ít nhất 1 section, 1 chapter và 1 lesson có nội dung." }
```

**Business Logic:**

1. Validate minimum content:
   - Ít nhất 1 section
   - Ít nhất 1 chapter trong section
   - Ít nhất 1 lesson có nội dung (video READY hoặc textContent hoặc quiz)
   - Title, description, categoryId, price đã set
2. Update status: `DRAFT` → `PENDING_REVIEW`
3. Notify all admins

---

### Quizzes — CRUD cho lesson type QUIZ

### PUT `/api/instructor/courses/:courseId/lessons/:lessonId/quiz` — Tạo/Cập nhật quiz

```typescript
// Request Body
{
  "title": "React Hooks Quiz",
  "passingScore": 70,                   // @IsInt, @Min(0), @Max(100)
  "maxAttempts": 3,                      // @IsOptional
  "timeLimit": null,                     // seconds, @IsOptional
  "questions": [
    {
      "type": "MULTIPLE_CHOICE",
      "question": "Hook nào quản lý side effects?",
      "explanation": "useEffect dùng cho...",
      "order": 1,
      "options": [
        { "text": "useState", "isCorrect": false, "order": 1 },
        { "text": "useEffect", "isCorrect": true, "order": 2 },
        { "text": "useRef", "isCorrect": false, "order": 3 },
        { "text": "useMemo", "isCorrect": false, "order": 4 }
      ]
    },
    {
      "type": "TRUE_FALSE",
      "question": "useCallback return memoized function?",
      "explanation": "Đúng! useCallback...",
      "order": 2,
      "options": [
        { "text": "True", "isCorrect": true, "order": 1 },
        { "text": "False", "isCorrect": false, "order": 2 }
      ]
    }
  ]
}
```

**Business Logic:**

- Upsert quiz: nếu đã có → delete old questions/options → tạo mới (simpler than partial update)
- Validate mỗi question có đúng 1 `isCorrect = true`

---

## INSTRUCTOR DASHBOARD — `/api/instructor/dashboard`

### GET `/api/instructor/dashboard` — Tổng quan doanh thu

- **Auth:** Instructor

```typescript
// Response 200
{
  "data": {
    "overview": {
      "totalRevenue": 15000000,
      "totalStudents": 450,
      "totalCourses": 5,
      "avgRating": 4.6,
      "availableBalance": 10000000,
      "pendingBalance": 5000000
    },
    "revenueChart": [
      { "date": "2024-01-01", "revenue": 500000, "enrollments": 12 },
      { "date": "2024-01-02", "revenue": 750000, "enrollments": 18 }
    ],
    "courseStats": [
      {
        "courseId": "clx...",
        "title": "React Mastery",
        "revenue": 8000000,
        "students": 200,
        "rating": 4.8,
        "completionRate": 0.35
      }
    ]
  }
}
```

**Business Logic:**

```sql
-- Available balance
SELECT SUM(amount) FROM earnings
WHERE "instructorId" = :userId AND status = 'AVAILABLE';

-- Pending balance
SELECT SUM(amount) FROM earnings
WHERE "instructorId" = :userId AND status = 'PENDING';

-- Revenue chart (30 days)
SELECT DATE(e."createdAt") as date,
       SUM(e.amount) as revenue,
       COUNT(*) as enrollments
FROM earnings e
WHERE e."instructorId" = :userId
  AND e."createdAt" >= NOW() - INTERVAL '30 days'
GROUP BY DATE(e."createdAt")
ORDER BY date;
```

---

## INSTRUCTOR WITHDRAWALS — `/api/instructor/withdrawals`

### POST `/api/instructor/withdrawals` — Yêu cầu rút tiền

- **Auth:** Instructor

```typescript
// Request Body
{
  "amount": 5000000,                    // @IsInt, @Min(200000)
  "bankInfo": {
    "bankName": "MB Bank",
    "accountNumber": "0123456789",
    "accountName": "NGUYEN VAN A"
  }
}

// Response 201
{ "data": { "id": "clx...", "amount": 5000000, "status": "PENDING" } }
```

**Business Logic:**

1. Check `amount >= 200,000` (minimum withdrawal)
2. Check `amount <= availableBalance`
3. Check không có withdrawal PENDING nào khác
4. Create withdrawal: `status: PENDING`
5. Update earnings: lock amount (mark related earnings as `WITHDRAWN`)
6. Notify admins

---

### GET `/api/instructor/withdrawals` — Lịch sử rút tiền

- **Auth:** Instructor

---

## INSTRUCTOR COUPONS — `/api/instructor/coupons`

### POST `/api/instructor/coupons` — Tạo coupon

- **Auth:** Instructor

```typescript
// Request Body
{
  "code": "REACT2024",                  // @IsString, @IsUppercase, @MinLength(4)
  "discountType": "PERCENTAGE",          // PERCENTAGE | FIXED_AMOUNT
  "discountValue": 20,                   // 20% hoặc 50000 VND
  "maxUses": 100,
  "maxUsesPerUser": 1,
  "minOrderAmount": 100000,
  "applicableCourseIds": ["clx1", "clx5"],  // null = tất cả khóa của instructor
  "startsAt": "2024-01-01T00:00:00Z",
  "expiresAt": "2024-03-31T23:59:59Z"
}

// Response 201
{ "data": { ...created coupon } }
```

**Business Logic:**

1. Validate `applicableCourseIds` thuộc về instructor này
2. Validate `discountValue`: 1-100 nếu PERCENTAGE, > 0 nếu FIXED_AMOUNT
3. Validate `startsAt < expiresAt`
4. Create coupon + link courses

---

### GET `/api/instructor/coupons` — Danh sách coupon

### PUT `/api/instructor/coupons/:id` — Sửa coupon

### DELETE `/api/instructor/coupons/:id` — Xóa coupon (soft — deactivate)

---

## INSTRUCTOR QUESTION BANKS — `/api/instructor/question-banks`

### POST `/api/instructor/question-banks` — Tạo question bank

- **Auth:** Instructor

```typescript
// Request Body
{
  "name": "React Fundamentals",          // @MinLength(2), @MaxLength(200)
  "description": "Bộ câu hỏi React..."  // @IsOptional, @MaxLength(500)
}

// Response 201
{ "data": { "id": "clx...", "name": "React Fundamentals", ...created bank } }
```

---

### GET `/api/instructor/question-banks?page=1&limit=10&search=react` — Danh sách question banks

- **Auth:** Instructor

```typescript
// Response 200 (paginated)
{
  "data": [
    {
      "id": "clx...",
      "name": "React Fundamentals",
      "description": "...",
      "questionCount": 25,
      "tagCount": 5,
      "createdAt": "2024-01-15"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 5 }
}
```

---

### GET `/api/instructor/question-banks/:id` — Chi tiết bank với questions + tags

- **Auth:** Instructor (owner)

---

### PATCH `/api/instructor/question-banks/:id` — Cập nhật bank name/description

- **Auth:** Instructor (owner)

```typescript
// Request Body (partial)
{
  "name": "React Advanced",
  "description": "Updated description..."
}

// Response 200
{ "data": { ...updated bank } }
```

---

### DELETE `/api/instructor/question-banks/:id` — Xóa question bank

- **Auth:** Instructor (owner)

---

### GET `/api/instructor/question-banks/:id/tags` — Danh sách bank tags

- **Auth:** Instructor (owner)

---

### POST `/api/instructor/question-banks/:id/tags` — Tạo bank tag

- **Auth:** Instructor (owner)

```typescript
// Request Body
{ "name": "Hooks" }

// Response 201
{ "data": { "id": "clx...", "name": "Hooks" } }
```

---

### PATCH `/api/instructor/question-banks/:id/tags/:tagId` — Cập nhật bank tag

- **Auth:** Instructor (owner)

---

### DELETE `/api/instructor/question-banks/:id/tags/:tagId` — Xóa bank tag

- **Auth:** Instructor (owner)

---

### POST `/api/instructor/question-banks/:id/questions` — Thêm câu hỏi vào bank

- **Auth:** Instructor (owner)

```typescript
// Request Body
{
  "type": "MULTIPLE_CHOICE",
  "question": "Hook nào quản lý side effects?",
  "explanation": "useEffect dùng cho...",
  "tagIds": ["clx..."],
  "options": [
    { "text": "useState", "isCorrect": false },
    { "text": "useEffect", "isCorrect": true },
    { "text": "useRef", "isCorrect": false },
    { "text": "useMemo", "isCorrect": false }
  ]
}

// Response 201
{ "data": { ...created question } }
```

---

### POST `/api/instructor/question-banks/:id/questions/batch` — Batch thêm câu hỏi

- **Auth:** Instructor (owner)

```typescript
// Request Body
{
  "questions": [
    { "type": "MULTIPLE_CHOICE", "question": "...", "options": [...] },
    { "type": "TRUE_FALSE", "question": "...", "options": [...] }
  ]
}

// Response 201
{ "data": { "created": 5 } }
```

---

### PATCH `/api/instructor/question-banks/:id/questions/:questionId` — Cập nhật câu hỏi

- **Auth:** Instructor (owner)

---

### DELETE `/api/instructor/question-banks/:id/questions/:questionId` — Xóa câu hỏi

- **Auth:** Instructor (owner)

---

## INSTRUCTOR APPLICATION — `/api/instructor/applications`

### POST `/api/instructor/applications` — Nộp đơn đăng ký instructor

- **Auth:** Student (only)

```typescript
// Request Body
{
  "expertise": ["React", "Node.js"],     // @IsArray, @MinLength(1)
  "experience": "5 năm kinh nghiệm...", // @MinLength(50)
  "cvUrl": "https://res.cloudinary.com/...",         // @IsUrl, @IsOptional
  "certificateUrls": ["https://..."],    // @IsArray, @IsOptional
  "portfolioUrl": "https://github.com/..."// @IsUrl, @IsOptional
}

// Response 201
{ "message": "Đơn đã được gửi. Chúng tôi sẽ phản hồi trong 1-3 ngày." }
```

**Business Logic:**

1. Check user `role === STUDENT`
2. Check không có application PENDING nào
3. Create application: `status: PENDING`
4. Notify all admins

---

### GET `/api/instructor/applications/me` — Xem trạng thái đơn

- **Auth:** Student, Instructor

---

# MODULE 5: ECOMMERCE

## CART — `/api/cart`

### GET `/api/cart` — Xem giỏ hàng

- **Auth:** Authenticated

```typescript
// Response 200
{
  "data": {
    "items": [
      {
        "id": "clx...",
        "course": {
          "id": "clx...",
          "title": "React Mastery",
          "thumbnailUrl": "...",
          "instructor": { "fullName": "..." }
        },
        "chapter": null,                 // null = mua cả khóa
        "price": 499000,
        "originalPrice": 499000
      },
      {
        "id": "clx...",
        "course": { ... },
        "chapter": {
          "id": "clx...",
          "title": "Advanced Hooks"
        },
        "price": 89000,
        "originalPrice": 89000
      }
    ],
    "coupon": null,
    "subtotal": 588000,
    "discount": 0,
    "total": 588000
  }
}
```

---

### POST `/api/cart/items` — Thêm vào giỏ hàng

- **Auth:** Authenticated

```typescript
// Request Body
{
  "courseId": "clx...",                  // @IsCuid
  "chapterId": null                      // @IsOptional, @IsCuid — null = mua cả khóa
}

// Response 201
{ "data": { ...cart item } }

// Error cases
// 409: "Bạn đã sở hữu khóa/chapter này"
// 409: "Bạn đã có cả khóa trong giỏ hàng"
// 409: "Sản phẩm đã có trong giỏ hàng"
```

**Business Logic:**

1. Check not already enrolled (full course or chapter)
2. Check not already in cart (exact match)
3. If adding full course but chapters of same course in cart → ask confirm (return conflict info)
4. If adding chapter but full course in cart → 409 "Bạn đã có cả khóa"
5. Create cart item

---

### DELETE `/api/cart/items/:itemId` — Xóa khỏi giỏ hàng

- **Auth:** Authenticated

---

### POST `/api/cart/merge` — Merge localStorage cart sau login

- **Auth:** Authenticated

```typescript
// Request Body
{
  "items": [
    { "courseId": "clx1", "chapterId": null },
    { "courseId": "clx2", "chapterId": "clx3" }
  ]
}

// Response 200
{ "data": { ...full cart } }
```

---

### POST `/api/cart/apply-coupon` — Áp dụng mã giảm giá

- **Auth:** Authenticated

```typescript
// Request Body
{ "code": "REACT2024" }

// Response 200
{
  "data": {
    "coupon": { "code": "REACT2024", "discountType": "PERCENTAGE", "discountValue": 20 },
    "discount": 117600,
    "total": 470400
  }
}

// Error cases
// 404: "Mã giảm giá không tồn tại"
// 400: "Mã giảm giá đã hết hạn"
// 400: "Mã giảm giá đã hết lượt sử dụng"
// 400: "Bạn đã sử dụng mã giảm giá này"
// 400: "Mã không áp dụng cho sản phẩm trong giỏ hàng"
// 400: "Đơn hàng chưa đạt giá trị tối thiểu"
```

**Business Logic — Coupon Validation (6 bước):**

1. Find coupon by code → 404
2. Check `isActive && startsAt <= now <= expiresAt` → 400
3. Check `usageCount < maxUses` → 400
4. Check user usage: `coupon_usages WHERE userId AND couponId` < `maxUsesPerUser` → 400
5. Check applicable courses: intersect `coupon.applicableCourses` with cart items → 400
6. Check `cart.subtotal >= minOrderAmount` → 400
7. Calculate discount

---

### DELETE `/api/cart/coupon` — Bỏ mã giảm giá

---

## ORDERS — `/api/orders`

### POST `/api/orders` — Tạo đơn hàng (checkout)

- **Auth:** Authenticated

```typescript
// Request Body
{
  "couponCode": "REACT2024"             // @IsOptional
}

// Response 201
{
  "data": {
    "id": "clx...",
    "orderCode": "SSML000123",
    "totalAmount": 588000,
    "discountAmount": 117600,
    "finalAmount": 470400,
    "status": "PENDING",
    "expiresAt": "2024-01-15T10:45:00Z",   // +15 phút
    "payment": {
      "bankId": "MB",
      "accountNumber": "0123456789",
      "accountName": "NGUYEN VAN PLATFORM",
      "amount": 470400,
      "content": "SSML000123",
      "qrUrl": "https://img.vietqr.io/image/MB-0123456789-compact2.png?amount=470400&addInfo=SSML000123"
    }
  }
}
```

**Business Logic (TRANSACTION):**

1. Lấy cart items → validate vẫn còn hợp lệ
2. Re-validate coupon (nếu có)
3. Tính giá final
4. **BEGIN TRANSACTION:**
   - Create order: `status: PENDING, expiresAt: now + 15 min`
   - Create order items (snapshot giá tại thời điểm mua)
   - Create coupon usage (nếu có)
   - **Race condition coupon:** `UPDATE coupons SET usageCount = usageCount + 1 WHERE id = :id AND usageCount < maxUses`
   - Clear cart items
5. **COMMIT**
6. Generate VietQR URL
7. Return order + payment info

---

### GET `/api/orders/:id` — Chi tiết đơn hàng

- **Auth:** Owner hoặc Admin

---

### GET `/api/orders/:id/status` — Polling trạng thái (cho payment page)

- **Auth:** Owner

```typescript
// Response 200
{ "data": { "status": "PENDING" } }
// hoặc
{ "data": { "status": "COMPLETED", "paidAt": "2024-01-15T10:35:00Z" } }
```

---

### GET `/api/orders?page=1&limit=10` — Lịch sử đơn hàng

- **Auth:** Authenticated

---

## WEBHOOKS — `/api/webhooks`

### POST `/api/webhooks/sepay` — SePay payment webhook

- **Auth:** Public (verify bằng `x-api-key` header)

```typescript
// Request Body (từ SePay)
{
  "gateway": "MBBank",
  "transactionDate": "2024-01-15",
  "accountNumber": "0123456789",
  "transferType": "in",
  "transferAmount": 470400,
  "content": "SSML000123 chuyen tien mua khoa hoc",
  "referenceCode": "FT24015..."
}

// Response 200
{ "success": true }
```

**Business Logic — completeOrder (TRANSACTION):**

1. Verify `x-api-key === SEPAY_WEBHOOK_SECRET`
2. Check `transferType === "in"`
3. Extract order code: `content.match(/SSML\d{6}/)`
4. Find order by `orderCode` + `status: PENDING`
5. Verify `transferAmount >= order.finalAmount`
6. **BEGIN TRANSACTION:**
   - Update order: `status: COMPLETED, paymentRef, paidAt`
   - Create enrollments (FULL hoặc PARTIAL tùy order items)
   - Create chapter_purchases (nếu mua lẻ)
   - Create earnings cho mỗi order item:
     - Tính commission rate (tier-based)
     - `instructorAmount = price * (1 - commissionRate)`
     - `commissionAmount = price * commissionRate`
     - `status: PENDING, availableAt: now + 7 days`
   - Update course `totalStudents++`
   - Update instructor `totalRevenue`
   - Auto-join course group (nếu có)
7. **COMMIT**
8. Async: Send email receipt, push notification, invalidate caches

---

## WISHLISTS — `/api/wishlists`

### GET `/api/wishlists` — Danh sách wishlist

### POST `/api/wishlists` — Thêm vào wishlist `{ courseId }`

### DELETE `/api/wishlists/:courseId` — Xóa khỏi wishlist

- **Auth:** Authenticated

---

# MODULE 6: LEARNING EXPERIENCE

## LEARNING — `/api/learning`

### PUT `/api/learning/progress/:lessonId` — Cập nhật tiến trình bài học

- **Auth:** Authenticated (enrolled)

```typescript
// Request Body
{
  "lastPosition": 960,                  // @IsInt, giây — vị trí hiện tại
  "watchedSegments": [[0,240],[480,960]] // @IsArray — các đoạn đã xem
}

// Response 200
{
  "data": {
    "watchedPercent": 0.533,
    "isCompleted": false,
    "courseProgress": 0.42               // Updated course progress
  }
}
```

**Business Logic:**

1. Merge new segments với existing segments (util function)
2. Calculate `watchedPercent = totalWatched / duration`
3. If `watchedPercent >= 0.8` → `isCompleted = true, completedAt = now`
4. Recalculate course progress: `completedLessons / accessibleLessons`
5. Update enrollment.progress
6. If course 100% → trigger certificate generation
7. Update daily activity: `lessonsCompleted++, timeSpentMinutes++`

---

### POST `/api/learning/lessons/:lessonId/complete` — Mark text lesson completed

- **Auth:** Authenticated (enrolled)

```typescript
// Response 200
{
  "data": {
    "isCompleted": true,
    "courseProgress": 0.50
  }
}
```

---

### POST `/api/learning/lessons/:lessonId/quiz/submit` — Submit quiz

- **Auth:** Authenticated (enrolled)

```typescript
// Request Body
{
  "answers": [
    { "questionId": "clx1", "selectedOptionId": "clx-opt-b" },
    { "questionId": "clx2", "selectedOptionId": "clx-opt-a" }
  ]
}

// Response 200
{
  "data": {
    "score": 100,
    "passed": true,
    "totalQuestions": 2,
    "correctCount": 2,
    "results": [
      {
        "questionId": "clx1",
        "correct": true,
        "correctAnswer": "clx-opt-b",
        "explanation": "useEffect dùng cho side effects..."
      }
    ],
    "lessonCompleted": true,
    "courseProgress": 0.55
  }
}
```

**Business Logic:**

1. Check quiz `maxAttempts` (nếu set)
2. Grade answers
3. Create quiz_attempt record
4. If `score >= passingScore` → mark lesson completed
5. Update course progress

---

### GET `/api/learning/streak` — Thông tin streak hiện tại

- **Auth:** Authenticated

```typescript
// Response 200
{
  "data": {
    "currentStreak": 7,
    "longestStreak": 15,
    "todayCompleted": true,
    "lastActivityDate": "2024-01-15"
  }
}
```

---

### GET `/api/learning/dashboard` — Dashboard tiến trình

- **Auth:** Authenticated

```typescript
// Response 200
{
  "data": {
    "activeCourses": [
      {
        "courseId": "clx...",
        "title": "React Mastery",
        "thumbnailUrl": "...",
        "progress": 0.65,
        "lastAccessedAt": "2024-01-15",
        "nextLesson": { "id": "clx...", "title": "Advanced Hooks" }
      }
    ],
    "completedCourses": [
      {
        "courseId": "clx...",
        "title": "CSS Advanced",
        "completedAt": "2024-01-10",
        "certificateId": "CERT-005-00123"
      }
    ],
    "streak": {
      "current": 7,
      "longest": 15,
      "todayCompleted": true
    },
    "totalLearningTime": 3600,          // phút
    "skillsMap": [
      { "skill": "JavaScript", "level": "ADVANCED", "coursesCompleted": 3 },
      { "skill": "React", "level": "INTERMEDIATE", "coursesCompleted": 1 }
    ]
  }
}
```

---

## CERTIFICATES — `/api/certificates`

### GET `/api/certificates/verify/:certificateId` — Verify certificate (public)

- **Auth:** Public

```typescript
// Response 200
{
  "data": {
    "valid": true,
    "studentName": "Nguyễn Văn A",
    "courseName": "React Mastery 2024",
    "instructorName": "Trần Văn B",
    "issuedAt": "2024-01-15",
    "certificateId": "CERT-005-00123-20240115"
  }
}
```

---

### GET `/api/certificates/my` — Danh sách certificate của tôi

- **Auth:** Authenticated

---

## PLACEMENT TESTS — `/api/placement-tests`

### POST `/api/placement-tests/start` — Bắt đầu placement test

- **Auth:** Authenticated

```typescript
// Request Body
{ "categoryId": "clx..." }

// Response 200
{
  "data": {
    "testId": "clx...",
    "questions": [
      {
        "id": "clx...",
        "level": "BEGINNER",
        "question": "Biến let khác gì var?",
        "options": [...]
      }
    ],
    "totalQuestions": 15,
    "timeLimit": null
  }
}
```

---

### POST `/api/placement-tests/:testId/submit` — Nộp bài test

- **Auth:** Authenticated

```typescript
// Request Body
{ "answers": [...] }

// Response 200
{
  "data": {
    "level": "INTERMEDIATE",
    "scores": { "beginner": 5, "intermediate": 3, "advanced": 1 },
    "weakTopics": ["async/await", "closures"],
    "recommendedCourses": [...]
  }
}
```

---

# MODULE 7: SOCIAL LEARNING NETWORK

## FEED — `/api/feed`

### GET `/api/feed?page=1&limit=20` — News Feed

- **Auth:** Authenticated

```typescript
// Response 200 (paginated — cursor-based)
{
  "data": [
    {
      "id": "clx...",
      "author": {
        "id": "clx...",
        "fullName": "Nguyễn Văn A",
        "avatarUrl": "..."
      },
      "content": "Vừa học xong React Hooks...",
      "type": "TEXT",
      "images": [],
      "codeSnippet": null,
      "visibility": "PUBLIC",
      "group": null,
      "likeCount": 25,
      "commentCount": 8,
      "shareCount": 3,
      "isLiked": false,                  // Current user đã like chưa
      "isBookmarked": false,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "nextCursor": "clx...",              // Cursor-based pagination
    "hasMore": true
  }
}
```

**Business Logic:**

- Đọc từ `feed_items` table (pre-computed bởi fanout-on-write)
- Join với `posts` table để lấy content
- Check `isLiked`, `isBookmarked` cho current user

---

## POSTS — `/api/posts`

### POST `/api/posts` — Tạo post

- **Auth:** Authenticated

```typescript
// Request Body
{
  "content": "Vừa học xong React Hooks...",    // @MinLength(1), @MaxLength(5000)
  "type": "CODE_SNIPPET",                      // TEXT | IMAGE | CODE_SNIPPET | LINK
  "images": ["https://res.cloudinary.com/..."], // @IsOptional, @IsArray
  "codeSnippet": {                              // @IsOptional
    "language": "javascript",
    "code": "const [state, setState] = useState(0);"
  },
  "tags": ["react", "hooks"],                   // @IsOptional
  "visibility": "PUBLIC",                        // PUBLIC | FOLLOWERS | GROUP
  "groupId": null                                // @IsOptional — nếu post trong group
}

// Response 201
{ "data": { ...created post } }
```

**Business Logic:**

1. Create post
2. **Fanout-on-write (queue job):**
   - Lấy danh sách followers
   - Batch INSERT feed_items (1000 followers/batch)
   - Nếu post trong group → chỉ fanout cho group members

---

### GET `/api/posts/:id` — Chi tiết post

### PUT `/api/posts/:id` — Sửa post (owner only)

### DELETE `/api/posts/:id` — Xóa post (owner only, soft delete)

---

### POST `/api/posts/:id/like` — Toggle like

- **Auth:** Authenticated

```typescript
// Response 200
{ "data": { "liked": true, "likeCount": 26 } }
// hoặc
{ "data": { "liked": false, "likeCount": 25 } }
```

**Business Logic:**

1. Check existing like → toggle (delete nếu đã like, create nếu chưa)
2. Atomic update: `posts.likeCount += 1` hoặc `-= 1`
3. If liked → notify post author

---

### POST `/api/posts/:id/comments` — Tạo comment

- **Auth:** Authenticated

```typescript
// Request Body
{
  "content": "Rất hay!",                // @MinLength(1), @MaxLength(2000)
  "parentId": null                       // @IsOptional — reply to comment
}

// Response 201
{ "data": { ...created comment } }
```

---

### GET `/api/posts/:id/comments?page=1&limit=20` — Danh sách comments

### DELETE `/api/posts/:postId/comments/:commentId` — Xóa comment (owner)

---

### POST `/api/posts/:id/bookmark` — Toggle bookmark

### GET `/api/bookmarks?page=1&limit=20` — Danh sách bookmarks

---

## CHAT — `/api/conversations`

### GET `/api/conversations` — Danh sách conversations

- **Auth:** Authenticated

```typescript
// Response 200
{
  "data": [
    {
      "id": "clx...",
      "type": "DIRECT",
      "participant": {
        "id": "clx...",
        "fullName": "Trần Văn B",
        "avatarUrl": "...",
        "isOnline": true
      },
      "lastMessage": {
        "content": "Cảm ơn bạn!",
        "senderId": "clx...",
        "createdAt": "2024-01-15T10:30:00Z"
      },
      "unreadCount": 3
    }
  ]
}
```

---

### POST `/api/conversations` — Tạo/Mở conversation

- **Auth:** Authenticated

```typescript
// Request Body
{
  "participantId": "clx...",            // Direct chat
  "type": "DIRECT"
}
// hoặc group chat
{
  "participantIds": ["clx1", "clx2"],
  "type": "GROUP",
  "name": "Study Group Chat"
}

// Response 200 (return existing nếu đã có direct conversation)
{ "data": { "id": "clx...", "type": "DIRECT", ... } }
```

**Business Logic (Direct chat access control):**

- Student ↔ Student: cả hai follow nhau HOẶC cùng group
- Student → Instructor: student đã mua khóa của instructor
- Instructor → Student: chỉ reply (conversation đã tồn tại)

---

### GET `/api/conversations/:id/messages?cursor=xxx&limit=50` — Messages (cursor pagination)

- **Auth:** Conversation member

---

### POST `/api/conversations/:id/messages` — Gửi tin nhắn (REST fallback)

- **Auth:** Conversation member

```typescript
// Request Body
{
  "content": "Hello!",
  "type": "TEXT"                        // TEXT | IMAGE | CODE | FILE
}
```

> **Note:** Chat chủ yếu dùng WebSocket (xem doc 03). REST endpoint chỉ là fallback.

---

## GROUPS — `/api/groups`

### GET `/api/groups?page=1&limit=20&search=react` — Danh sách groups

### POST `/api/groups` — Tạo group

- **Auth:** Authenticated

```typescript
// Request Body
{
  "name": "React Vietnam Learners",     // @MinLength(3), @MaxLength(100)
  "description": "Nhóm học React...",   // @MaxLength(500)
  "privacy": "PUBLIC"                    // PUBLIC | PRIVATE
}

// Response 201
{ "data": { ...created group } }
```

---

### GET `/api/groups/:id` — Chi tiết group

### PUT `/api/groups/:id` — Sửa group (owner/admin)

### DELETE `/api/groups/:id` — Xóa group (owner only)

### POST `/api/groups/:id/join` — Join group

### POST `/api/groups/:id/leave` — Leave group

### GET `/api/groups/:id/members?page=1&limit=20` — Members

### PUT `/api/groups/:id/members/:userId` — Thay đổi role member (owner/admin)

### DELETE `/api/groups/:id/members/:userId` — Kick member (owner/admin)

---

### GET `/api/groups/:id/requests` — Danh sách join requests (PRIVATE groups)

- **Auth:** Group owner/admin

```typescript
// Response 200 (paginated)
{
  "data": [
    {
      "id": "clx...",
      "user": { "id": "clx...", "fullName": "Nguyễn Văn A", "avatarUrl": "..." },
      "status": "PENDING",
      "createdAt": "2024-01-15"
    }
  ],
  "meta": { ... }
}
```

---

### PUT `/api/groups/:id/requests/:requestId/approve` — Approve join request

- **Auth:** Group owner/admin

```typescript
// Response 200
{ "message": "Đã chấp nhận yêu cầu tham gia" }
```

---

### PUT `/api/groups/:id/requests/:requestId/reject` — Reject join request

- **Auth:** Group owner/admin

```typescript
// Response 200
{ "message": "Đã từ chối yêu cầu tham gia" }
```

---

### GET `/api/groups/:id/posts?page=1&limit=20` — Posts trong group

### POST `/api/groups/:id/posts` — Tạo post trong group

- **Auth:** Group member

---

# MODULE 8: Q&A FORUM

## QUESTIONS — `/api/questions`

### GET `/api/questions?page=1&limit=20&courseId=xxx&search=react` — Danh sách questions

- **Auth:** Authenticated

```typescript
// Response 200 (paginated)
{
  "data": [
    {
      "id": "clx...",
      "title": "Tại sao useEffect chạy 2 lần?",
      "content": "Khi tôi dùng React 18...",
      "author": { "id": "...", "fullName": "...", "avatarUrl": "..." },
      "course": { "id": "...", "title": "React Mastery" },
      "tags": ["react", "hooks"],
      "answerCount": 5,
      "hasBestAnswer": true,
      "createdAt": "2024-01-15"
    }
  ],
  "meta": { ... }
}
```

---

### POST `/api/questions` — Tạo câu hỏi

- **Auth:** Authenticated

```typescript
// Request Body
{
  "title": "Tại sao useEffect chạy 2 lần?",  // @MinLength(10), @MaxLength(200)
  "content": "Khi tôi dùng React 18...",      // @MinLength(20), @MaxLength(5000)
  "tags": ["react", "hooks"],                   // @IsArray, @MaxSize(5)
  "courseId": "clx...",                          // @IsOptional
  "codeSnippet": {                               // @IsOptional
    "language": "jsx",
    "code": "useEffect(() => { ... }, []);"
  }
}

// Response 201
{ "data": { ...created question } }
```

---

### GET `/api/questions/:id` — Chi tiết question + answers

### PUT `/api/questions/:id` — Sửa question (owner)

### DELETE `/api/questions/:id` — Xóa question (owner)

---

### GET `/api/questions/similar?title=useEffect chạy 2 lần` — Gợi ý câu hỏi tương tự

- **Auth:** Authenticated

```typescript
// Response 200 — dùng full-text search trên questions.title + content
{
  "data": [
    { "id": "clx...", "title": "useEffect chạy 2 lần trong React 18", "answerCount": 3 }
  ]
}
```

---

## ANSWERS — `/api/questions/:questionId/answers`

### POST `/api/questions/:questionId/answers` — Trả lời

- **Auth:** Authenticated

```typescript
// Request Body
{
  "content": "Vì React 18 StrictMode...",    // @MinLength(10)
  "codeSnippet": { ... }                      // @IsOptional
}

// Response 201
{ "data": { ...created answer } }
```

---

### POST `/api/answers/:id/vote` — Vote answer

- **Auth:** Authenticated

```typescript
// Request Body
{ "value": 1 }                          // 1 = upvote, -1 = downvote, 0 = remove vote

// Response 200
{ "data": { "voteCount": 15 } }
```

**Business Logic:**

1. Upsert vote: nếu đã vote → update value, nếu chưa → create
2. Recalculate `answer.voteCount = SUM(votes.value)`

---

### PUT `/api/questions/:questionId/best-answer` — Mark best answer

- **Auth:** Question author hoặc course Instructor

```typescript
// Request Body
{ "answerId": "clx..." }

// Response 200
{ "message": "Đã chọn câu trả lời tốt nhất" }
```

---

# MODULE 9: NOTIFICATIONS

## NOTIFICATIONS — `/api/notifications`

### GET `/api/notifications?page=1&limit=20&read=false` — Danh sách notifications

- **Auth:** Authenticated

```typescript
// Response 200
{
  "data": [
    {
      "id": "clx...",
      "type": "POST_LIKED",
      "data": {
        "actorId": "clx...",
        "actorName": "Nguyễn Văn B",
        "actorAvatar": "...",
        "postId": "clx...",
        "postPreview": "Vừa học xong React..."
      },
      "read": false,
      "createdAt": "2024-01-15T10:30:00Z"
    },
    {
      "id": "clx...",
      "type": "ORDER_COMPLETED",
      "data": {
        "orderId": "clx...",
        "orderCode": "SSML000123",
        "courseName": "React Mastery"
      },
      "read": false,
      "createdAt": "2024-01-15T10:25:00Z"
    }
  ],
  "meta": { ... }
}
```

---

### GET `/api/notifications/unread-count` — Số notification chưa đọc

- **Auth:** Authenticated

```typescript
// Response 200
{ "data": { "count": 5 } }
```

---

### PUT `/api/notifications/:id/read` — Mark as read

### PUT `/api/notifications/read-all` — Mark all as read

- **Auth:** Authenticated

---

# MODULE 10: AI TUTOR

## AI — `/api/ai/tutor`

### POST `/api/ai/tutor/ask` — Hỏi AI Tutor

- **Auth:** Authenticated (enrolled in course)
- **Rate limit:** 10 req/day per user (Redis counter)

```typescript
// Request Body
{
  "courseId": "clx...",                  // @IsCuid
  "sessionId": "clx...",                // @IsOptional — null = tạo session mới
  "question": "Giải thích useEffect"    // @MinLength(3), @MaxLength(500)
}

// Response 200 (streaming — SSE hoặc chunked transfer)
// Content-Type: text/event-stream
data: {"token": "use"}
data: {"token": "Effect"}
data: {"token": " là"}
data: {"token": " hook"}
...
data: {"done": true, "sessionId": "clx...", "messageId": "clx..."}
```

**Business Logic (RAG Pipeline):**

1. Check rate limit: Redis `ai_usage:{userId}:{date}` < 10
2. Check enrollment (phải mua khóa mới hỏi được)
3. **Embed question:** Transformers.js → vector 384 dimensions
4. **Search pgvector:** Top 5 relevant chunks trong khóa học
   ```sql
   SELECT content, 1 - (embedding <=> $1::vector) AS similarity
   FROM course_chunks
   WHERE "courseId" = $2
   ORDER BY embedding <=> $1::vector
   LIMIT 5;
   ```
5. **Compose prompt:** system + context + question
6. **Call Groq API:** Stream response (Llama 3.3 70B)
7. Save message to `ai_chat_messages`
8. Increment Redis counter

---

### GET `/api/ai/tutor/sessions?courseId=xxx` — Lịch sử chat sessions

- **Auth:** Authenticated

```typescript
// Response 200
{
  "data": [
    {
      "id": "clx...",
      "courseId": "clx...",
      "title": "Về useEffect...",        // Auto-generated từ first message
      "messageCount": 5,
      "lastMessageAt": "2024-01-15"
    }
  ]
}
```

---

### GET `/api/ai/tutor/sessions/:id/messages` — Messages trong session

- **Auth:** Authenticated (owner)

---

# MODULE 11: RECOMMENDATIONS

## RECOMMENDATIONS — `/api/recommendations`

### GET `/api/recommendations?context=homepage&limit=10` — Gợi ý khóa học

- **Auth:** Public (personalized nếu login)

```typescript
// Query Parameters
?context=homepage                     // homepage | course_detail | post_purchase | post_complete
&courseId=clx...                       // Required nếu context=course_detail
&limit=10

// Response 200
{
  "data": [
    {
      "course": {
        "id": "clx...",
        "title": "Next.js Full Course",
        "thumbnailUrl": "...",
        "price": 599000,
        "avgRating": 4.8,
        "totalStudents": 800
      },
      "score": 0.87,
      "reason": "Dựa trên khóa React bạn đã học"    // Giải thích gợi ý
    }
  ]
}
```

**Business Logic — Context-aware:**

```
homepage (chưa login)  → 100% Popularity
homepage (đã login)    → Hybrid (CB 0.4 + CF 0.4 + Pop 0.2)
course_detail          → Content-Based (similar courses)
post_purchase          → Collaborative ("Người mua khóa này cũng mua...")
post_complete          → Content-Based + Level filter ("Học tiếp...")
```

---

### GET `/api/recommendations/chapters?courseId=xxx` — Smart Chapter Suggestion

- **Auth:** Authenticated (có learning history)

```typescript
// Response 200
{
  "data": {
    "suggestions": [
      {
        "chapterId": "clx...",
        "title": "Async/Await Deep Dive",
        "price": 70000,
        "knowledgeOverlap": 0.2,
        "recommendation": "BUY"
      },
      {
        "chapterId": "clx...",
        "title": "JS Fundamentals",
        "price": 50000,
        "knowledgeOverlap": 0.9,
        "recommendation": "SKIP"
      }
    ],
    "summary": {
      "totalChapters": 4,
      "shouldBuy": 2,
      "canSkip": 2,
      "bundlePrice": 150000,
      "fullCoursePrice": 499000,
      "savings": 349000,
      "tip": "Chỉ cần mua 2 chương, tiết kiệm 349,000đ"
    }
  }
}
```

---

# MODULE 12: ADMIN MANAGEMENT

## ADMIN — `/api/admin`

> Toàn bộ routes dưới đây yêu cầu `@Roles('ADMIN')`

### GET `/api/admin/instructor-applications?status=PENDING&page=1&limit=10`

### PUT `/api/admin/instructor-applications/:id` — Approve/Reject

```typescript
// Request Body
{
  "status": "APPROVED",                 // APPROVED | REJECTED
  "adminNote": "Hồ sơ tốt, welcome!"   // @IsOptional
}

// Response 200
{ "message": "Đã phê duyệt. User đã được nâng cấp thành Instructor." }
```

**Business Logic (Approve):**

1. Update application: `status: APPROVED, reviewedById, reviewedAt`
2. Update user: `role: INSTRUCTOR`
3. Create instructor_profile
4. Notify user (in-app + email)

---

### GET `/api/admin/course-reviews?status=PENDING_REVIEW&page=1`

### PUT `/api/admin/course-reviews/:courseId` — Approve/Reject course

```typescript
// Request Body
{
  "status": "APPROVED",                 // APPROVED | REJECTED
  "feedback": "Khóa học chất lượng tốt"// @IsOptional
}
```

**Business Logic (Approve):**

1. Update course: `status: APPROVED, publishedAt: now`
2. Auto-create course group
3. Trigger search vector update
4. Notify instructor (in-app + email)

---

### GET `/api/admin/users?search=nguyen&role=STUDENT&status=ACTIVE&page=1`

### PUT `/api/admin/users/:id` — Quản lý user

```typescript
// Request Body
{
  "status": "SUSPENDED",               // ACTIVE | SUSPENDED
  "reason": "Vi phạm nội quy"
}
```

---

### GET `/api/admin/reports?status=PENDING&page=1`

### PUT `/api/admin/reports/:id` — Xử lý report

```typescript
// Request Body
{
  "status": "WARNING",                  // DISMISSED | WARNING | CONTENT_REMOVED | USER_SUSPENDED
  "adminNote": "Đã cảnh cáo user"
}
```

---

### GET `/api/admin/withdrawals?status=PENDING&page=1`

### PUT `/api/admin/withdrawals/:id` — Approve/Reject withdrawal

```typescript
// Request Body
{
  "status": "COMPLETED",               // APPROVED | REJECTED | COMPLETED
  "adminNote": "Đã chuyển khoản"
}
```

---

### GET `/api/admin/analytics/dashboard` — Dashboard thống kê nền tảng

```typescript
// Response 200
{
  "data": {
    "overview": {
      "totalUsers": 5000,
      "totalCourses": 200,
      "totalRevenue": 500000000,
      "totalOrders": 3000,
      "activeUsersToday": 150,
      "newUsersThisWeek": 50
    },
    "revenueChart": [...],
    "userGrowthChart": [...],
    "topCourses": [...],
    "topInstructors": [...],
    "pendingApprovals": {
      "instructorApps": 3,
      "courseReviews": 5,
      "reports": 8,
      "withdrawals": 2
    }
  }
}
```

---

### GET `/api/admin/categories` — Danh sách categories

### POST `/api/admin/categories` — Tạo category

### PUT `/api/admin/categories/:id` — Sửa category

### DELETE `/api/admin/categories/:id` — Xóa category (chỉ khi chưa có course)

```typescript
// Request Body
{
  "name": "Web Development",
  "slug": "web-development",
  "description": "Phát triển web...",
  "iconUrl": "...",
  "parentId": null,                      // @IsOptional — subcategory
  "order": 1
}
```

---

### GET `/api/admin/tags?page=1&limit=20&search=react` — Danh sách tags

- **Auth:** Admin

```typescript
// Response 200 (paginated)
{
  "data": [
    {
      "id": "clx...",
      "name": "React",
      "slug": "react",
      "courseCount": 25,
      "createdAt": "2024-01-15"
    }
  ],
  "meta": { ... }
}
```

---

### POST `/api/admin/tags` — Tạo tag

- **Auth:** Admin

```typescript
// Request Body
{ "name": "React" }

// Response 201
{ "data": { "id": "clx...", "name": "React", "slug": "react" } }
```

---

### PATCH `/api/admin/tags/:id` — Cập nhật tag

- **Auth:** Admin

---

### DELETE `/api/admin/tags/:id` — Xóa tag (chỉ khi chưa có course nào dùng)

- **Auth:** Admin

---

### GET `/api/admin/placement-questions?page=1&limit=20&level=BEGINNER` — Danh sách placement questions

- **Auth:** Admin

```typescript
// Response 200 (paginated)
{
  "data": [
    {
      "id": "clx...",
      "level": "BEGINNER",
      "question": "Biến let khác gì var?",
      "options": [...],
      "categoryId": "clx...",
      "createdAt": "2024-01-15"
    }
  ],
  "meta": { ... }
}
```

---

### POST `/api/admin/placement-questions` — Tạo placement question

- **Auth:** Admin

```typescript
// Request Body
{
  "level": "BEGINNER",                    // BEGINNER | INTERMEDIATE | ADVANCED
  "question": "Biến let khác gì var?",
  "explanation": "let có block scope...",
  "categoryId": "clx...",
  "options": [
    { "text": "Block scope", "isCorrect": true },
    { "text": "Function scope", "isCorrect": false },
    { "text": "Global scope", "isCorrect": false }
  ]
}

// Response 201
{ "data": { ...created question } }
```

---

### POST `/api/admin/placement-questions/batch` — Batch tạo placement questions

- **Auth:** Admin

```typescript
// Request Body
{
  "questions": [
    { "level": "BEGINNER", "question": "...", "options": [...] },
    { "level": "INTERMEDIATE", "question": "...", "options": [...] }
  ]
}

// Response 201
{ "data": { "created": 10 } }
```

---

### PATCH `/api/admin/placement-questions/:id` — Cập nhật placement question

- **Auth:** Admin

---

### DELETE `/api/admin/placement-questions/:id` — Xóa placement question

- **Auth:** Admin

---

### GET `/api/admin/commission-tiers` — Danh sách commission tiers

- **Auth:** Admin

```typescript
// Response 200
{
  "data": [
    { "id": "clx...", "minRevenue": 0, "rate": 0.30 },
    { "id": "clx...", "minRevenue": 10000000, "rate": 0.25 },
    { "id": "clx...", "minRevenue": 50000000, "rate": 0.20 }
  ]
}
```

---

### POST `/api/admin/commission-tiers` — Tạo commission tier

- **Auth:** Admin

---

### DELETE `/api/admin/commission-tiers/:id` — Xóa commission tier

- **Auth:** Admin

---

### GET `/api/admin/settings` — Platform settings

### PUT `/api/admin/settings` — Cập nhật settings

```typescript
// Request Body
{
  "commissionTiers": [
    { "minRevenue": 0, "rate": 0.30 },
    { "minRevenue": 10000000, "rate": 0.25 },
    { "minRevenue": 50000000, "rate": 0.20 }
  ],
  "minWithdrawalAmount": 200000,
  "orderExpiryMinutes": 15,
  "maxAiQueriesPerDay": 10,
  "maintenanceMode": false
}
```

---

# MODULE 13: UPLOADS

## UPLOADS — `/api/uploads`

### POST `/api/uploads/sign` — Generate Cloudinary upload signature

- **Auth:** Instructor

```typescript
// Request Body
{
  "lessonId": "clx...",                 // @IsCuid
  "type": "VIDEO"                        // VIDEO | IMAGE | DOCUMENT
}

// Response 200
{
  "data": {
    "mediaId": "clx...",
    "signature": "xxx",
    "timestamp": 1705312200,
    "apiKey": "xxx",
    "cloudName": "xxx",
    "folder": "courses/clx.../lessons/clx...",
    "eager": "c_scale,w_854,h_480|c_scale,w_1280,h_720",
    "eagerAsync": true
  }
}
```

---

### POST `/api/uploads/:mediaId/complete` — Confirm upload complete

- **Auth:** Instructor

```typescript
// Request Body
{
  "cloudinaryResult": {
    "public_id": "courses/xxx/video",
    "secure_url": "https://res.cloudinary.com/...",
    "duration": 1845,
    "format": "mp4",
    "bytes": 52428800,
    "eager": [
      { "url": "https://...480p.mp4" },
      { "url": "https://...720p.mp4" }
    ]
  }
}

// Response 200
{ "data": { "mediaId": "clx...", "status": "READY", "urls": { ... } } }
```

**Business Logic:**

1. Verify media belongs to instructor's lesson
2. Update media: `status: READY, cloudinaryPublicId, urls, duration, fileSize, format`
3. Update lesson: `estimatedDuration = media.duration`
4. Update chapter: recalculate `totalDuration, lessonsCount`
5. Update course: recalculate `totalDuration, totalLessons`

---

## REPORTS — `/api/reports`

### POST `/api/reports` — Tạo report

- **Auth:** Authenticated

```typescript
// Request Body
{
  "targetType": "POST",                 // POST | COMMENT | USER | COURSE | QUESTION
  "targetId": "clx...",
  "reason": "SPAM",                      // SPAM | INAPPROPRIATE | COPYRIGHT | HARASSMENT | OTHER
  "description": "Nội dung spam..."      // @IsOptional, @MaxLength(1000)
}

// Response 201
{ "message": "Báo cáo đã được gửi. Chúng tôi sẽ xem xét sớm nhất." }
```

---

# HEALTH CHECK

### GET `/api/health` — Health check (for keep-alive ping)

- **Auth:** Public

```typescript
// Response 200
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

# Tổng kết API Endpoints

| Module              | Endpoints | Ghi chú                                            |
| ------------------- | --------- | -------------------------------------------------- |
| Auth                | 9         | Register, Login, Refresh, Google, OTT, ...         |
| Users               | 8         | Profile, Follow, Notification prefs                |
| Categories & Tags   | 3         | Public categories (list, detail), public tags      |
| Courses (public)    | 5         | List, Detail, Reviews, Learn, Search               |
| Course Management   | 15        | CRUD course/section/chapter/lesson/quiz            |
| Question Banks      | 13        | Bank CRUD, bank tags, bank questions, batch import |
| Instructor          | 10        | Dashboard, Withdrawals, Coupons, Apply             |
| Ecommerce           | 10        | Cart, Orders, Webhook, Wishlists                   |
| Learning            | 9         | Progress, Quiz, Streak, Certificates, Placement   |
| Social              | 18        | Feed, Posts, Chat, Groups, Join Requests, Bookmarks|
| Q&A Forum           | 8         | Questions, Answers, Votes, Best Answer             |
| Notifications       | 4         | List, Unread count, Read, Read all                 |
| AI Tutor            | 3         | Ask, Sessions, Messages                            |
| Recommendations     | 2         | Courses, Chapter suggestions                       |
| Admin               | 25        | Approvals, Users, Reports, Analytics, Settings, Tags, Placement Questions, Commission Tiers |
| Uploads             | 2         | Sign, Complete                                     |
| Reports             | 1         | Create report                                      |
| Health              | 1         | Health check                                       |
| **TOTAL**           | **~146**  |                                                    |
