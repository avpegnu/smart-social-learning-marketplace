# 03 — Module 1: Auth & Users (4 Models)

> Giải thích chi tiết 4 models: User, RefreshToken, InstructorProfile, InstructorApplication.

---

## 1. TỔNG QUAN MODULE

```
┌─────────────────────────────────────────────┐
│              AUTH & USERS MODULE             │
├─────────────────────────────────────────────┤
│                                             │
│  User ──────┬──── RefreshToken              │
│             │                               │
│             ├──── InstructorProfile (1:1)    │
│             │                               │
│             └──── InstructorApplication      │
│                   (reviewer: User)           │
│                                             │
└─────────────────────────────────────────────┘
```

4 models này xử lý:

- **User**: Thông tin tài khoản, xác thực, quan hệ với toàn bộ hệ thống
- **RefreshToken**: JWT refresh tokens (đăng nhập bền vững)
- **InstructorProfile**: Thông tin chi tiết instructor (1:1 với User)
- **InstructorApplication**: Đơn đăng ký trở thành instructor

---

## 2. MODEL USER — Trung tâm của hệ thống

### 2.1 Các fields chính

```prisma
model User {
  id                      String       @id @default(cuid())
  email                   String       @unique
  passwordHash            String?      @map("password_hash")
  fullName                String       @map("full_name")
  avatarUrl               String?      @map("avatar_url")
  bio                     String?
  role                    Role         @default(STUDENT)
  status                  UserStatus   @default(UNVERIFIED)
  provider                AuthProvider @default(LOCAL)
  providerId              String?      @map("provider_id")
  // ...
}
```

### 2.2 Giải thích từng field

| Field          | Type           | Giải thích                                                                 |
| -------------- | -------------- | -------------------------------------------------------------------------- |
| `id`           | String (CUID)  | ID duy nhất, tự động generate                                              |
| `email`        | String @unique | Email đăng nhập — không trùng lặp                                          |
| `passwordHash` | String?        | Mật khẩu đã hash (bcrypt). **Nullable** vì Google login không cần password |
| `fullName`     | String         | Họ tên đầy đủ                                                              |
| `avatarUrl`    | String?        | URL ảnh đại diện (Cloudinary). Nullable — có thể chưa upload               |
| `bio`          | String?        | Giới thiệu bản thân                                                        |
| `role`         | Role           | STUDENT (default), INSTRUCTOR, hoặc ADMIN                                  |
| `status`       | UserStatus     | UNVERIFIED → ACTIVE → SUSPENDED                                            |
| `provider`     | AuthProvider   | LOCAL (email/password) hoặc GOOGLE (OAuth)                                 |
| `providerId`   | String?        | Google user ID. Chỉ có khi provider = GOOGLE                               |

### 2.3 Tại sao `passwordHash` thay vì `password`?

**KHÔNG BAO GIỜ** lưu password dạng plaintext. Luôn hash trước khi lưu:

```typescript
import * as bcrypt from 'bcryptjs';

// Khi register:
const passwordHash = await bcrypt.hash('Admin@123', 12);
// → "$2a$12$Xk3F2..." (60 ký tự, không thể reverse)

// Khi login:
const isMatch = await bcrypt.compare('Admin@123', passwordHash);
// → true
```

Số `12` là **salt rounds** — càng cao càng an toàn nhưng chậm hơn. 12 là mức phổ biến (~250ms).

### 2.4 Tại sao `passwordHash` là optional (String?)?

Vì user đăng nhập bằng Google **không có password**:

```
LOCAL login:  email + password → passwordHash có giá trị
GOOGLE login: email + Google token → passwordHash = null, providerId = "google_xxx"
```

### 2.5 Fields xác thực email & reset password

```prisma
verificationToken       String?      @map("verification_token")
verificationExpiresAt   DateTime?    @map("verification_expires_at")
resetToken              String?      @map("reset_token")
resetTokenExpiresAt     DateTime?    @map("reset_token_expires_at")
```

**Flow xác thực email:**

```
1. User register → tạo verificationToken (random string) + expiresAt (24h)
2. Gửi email chứa link: /verify?token=abc123
3. User click link → check token + chưa hết hạn → status = ACTIVE
4. Xóa verificationToken
```

**Flow reset password:**

```
1. User request reset → tạo resetToken + expiresAt (1h)
2. Gửi email chứa link: /reset-password?token=xyz789
3. User nhập password mới → check token + chưa hết hạn → update passwordHash
4. Xóa resetToken
```

