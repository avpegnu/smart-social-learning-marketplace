# 01 — Users Service: Profile Management, Follow System, và Pagination

> Giải thích chi tiết UsersService — profile endpoints, follow/unfollow với Prisma transaction,
> enrichWithFollowStatus batch pattern, và paginated results.

---

## 1. TỔNG QUAN USERS SERVICE

### 1.1 Vai trò

UsersService chứa **toàn bộ business logic** cho user profile management và follow system. Theo thin controller pattern, controller chỉ parse request rồi delegate cho service.

```
UsersService — 8 public methods:

Profile:
  ├── getMe(userId)                           → Full profile (authenticated user)
  ├── getPublicProfile(userId, currentUserId?) → Public profile + isFollowing
  ├── updateProfile(userId, dto)              → Partial update
  └── updateNotificationPreferences(userId, preferences)

Follow System:
  ├── follow(followerId, followingId)         → Follow + counter update
  ├── unfollow(followerId, followingId)       → Unfollow + counter update
  ├── getFollowers(userId, pagination, currentUserId?)
  ├── getFollowing(userId, pagination, currentUserId?)
  └── isFollowing(followerId, followingId)    → Boolean check

Private Helper:
  └── enrichWithFollowStatus(users, currentUserId?)
```

### 1.2 Dependency — Chỉ PrismaService

```typescript
@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
}
```

```
So sánh với AuthService (5 dependencies):
  AuthService  → Prisma, JWT, Config, Redis, Mail
  UsersService → Prisma only

Tại sao UsersService đơn giản hơn?
  → Không hash password (không cần bcrypt)
  → Không generate token (không cần JWT/Redis)
  → Không gửi email (không cần Mail)
  → Chỉ CRUD operations trên database
```

### 1.3 `@Inject(PrismaService)` Pattern

```typescript
// ✅ SSLM pattern — dùng @Inject()
constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

// ❌ Thông thường NestJS
constructor(private readonly prisma: PrismaService) {}
```

```
Tại sao cần @Inject() rõ ràng?

ESLint rule: @typescript-eslint/consistent-type-imports
  → Nếu import chỉ dùng cho type annotation → PHẢI "import type"
  → Constructor param type = type annotation → ESLint muốn "import type"
  → Nhưng NestJS DI cần runtime value (emitDecoratorMetadata)

Giải pháp: @Inject(PrismaService)
  → @Inject là decorator → tạo runtime reference
  → ESLint thấy PrismaService dùng trong @Inject() → không phải type-only
  → TypeScript import bình thường, KHÔNG bị strip khi compile
  → DI metadata vẫn có class reference → inject đúng instance

Pattern này áp dụng cho TẤT CẢ constructors trong SSLM:
  AuthController     → @Inject(AuthService)
  UsersController    → @Inject(UsersService)
  InstructorService  → @Inject(PrismaService)
```

---

## 2. PUBLIC_USER_SELECT — DATA PROJECTION

### 2.1 Concept

```typescript
const PUBLIC_USER_SELECT = {
  id: true,
  fullName: true,
  avatarUrl: true,
  bio: true,
} as const;
```

```
Prisma select = chỉ lấy fields cần thiết (SQL SELECT)
  → Giảm data transfer từ DB → application
  → Không leak sensitive fields

PUBLIC_USER_SELECT dùng cho follow lists:
  → Hiển thị avatar, tên, bio — đủ cho UI card
  → KHÔNG cần: email, role, status, password
```

### 2.2 So sánh các select levels

```
1. getMe() — Full profile (authenticated):
   select: {
     id, email, fullName, avatarUrl, bio, role, status,
     followerCount, followingCount, notificationPreferences,
     createdAt, instructorProfile
   }
   → Trả TẤT CẢ thông tin cá nhân (chỉ user tự xem)

2. getPublicProfile() — Public profile:
   select: {
     id, fullName, avatarUrl, bio, role,
     followerCount, followingCount, createdAt,
     instructorProfile: { headline, expertise, totalStudents, totalCourses }
   }
   → Bỏ email, status, notificationPreferences (private)
   → Include instructorProfile nếu là instructor

3. PUBLIC_USER_SELECT — Follow list items:
   select: { id, fullName, avatarUrl, bio }
   → Minimal — chỉ đủ hiển thị user card trong list
```

### 2.3 `as const` — Readonly Literal Types