### 2.6 Denormalized counters

```prisma
followerCount           Int          @default(0) @map("follower_count")
followingCount          Int          @default(0) @map("following_count")
```

**Denormalization** = lưu thừa data để query nhanh hơn.

```sql
-- Không denormalize — cần COUNT mỗi lần hiển thị profile (chậm)
SELECT u.*, COUNT(f.follower_id) AS follower_count
FROM users u LEFT JOIN follows f ON f.following_id = u.id
WHERE u.id = 'xxx' GROUP BY u.id;

-- Có denormalize — đọc trực tiếp từ cột (nhanh)
SELECT follower_count FROM users WHERE id = 'xxx';
```

Trade-off: Cần update counter mỗi khi follow/unfollow (dùng Prisma transaction).

### 2.7 Relations — User là "hub" của hệ thống

User có **30+ relations** — nhiều nhất trong schema. Mỗi relation là một mối quan hệ với model khác:

```prisma
// 1:N — User có nhiều courses (instructor)
courses             Course[]

// 1:1 — User có tối đa 1 instructor profile
instructorProfile   InstructorProfile?

// N:M (qua junction) — User có nhiều enrollments
enrollments         Enrollment[]

// Self-referencing — User follow User khác
followers           Follow[]    @relation("following")
following           Follow[]    @relation("follower")
```

### 2.8 Soft delete

```prisma
deletedAt DateTime? @map("deleted_at")
```

User có soft delete vì:

- Admin suspend account → không xóa data ngay
- User request xóa account → có thể khôi phục trong 30 ngày
- Foreign key references từ nhiều bảng → xóa thật sẽ cascade nguy hiểm

---

## 3. MODEL REFRESHTOKEN

```prisma
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
```

### 3.1 JWT Authentication Flow trong SSLM

```
Login thành công:
├── Access Token (15 phút TTL) → lưu trong memory (JavaScript variable)
└── Refresh Token (7 ngày TTL) → lưu trong httpOnly cookie + database

Khi Access Token hết hạn:
├── Client gửi Refresh Token (tự động từ cookie)
├── Backend check: token tồn tại trong DB? + chưa hết hạn?
├── ✅ OK → cấp Access Token mới + Refresh Token mới (rotate)
└── ❌ Fail → logout, redirect /login
```

### 3.2 Tại sao lưu Refresh Token trong DB?

- **Revoke**: Admin có thể logout user từ xa bằng cách xóa token trong DB
- **Detect theft**: Nếu token đã dùng rồi (bị đánh cắp), server phát hiện và revoke tất cả tokens
- **Multi-device**: 1 user có thể login trên nhiều thiết bị — mỗi thiết bị 1 refresh token

### 3.3 `onDelete: Cascade`

```prisma
user User @relation(fields: [userId], references: [id], onDelete: Cascade)
```

Khi xóa User → **tự động xóa tất cả RefreshTokens** của user đó. Cascade delete đảm bảo không có orphan records.

### 3.4 Indexes

```prisma
@@index([userId])      // Tìm nhanh tokens theo user
@@index([expiresAt])   // Dùng cho cron job xóa expired tokens
```

**Cron job:** Hằng ngày chạy `DELETE FROM refresh_tokens WHERE expires_at < NOW()` để dọn dẹp tokens hết hạn.

---

## 4. MODEL INSTRUCTORPROFILE

```prisma
model InstructorProfile {
  id             String   @id @default(cuid())
  userId         String   @unique @map("user_id")    // 1:1 với User
  headline       String?
  biography      String?
  expertise      String[]                             // Array of strings
  experience     String?
  qualifications Json?
  socialLinks    Json?    @map("social_links")
  totalStudents  Int      @default(0) @map("total_students")
  totalCourses   Int      @default(0) @map("total_courses")
  totalRevenue   Float    @default(0) @map("total_revenue")
  // ...
}
```

### 4.1 Tại sao tách InstructorProfile ra model riêng?

Không phải mọi User đều là Instructor. Nếu gộp vào User:

```prisma
// ❌ Gộp — User model phình to, 80% fields null cho Students
model User {
  // ... fields chung
  headline      String?    // null cho students
  biography     String?    // null cho students
  expertise     String[]   // empty cho students
  totalStudents Int?       // null cho students
  totalRevenue  Float?     // null cho students
}
```