```typescript
const PUBLIC_USER_SELECT = {
  id: true,
  fullName: true,
} as const;
// TypeScript type: { readonly id: true; readonly fullName: true; }

// Không có "as const":
const SELECT = { id: true, fullName: true };
// TypeScript type: { id: boolean; fullName: boolean; }
// → Prisma không biết chính xác field nào được select
```

---

## 3. PROFILE METHODS

### 3.1 getMe — Authenticated Profile

```typescript
async getMe(userId: string) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, fullName: true, avatarUrl: true,
      bio: true, role: true, status: true,
      followerCount: true, followingCount: true,
      notificationPreferences: true, createdAt: true,
      instructorProfile: true,
    },
  });
  if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
  return user;
}
```

```
Flow:
  1. findUnique({ id: userId }) → tìm user theo ID
  2. select: chỉ lấy fields an toàn (KHÔNG lấy passwordHash, resetToken, etc.)
  3. Không found → 404 { code: 'USER_NOT_FOUND' }

Điểm đặc biệt:
  → Include instructorProfile: true
  → Nếu user là INSTRUCTOR → trả kèm profile (headline, expertise, etc.)
  → Nếu user là STUDENT → instructorProfile = null
  → Frontend hiển thị khác nhau dựa trên có/không có instructorProfile

Tại sao KHÔNG dùng findUnique + include?
  → select vs include:
    select: chỉ lấy fields LIỆT KÊ (whitelist)
    include: lấy TẤT CẢ fields + thêm relations (blacklist approach)
  → select an toàn hơn: nếu thêm field nhạy cảm vào model → KHÔNG tự động lộ
```

### 3.2 getPublicProfile — Public + isFollowing

```typescript
async getPublicProfile(userId: string, currentUserId?: string) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    select: {
      id: true, fullName: true, avatarUrl: true, bio: true, role: true,
      followerCount: true, followingCount: true, createdAt: true,
      instructorProfile: {
        select: { headline: true, expertise: true, totalStudents: true, totalCourses: true },
      },
    },
  });
  if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });

  let isFollowing: boolean | null = null;
  if (currentUserId && currentUserId !== userId) {
    isFollowing = await this.isFollowing(currentUserId, userId);
  }

  return { ...user, isFollowing };
}
```

```
Khác biệt với getMe():
  1. where: { deletedAt: null } → không hiển thị user đã bị soft-delete
  2. select: ÍT fields hơn (không email, status, notificationPreferences)
  3. instructorProfile: nested select (chỉ public fields)
  4. Thêm isFollowing field

isFollowing logic (3 trạng thái):
  ┌─────────────────────────────┬──────────────────────┐
  │ Scenario                    │ isFollowing value    │
  ├─────────────────────────────┼──────────────────────┤
  │ Chưa login (anonymous)     │ null                  │
  │ Xem profile mình           │ null                  │
  │ Đang follow user này       │ true                  │
  │ Chưa follow user này       │ false                 │
  └─────────────────────────────┴──────────────────────┘

Tại sao null cho anonymous và self-view?
  → null = "không áp dụng" (không phải true hay false)
  → Frontend: ẩn nút Follow nếu isFollowing === null
  → Frontend: hiển thị "Follow" nếu false, "Unfollow" nếu true
```

### 3.3 updateProfile — Partial Update

```typescript
async updateProfile(userId: string, dto: UpdateProfileDto) {
  return this.prisma.user.update({
    where: { id: userId },
    data: dto,
    select: { id: true, fullName: true, avatarUrl: true, bio: true },
  });
}
```

```
PATCH semantics:
  → DTO có @IsOptional() trên MỌI field
  → User gửi: { fullName: "New Name" } → chỉ update fullName
  → User gửi: { bio: "New bio" } → chỉ update bio
  → User gửi: {} → không update gì (nhưng vẫn valid request)

data: dto:
  → Prisma.update chỉ update fields CÓ TRONG dto object
  → Fields undefined → KHÔNG bị set thành null
  → Đây là behavior mặc định của Prisma update

select: chỉ return updated fields
  → Client không cần toàn bộ profile sau update
  → Giảm response size
```

### 3.4 updateNotificationPreferences — JSON Field

```typescript
async updateNotificationPreferences(
  userId: string,
  preferences: Record<string, { inApp: boolean; email: boolean }>,
) {
  return this.prisma.user.update({
    where: { id: userId },
    data: { notificationPreferences: preferences },
    select: { id: true, notificationPreferences: true },
  });
}
```

```
Prisma Json field:
  → notificationPreferences: Json? trong schema
  → Lưu entire JSON object trong 1 column
  → PostgreSQL JSONB type → efficient storage + query

Format dữ liệu:
{
  "POST_LIKED":       { "inApp": true,  "email": false },
  "NEW_FOLLOWER":     { "inApp": true,  "email": true  },
  "ORDER_COMPLETED":  { "inApp": true,  "email": true  },
  "COURSE_APPROVED":  { "inApp": true,  "email": true  }
}

Tại sao JSON thay vì separate table?
  → Schema đơn giản (không cần NotificationPreference model)
  → Read/write nhanh (1 query thay vì JOIN)
  → Flexible: thêm notification type mới = thêm key vào JSON
  → Trade-off: không query được per-type (nhưng không cần trong SSLM)
```

---

## 4. FOLLOW SYSTEM

### 4.1 Database Design

```
Follow table:
  ┌─────────────────┐
  │ Follow           │
  ├─────────────────┤
  │ followerId   FK  │ → User.id (người follow)
  │ followingId  FK  │ → User.id (người được follow)
  │ createdAt        │
  └─────────────────┘

  @@id([followerId, followingId])  → composite primary key
  @@unique([followerId, followingId])

User table counters:
  followerCount  Int @default(0)  → Bao nhiêu người follow mình
  followingCount Int @default(0)  → Mình follow bao nhiêu người
```

```
Tại sao counter columns thay vì COUNT query?
  → COUNT(*) trên table lớn = CHẬM (full scan)
  → Counter column: O(1) read vs O(n) COUNT
  → Trade-off: phải update counter khi follow/unfollow
  → Nhưng read NHIỀU hơn write → optimize cho read

Ví dụ:
  User profile page hiển thị "1,234 followers"
  → Với counter: SELECT followerCount FROM users WHERE id = ? (instant)
  → Với COUNT: SELECT COUNT(*) FROM follows WHERE followingId = ? (scan)
```

### 4.2 follow() — Atomic Transaction

```typescript
async follow(followerId: string, followingId: string) {
  // Guard 1: Self-follow check
  if (followerId === followingId) {
    throw new BadRequestException({ code: 'CANNOT_FOLLOW_SELF' });
  }

  // Guard 2: Target exists check
  const targetUser = await this.prisma.user.findUnique({
    where: { id: followingId, deletedAt: null },
    select: { id: true },
  });
  if (!targetUser) {
    throw new NotFoundException({ code: 'USER_NOT_FOUND' });
  }

  // Atomic: create follow + increment both counters
  try {
    await this.prisma.$transaction([
      this.prisma.follow.create({
        data: { followerId, followingId },
      }),
      this.prisma.user.update({
        where: { id: followerId },
        data: { followingCount: { increment: 1 } },
      }),
      this.prisma.user.update({
        where: { id: followingId },
        data: { followerCount: { increment: 1 } },
      }),
    ]);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({ code: 'ALREADY_FOLLOWING' });
    }
    throw error;
  }

  return { message: 'FOLLOWED' };
}
```

### 4.3 Phân tích chi tiết

**Guard clauses — fail fast:**

```
1. Self-follow: followerId === followingId?
   → BadRequest 400 { code: 'CANNOT_FOLLOW_SELF' }
   → Check TRƯỚC khi query database (save 1 query)

2. Target exists: findUnique + deletedAt: null
   → NotFoundException 404 { code: 'USER_NOT_FOUND' }
   → Kiểm tra user tồn tại VÀ chưa bị soft-delete
   → select: { id: true } → chỉ cần biết tồn tại, không cần data
```

**Prisma $transaction — batch operation:**

```typescript
await this.prisma.$transaction([
  this.prisma.follow.create({ ... }),         // 1. Tạo follow record
  this.prisma.user.update({ increment: 1 }),  // 2. +1 followingCount
  this.prisma.user.update({ increment: 1 }),  // 3. +1 followerCount
]);
```

```
$transaction([...]) = Prisma batch transaction:
  → Tất cả operations trong array chạy ATOMIC
  → Nếu 1 operation fail → TẤT CẢ rollback
  → Đảm bảo data consistency

Tại sao cần transaction?
  Không có transaction:
    1. follow.create → OK ✅
    2. user.update (follower) → OK ✅
    3. user.update (following) → FAIL ❌ (DB connection lost)
    → Follow record tồn tại nhưng counter sai!
    → followerCount không tăng → UI hiển thị sai

  Với transaction:
    1. follow.create → OK
    2. user.update → OK
    3. user.update → FAIL
    → ROLLBACK tất cả → follow record cũng bị xóa
    → Data luôn consistent

{ increment: 1 }:
  → Prisma atomic increment (SQL: SET followerCount = followerCount + 1)
  → An toàn cho concurrent requests (không race condition)
  → Nếu dùng: data: { followerCount: user.followerCount + 1 }
    → Race condition: 2 requests đọc cùng value → cả 2 set +1 → chỉ +1 thay vì +2
```