```prisma
// ✅ Tách — chỉ Instructor mới có profile
model User {
  // ... fields chung
  instructorProfile InstructorProfile?  // null cho students
}

model InstructorProfile {
  userId String @unique    // 1:1 relationship
  // ... instructor-only fields
}
```

### 4.2 `String[]` — PostgreSQL Array type

```prisma
expertise String[]    // ["React", "Node.js", "TypeScript"]
```

PostgreSQL hỗ trợ array columns natively:

```sql
CREATE TABLE instructor_profiles (
  expertise TEXT[]    -- Array of text
);

INSERT INTO instructor_profiles (expertise) VALUES (ARRAY['React', 'Node.js']);
SELECT * FROM instructor_profiles WHERE 'React' = ANY(expertise);
```

### 4.3 `Json` type — Flexible data

```prisma
qualifications Json?    // Cấu trúc không cố định
socialLinks    Json?    // Cấu trúc không cố định
```

Dùng `Json` khi data có structure nhưng không cần query riêng từng field:

```json
// qualifications
[
  { "name": "AWS Certified", "year": 2023, "url": "https://..." },
  { "name": "Google Cloud Professional", "year": 2024 }
]

// socialLinks
{
  "github": "https://github.com/user",
  "linkedin": "https://linkedin.com/in/user",
  "youtube": "https://youtube.com/@user"
}
```

> **Khi nào dùng Json vs tạo model riêng?**
>
> - `Json`: Data phụ trợ, ít query, structure linh hoạt
> - Model riêng: Data cần query, filter, join, hoặc có many-to-many relationship

### 4.4 `@unique` trên userId — One-to-one relationship

```prisma
userId String @unique @map("user_id")
```

`@unique` đảm bảo **mỗi User chỉ có tối đa 1 InstructorProfile**. Đây là cách Prisma implement 1:1 relationship.

---

## 5. MODEL INSTRUCTORAPPLICATION

```prisma
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

  user       User  @relation("applicant", fields: [userId], references: [id], onDelete: Cascade)
  reviewedBy User? @relation("reviewer", fields: [reviewedById], references: [id])

  @@index([userId])
  @@index([status])
}
```

### 5.1 Flow đăng ký Instructor

```
Student muốn trở thành Instructor:
│
├── 1. Gửi đơn (InstructorApplication):
│       expertise, experience, motivation, CV, certificates
│       status = PENDING
│
├── 2. Admin review đơn:
│       ├── APPROVED → tạo InstructorProfile + đổi role = INSTRUCTOR
│       └── REJECTED → ghi reviewNote lý do
│
└── 3. Student có thể gửi lại đơn mới nếu bị rejected
```

### 5.2 Named Relations — `@relation("applicant")` và `@relation("reviewer")`

```prisma
user       User  @relation("applicant", ...)
reviewedBy User? @relation("reviewer", ...)
```

**Tại sao cần đặt tên relation?**

Vì InstructorApplication có **2 foreign keys cùng trỏ về User**:

- `userId` — người nộp đơn (applicant)
- `reviewedById` — admin review đơn (reviewer)

Prisma cần tên riêng để phân biệt. Tương ứng trong model User:

```prisma
model User {
  instructorApplications InstructorApplication[] @relation("applicant")
  reviewedApplications   InstructorApplication[] @relation("reviewer")
}
```

### 5.3 Index trên `status`

```prisma
@@index([status])    // Tìm nhanh đơn PENDING cần review
```

Admin thường xuyên query: "Lấy tất cả đơn đang PENDING" → index giúp query nhanh.

---

## 6. QUAN HỆ GIỮA 4 MODELS

```
User (1) ──────── (N) RefreshToken
  │                   onDelete: Cascade (xóa user → xóa tokens)
  │
  │── (1) ──────── (0..1) InstructorProfile
  │                        onDelete: Cascade
  │
  │── as applicant (1) ── (N) InstructorApplication
  │                           onDelete: Cascade
  │
  └── as reviewer (0..1) ── (N) InstructorApplication
                                onDelete: SetNull (default)
```

### Cascade vs SetNull

| onDelete               | Khi xóa User                                 | Ví dụ                                                         |
| ---------------------- | -------------------------------------------- | ------------------------------------------------------------- |
| **Cascade**            | Xóa luôn records liên quan                   | RefreshToken, InstructorProfile — data thuộc về user          |
| **SetNull**            | Set foreign key = null                       | reviewedById = null — đơn vẫn tồn tại, chỉ mất info ai review |
| **Restrict** (default) | Không cho xóa User nếu còn records liên quan | —                                                             |