**P2002 — Unique constraint violation:**

```typescript
catch (error) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException({ code: 'ALREADY_FOLLOWING' });
  }
  throw error;  // Re-throw non-P2002 errors
}
```

```
P2002 = Prisma error code cho UNIQUE constraint violation
  → Follow table có @@unique([followerId, followingId])
  → User A follow User B lần 2 → P2002
  → Catch → 409 Conflict { code: 'ALREADY_FOLLOWING' }

Tại sao catch P2002 thay vì check trước?
  ❌ Check-then-create (race condition):
    1. Thread A: findFirst → null (chưa follow)
    2. Thread B: findFirst → null (chưa follow)
    3. Thread A: create → OK
    4. Thread B: create → DUPLICATE!

  ✅ Try-create-catch (optimistic approach):
    1. Luôn try create
    2. DB enforce unique constraint → P2002 nếu duplicate
    3. Catch P2002 → return friendly error
    → Không race condition vì DB handle atomically

Prisma.PrismaClientKnownRequestError:
  → Import as VALUE (không phải type) vì dùng trong instanceof runtime check
  → import { Prisma } from '@prisma/client'; (value import)
  → Đây là lý do import Prisma không có "import type" prefix
```

### 4.4 unfollow() — Check-then-delete

```typescript
async unfollow(followerId: string, followingId: string) {
  const existingFollow = await this.prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
  });
  if (!existingFollow) {
    throw new NotFoundException({ code: 'NOT_FOLLOWING' });
  }

  await this.prisma.$transaction([
    this.prisma.follow.delete({
      where: { followerId_followingId: { followerId, followingId } },
    }),
    this.prisma.user.update({
      where: { id: followerId },
      data: { followingCount: { decrement: 1 } },
    }),
    this.prisma.user.update({
      where: { id: followingId },
      data: { followerCount: { decrement: 1 } },
    }),
  ]);

  return { message: 'UNFOLLOWED' };
}
```

```
Khác biệt với follow():

follow:  try-create-catch (optimistic)
unfollow: check-then-delete (pessimistic)

Tại sao khác approach?
  → follow: duplicate follow = harmless (just return ALREADY_FOLLOWING)
  → unfollow: delete non-existent = Prisma throws RecordNotFound (P2025)
  → P2025 error message không user-friendly
  → Nên check trước → return friendly NOT_FOLLOWING error

followerId_followingId:
  → Prisma composite unique key syntax
  → @@unique([followerId, followingId]) trong schema
  → findUnique cần object: { followerId_followingId: { followerId, followingId } }
  → Format: {fieldA}_{fieldB} cho composite keys

{ decrement: 1 }:
  → Ngược lại với increment
  → SQL: SET followerCount = followerCount - 1
  → Atomic operation (thread-safe)
```

---

## 5. PAGINATED FOLLOW LISTS

### 5.1 getFollowers — Flow hoàn chỉnh

```typescript
async getFollowers(userId: string, pagination: PaginationDto, currentUserId?: string) {
  // Step 1: Parallel queries — data + count
  const [data, total] = await Promise.all([
    this.prisma.follow.findMany({
      where: { followingId: userId },
      include: { follower: { select: PUBLIC_USER_SELECT } },
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { createdAt: 'desc' },
    }),
    this.prisma.follow.count({ where: { followingId: userId } }),
  ]);

  // Step 2: Extract user objects from follow records
  const users = data.map((f) => f.follower);

  // Step 3: Enrich with isFollowing status
  const enriched = await this.enrichWithFollowStatus(users, currentUserId);

  // Step 4: Wrap in paginated result
  return createPaginatedResult(enriched, total, pagination.page, pagination.limit);
}
```

```
Step 1 — Promise.all:
  → 2 queries chạy SONG SONG (parallel)
  → findMany: lấy data trang hiện tại
  → count: tổng số records (cho totalPages)
  → Promise.all nhanh hơn sequential (1 round-trip thay vì 2)

  Destructuring: const [data, total] = await Promise.all([...])
  → data = findMany result (array of Follow with follower relation)
  → total = count result (number)

Step 2 — Map follow → user:
  Follow record: { followerId, followingId, createdAt, follower: { id, fullName, ... } }
  → Chỉ cần follower object cho UI
  → data.map(f => f.follower) → extract user from relation

Step 3 — enrichWithFollowStatus (explained in section 6)

Step 4 — createPaginatedResult:
  → Utility function tạo standardized response format
  → { data: [...], meta: { page, limit, total, totalPages } }
```

### 5.2 PaginationDto — Query String Handling

```typescript
export class PaginationDto {
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  page: number = DEFAULT_PAGE;  // default = 1

  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)               // MAX_LIMIT = 100
  limit: number = DEFAULT_LIMIT; // default = 20

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}
```

```
@Transform — Tại sao cần?
  Query string: ?page=2&limit=10
  → Express parse thành: { page: "2", limit: "10" } (STRING!)
  → @IsInt() sẽ fail vì "2" là string, không phải integer
  → @Transform: convert string → number TRƯỚC khi validate

  Flow: Transform → Validate
  "2" → parseInt → 2 → @IsInt() → ✅

get skip():
  → Computed property (getter)
  → page=1, limit=20 → skip = (1-1) * 20 = 0
  → page=2, limit=20 → skip = (2-1) * 20 = 20
  → page=3, limit=10 → skip = (3-1) * 10 = 20
  → Dùng trực tiếp trong Prisma: { skip: pagination.skip, take: pagination.limit }

Default values:
  → page = 1 (TypeScript class default)
  → limit = 20
  → Client không gửi ?page → page = 1
  → ValidationPipe: transform: true + enableImplicitConversion → apply defaults
```

### 5.3 createPaginatedResult — Standardized Response

```typescript
function createPaginatedResult<T>(data: T[], total: number, page: number, limit: number) {
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
```

```
Response format:
{
  "data": [
    { "id": "f1", "fullName": "User A", "isFollowing": true },
    { "id": "f2", "fullName": "User B", "isFollowing": false }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3    // Math.ceil(45/20) = 3
  }
}

Frontend dùng meta để render pagination:
  → page: trang hiện tại (highlight)
  → totalPages: tổng số trang (render buttons)
  → total: "Showing 20 of 45 results"
```

---

## 6. enrichWithFollowStatus — BATCH FOLLOW LOOKUP

### 6.1 Vấn đề N+1

```
Có list 20 users cần check isFollowing:

Cách NAÏVE (N+1 queries):
  for (user of users) {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { currentUserId, user.id } }
    });
    user.isFollowing = !!follow;
  }
  → 20 queries! (1 per user)

Cách TỐI ƯU (batch query):
  const follows = await prisma.follow.findMany({
    where: { followerId: currentUserId, followingId: { in: userIds } }
  });
  → 1 query cho 20 users!
  → SQL: SELECT * FROM follows WHERE followerId = ? AND followingId IN (?, ?, ...)
```

### 6.2 Implementation

```typescript
private async enrichWithFollowStatus<T extends { id: string }>(
  users: T[],
  currentUserId?: string,
): Promise<(T & { isFollowing: boolean | null })[]> {
  // Early return: anonymous or empty list
  if (!currentUserId || users.length === 0) {
    return users.map((u) => ({ ...u, isFollowing: null }));
  }

  // Batch query: 1 query cho TẤT CẢ users
  const followRecords = await this.prisma.follow.findMany({
    where: {
      followerId: currentUserId,
      followingId: { in: users.map((u) => u.id) },
    },
    select: { followingId: true },
  });

  // Convert to Set for O(1) lookup
  const followingSet = new Set(followRecords.map((f) => f.followingId));

  // Map each user with isFollowing status
  return users.map((u) => ({
    ...u,
    isFollowing: u.id === currentUserId ? null : followingSet.has(u.id),
  }));
}
```

### 6.3 Phân tích từng phần

**Generic type `<T extends { id: string }>`:**

```typescript
private async enrichWithFollowStatus<T extends { id: string }>(
  users: T[],
  currentUserId?: string,
): Promise<(T & { isFollowing: boolean | null })[]>
```

```
TypeScript Generics — Tại sao cần?

<T extends { id: string }>:
  → T = bất kỳ object type nào CÓ field id: string
  → Có thể là { id, fullName, avatarUrl, bio }
  → Hoặc { id, fullName, expertise, headline }
  → Method hoạt động với MỌI user-like object

Return type: (T & { isFollowing: boolean | null })[]
  → T & { isFollowing } = intersection type
  → Original object + thêm isFollowing field
  → TypeScript biết chính xác return type

Ví dụ:
  Input:  { id: "u1", fullName: "Test" }[]
  Output: { id: "u1", fullName: "Test", isFollowing: true }[]
  → TypeScript vẫn biết fullName tồn tại trong result
```

**Early return pattern:**

```typescript
if (!currentUserId || users.length === 0) {
  return users.map((u) => ({ ...u, isFollowing: null }));
}
```

```
Hai trường hợp không cần query:
  1. !currentUserId → anonymous user → tất cả isFollowing = null
  2. users.length === 0 → empty list → không gì để enrich

→ Skip database query → return ngay
→ Performance: tránh unnecessary DB round-trip
```

**Set for O(1) lookup:**

```typescript
const followingSet = new Set(followRecords.map((f) => f.followingId));
// followingSet = Set { "user-1", "user-5", "user-12" }

followingSet.has("user-5");  // true — O(1)
followingSet.has("user-7");  // false — O(1)
```

```
Tại sao Set thay vì Array.includes()?

Array.includes(): O(n) — linear search
  [a, b, c].includes(x) → check a, b, c lần lượt

Set.has(): O(1) — hash lookup
  Set(a, b, c).has(x) → hash x → check bucket → instant

Với 20 users + 10 follow records:
  Array: 20 * 10 = 200 comparisons (worst case)
  Set: 20 * 1 = 20 lookups (constant per lookup)

→ Set luôn nhanh hơn khi check membership
→ Đặc biệt quan trọng khi list lớn (100 users, 50 follows)
```

**Self-follow edge case:**

```typescript
isFollowing: u.id === currentUserId ? null : followingSet.has(u.id),
```

```
Nếu currentUser xuất hiện trong list (ví dụ: follower list):
  → u.id === currentUserId → isFollowing = null
  → Tránh hiển thị "Follow yourself" button

Nếu không phải self:
  → followingSet.has(u.id) → true/false
```

---

## 7. isFollowing — SIMPLE CHECK

```typescript
async isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const follow = await this.prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
  });
  return !!follow;
}
```

```
findUnique + composite key:
  → followerId_followingId = composite unique constraint
  → Prisma tự tạo index → O(1) lookup

!! (double bang) — convert to boolean:
  follow = { followerId: "a", followingId: "b" } → !!follow = true
  follow = null → !!follow = false

Dùng trong getPublicProfile():
  → Single user check (không cần batch)
  → enrichWithFollowStatus cho lists, isFollowing cho single profile
```

---

## 8. ERROR CODES

```
UsersService Error Codes:

Profile:
  USER_NOT_FOUND           → 404 (getMe, getPublicProfile)

Follow:
  CANNOT_FOLLOW_SELF       → 400 BadRequest (follow)
  USER_NOT_FOUND           → 404 (follow — target user không tồn tại)
  ALREADY_FOLLOWING         → 409 Conflict (follow — duplicate P2002)
  NOT_FOLLOWING             → 404 (unfollow — không có follow record)

Tất cả dùng machine-readable codes:
  → throw new XxxException({ code: 'ERROR_CODE' })
  → Frontend map code → localized message
  → Backend KHÔNG trả text tiếng Việt/Anh
```

---

## 9. TÓM TẮT

```
UsersService — Key Patterns:

1. Data Projection (select):
   ├── getMe: full profile (authenticated)
   ├── getPublicProfile: public fields + instructorProfile
   └── PUBLIC_USER_SELECT: minimal cho follow lists

2. Follow System:
   ├── Atomic $transaction: create/delete + counter update
   ├── P2002 catch: optimistic duplicate detection
   ├── { increment/decrement: 1 }: atomic counter operations
   └── Composite key: followerId_followingId

3. Performance:
   ├── Promise.all: parallel queries (data + count)
   ├── enrichWithFollowStatus: batch query thay N+1
   ├── Set: O(1) membership lookup
   └── Counter columns: O(1) follower count read

4. isFollowing (3 trạng thái):
   ├── null: anonymous hoặc self-view
   ├── true: đang follow
   └── false: chưa follow

5. Pagination:
   ├── PaginationDto: page, limit, skip getter
   ├── createPaginatedResult: standardized { data, meta }
   └── meta: { page, limit, total, totalPages }
```
