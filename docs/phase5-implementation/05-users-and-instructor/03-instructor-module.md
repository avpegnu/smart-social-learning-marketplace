# 03 — Instructor Module: Application Flow, Profile Management, Dashboard, và Prisma JSON Casting

> Giải thích InstructorService, InstructorController — application submission, role-based guards,
> instructor profile upsert, dashboard aggregation, Prisma JSON casting, và @ValidateNested.

---

## 1. TỔNG QUAN INSTRUCTOR MODULE

### 1.1 Business Domain

```
Instructor lifecycle trong SSLM:

1. STUDENT nộp đơn (submitApplication)
   → Gửi expertise, experience, motivation
   → Status: PENDING

2. ADMIN review (AdminModule — Phase 5.11)
   → Approve → User role: STUDENT → INSTRUCTOR
   → Reject → status: REJECTED (có thể nộp lại)

3. INSTRUCTOR setup profile (updateProfile)
   → headline, biography, qualifications, socialLinks
   → Upsert: tạo mới nếu chưa có, update nếu đã có

4. INSTRUCTOR xem dashboard (getDashboard)
   → Revenue, students, courses, recent earnings
```

### 1.2 Module Structure

```
modules/instructor/
├── instructor.module.ts
├── instructor.controller.ts        → 5 endpoints
├── instructor.service.ts           → 5 methods
├── instructor.controller.spec.ts   → 5 tests
├── instructor.service.spec.ts      → 10 tests
└── dto/
    ├── create-application.dto.ts
    ├── update-instructor-profile.dto.ts
    └── dto.validation.spec.ts      → 13 tests
```

### 1.3 Endpoint Map

```
┌──────────┬──────────────┬────────────────────────────┬──────────────────────────────┐
│ Method   │ @Roles       │ Route                      │ Description                  │
├──────────┼──────────────┼────────────────────────────┼──────────────────────────────┤
│ POST     │ STUDENT      │ /instructor/applications    │ Submit application           │
│ GET      │ (any auth)   │ /instructor/applications/me │ Check application status     │
│ GET      │ INSTRUCTOR   │ /instructor/profile         │ Get instructor profile       │
│ PATCH    │ INSTRUCTOR   │ /instructor/profile         │ Update instructor profile    │
│ GET      │ INSTRUCTOR   │ /instructor/dashboard       │ Get dashboard stats          │
└──────────┴──────────────┴────────────────────────────┴──────────────────────────────┘

Tất cả 5 endpoints đều REQUIRE authentication (không có @Public).
@Roles() thêm layer RBAC (Role-Based Access Control).
```

---

## 2. ROLE-BASED ACCESS CONTROL (RBAC)

### 2.1 @UseGuards(RolesGuard) + @Roles()

```typescript
@Controller('instructor')
@ApiTags('Instructor')
@ApiBearerAuth()
@UseGuards(RolesGuard)      // Class-level guard
export class InstructorController {

  @Post('applications')
  @Roles('STUDENT')           // Chỉ STUDENT mới nộp đơn
  async submitApplication(...) {}

  @Get('applications/me')
  // Không có @Roles() → bất kỳ authenticated user
  async getApplicationStatus(...) {}

  @Get('dashboard')
  @Roles('INSTRUCTOR')        // Chỉ INSTRUCTOR xem dashboard
  async getDashboard(...) {}
}
```

### 2.2 Guard Execution Flow

```
HTTP Request → Guard Chain:

1. JwtAuthGuard (GLOBAL — APP_GUARD):
   ├── Extract JWT from Authorization header
   ├── Verify signature + expiration
   ├── Set request.user = { sub: "userId", role: "STUDENT" }
   └── Pass ✅ hoặc 401 Unauthorized ❌

2. RolesGuard (CLASS-LEVEL — @UseGuards):
   ├── Read @Roles() metadata từ handler
   │   ├── @Roles('STUDENT') → requiredRoles = ['STUDENT']
   │   ├── @Roles('INSTRUCTOR') → requiredRoles = ['INSTRUCTOR']
   │   └── No @Roles() → requiredRoles = undefined → skip check → ✅
   │
   ├── Get request.user.role (from JwtAuthGuard)
   ├── Check: requiredRoles.includes(user.role)?
   │   ├── YES → Pass ✅
   │   └── NO → 403 Forbidden ❌
   └── Done

3. Controller Handler (if guards pass)
```

### 2.3 Tại sao @UseGuards ở class level?

```
@UseGuards(RolesGuard) trên class:
  → Apply cho TẤT CẢ endpoints trong controller
  → Mỗi endpoint có thể có @Roles() khác nhau

Alternative: @UseGuards ở method level
  @Get('dashboard')
  @UseGuards(RolesGuard)
  @Roles('INSTRUCTOR')
  → Phải repeat @UseGuards mỗi method

Class level DRY hơn:
  → 1 @UseGuards cho 5 endpoints
  → @Roles() override per-endpoint
  → Endpoint KHÔNG có @Roles() → RolesGuard skip → cho phép all roles
```

### 2.4 Applications/me — No @Roles()

```typescript
@Get('applications/me')
@ApiOperation({ summary: 'Check application status' })
async getApplicationStatus(@CurrentUser() user: JwtPayload) {
  return this.instructorService.getApplicationStatus(user.sub);
}
```

```
Không có @Roles():
  → RolesGuard thấy requiredRoles = undefined → skip check
  → BẤT KỲ authenticated user đều có thể gọi

Tại sao?
  → STUDENT: kiểm tra trạng thái đơn đã nộp
  → INSTRUCTOR: xem lại history đơn cũ (informational)
  → Cả hai đều có lý do hợp lệ để xem
```

---

## 3. INSTRUCTOR SERVICE — APPLICATION FLOW

### 3.1 submitApplication — Business Rules

```typescript
async submitApplication(userId: string, dto: CreateApplicationDto) {
  // Rule 1: User must exist
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });

  // Rule 2: Already instructor → cannot apply
  if (user.role === 'INSTRUCTOR') {
    throw new BadRequestException({ code: 'ALREADY_INSTRUCTOR' });
  }

  // Rule 3: No pending application
  const pending = await this.prisma.instructorApplication.findFirst({
    where: { userId, status: 'PENDING' },
  });
  if (pending) {
    throw new BadRequestException({ code: 'APPLICATION_ALREADY_PENDING' });
  }

  // Create application
  return this.prisma.instructorApplication.create({
    data: { userId, ...dto },
  });
}
```

### 3.2 Business Rules phân tích

```
3 guard clauses — kiểm tra TRƯỚC khi tạo application:

Rule 1: User exists?
  → findUnique + select: { role: true }
  → Chỉ cần role, không cần other fields → minimal query
  → Không found → 404 USER_NOT_FOUND

Rule 2: Not already INSTRUCTOR?
  → INSTRUCTOR đã được approve → không cần nộp lại
  → 400 ALREADY_INSTRUCTOR

Rule 3: No PENDING application?
  → findFirst: tìm application status = PENDING
  → Có pending → 400 APPLICATION_ALREADY_PENDING
  → Tránh spam nhiều đơn

  Lưu ý: REJECTED application → CÓ THỂ nộp lại
  → findFirst chỉ check PENDING, không check REJECTED
  → User bị reject → sửa đơn → nộp lại → tạo application MỚI
```

### 3.3 Data spread: `{ userId, ...dto }`

```typescript
return this.prisma.instructorApplication.create({
  data: { userId, ...dto },
});
```

```
dto = { expertise: ['React'], experience: '...', motivation: '...' }
userId = "user-1"

Spread: { userId, ...dto } = {
  userId: "user-1",
  expertise: ['React'],
  experience: '...',
  motivation: '...'
}

→ Prisma create với tất cả fields
→ Prisma tự thêm id (CUID), createdAt, updatedAt
→ status mặc định: PENDING (schema default)
```

### 3.4 getApplicationStatus

```typescript
async getApplicationStatus(userId: string) {
  return this.prisma.instructorApplication.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
}
```

```
findMany:
  → Trả TẤT CẢ applications của user (cả PENDING, APPROVED, REJECTED)
  → orderBy: { createdAt: 'desc' } → mới nhất trước
  → take: 5 → giới hạn 5 applications gần nhất

Tại sao take: 5?
  → User có thể nộp nhiều lần (bị reject → nộp lại)
  → Không cần history quá xa
  → Performance: giới hạn result set
  → Frontend hiển thị "Application History" card
```

---

## 4. INSTRUCTOR PROFILE — UPSERT PATTERN

### 4.1 Upsert là gì?

```
UPSERT = UPDATE + INSERT:
  → Nếu record TỒN TẠI → UPDATE
  → Nếu record KHÔNG TỒN TẠI → CREATE

Tại sao dùng upsert cho instructor profile?
  → Instructor mới approve → chưa có profile → CREATE
  → Instructor update profile → đã có profile → UPDATE
  → 1 method handle cả 2 case
  → Client không cần biết profile đã tồn tại hay chưa
```

### 4.2 Implementation

```typescript
async updateProfile(userId: string, dto: UpdateInstructorProfileDto) {
  const { qualifications, socialLinks, ...rest } = dto;

  const data: Prisma.InstructorProfileUncheckedUpdateInput = {
    ...rest,
    ...(qualifications !== undefined && {
      qualifications: qualifications as unknown as Prisma.InputJsonValue,
    }),
    ...(socialLinks !== undefined && {
      socialLinks: socialLinks as unknown as Prisma.InputJsonValue,
    }),
  };

  return this.prisma.instructorProfile.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data } as Prisma.InstructorProfileUncheckedCreateInput,
  });
}
```

### 4.3 Destructuring — Tách JSON fields

```typescript
const { qualifications, socialLinks, ...rest } = dto;
```

```
DTO có 6 fields:
  dto = {
    headline?: string,
    biography?: string,
    expertise?: string[],
    experience?: string,
    qualifications?: QualificationItem[],   ← JSON
    socialLinks?: Record<string, string>,   ← JSON
  }

Destructuring:
  qualifications = QualificationItem[] | undefined
  socialLinks = Record<string, string> | undefined
  rest = { headline?, biography?, expertise?, experience? }

Tại sao tách?
  → qualifications và socialLinks là Prisma Json fields
  → TypeScript type QualificationItem[] ≠ Prisma.InputJsonValue
  → Cần explicit casting cho JSON fields
  → rest (string/string[] fields) → pass trực tiếp cho Prisma
```

### 4.4 Prisma JSON Casting — TypeScript Deep Dive

```typescript
...(qualifications !== undefined && {
  qualifications: qualifications as unknown as Prisma.InputJsonValue,
}),
```

**Conditional spread pattern:**

```typescript
// Pattern: ...(condition && { key: value })
// Nếu condition = false → ...(false) → spread nothing
// Nếu condition = true  → ...({ key: value }) → thêm field

// Ví dụ:
qualifications = undefined → false && {...} → false → không thêm field
qualifications = [{...}]  → true && {...}  → { qualifications: casted_value }

// Tại sao check !== undefined?
// Nếu client KHÔNG gửi qualifications → undefined → KHÔNG update
// Nếu client gửi qualifications = [] → update thành empty array
// KHÁC: nếu không check → qualifications undefined bị set thành null trong DB
```

**Double casting: `as unknown as Prisma.InputJsonValue`:**

```typescript
qualifications as unknown as Prisma.InputJsonValue
```

```
TypeScript type system:

QualificationItem[] =
  { name: string; institution: string; year?: string }[]

Prisma.InputJsonValue =
  string | number | boolean | null |
  InputJsonObject | InputJsonArray

TypeScript thấy:
  QualificationItem[] ≠ InputJsonValue
  → Direct cast: qualifications as Prisma.InputJsonValue → ❌ TS Error
  → "Conversion of type 'QualificationItem[]' to type 'InputJsonValue'
     may be a mistake because neither type sufficiently overlaps"

Giải pháp: double cast qua `unknown`:
  QualificationItem[] → unknown → InputJsonValue
  → `unknown` = TypeScript "any" nhưng an toàn hơn
  → Cast qua unknown = "trust me, I know what I'm doing"

Tại sao runtime safe?
  → QualificationItem[] = array of plain objects
  → InputJsonValue accepts arrays of objects
  → Runtime data format ĐÚNG, chỉ TypeScript type system không biết
  → Prisma serialize thành JSONB → store trong PostgreSQL
```

**Prisma.InstructorProfileUncheckedUpdateInput:**

```typescript
const data: Prisma.InstructorProfileUncheckedUpdateInput = { ... };
```

```
Prisma generate 2 loại input types:

1. InstructorProfileUpdateInput (checked):
   → Relation fields dùng connect/create/update syntax
   → user: { connect: { id: "..." } }

2. InstructorProfileUncheckedUpdateInput (unchecked):
   → Relation fields dùng scalar ID trực tiếp
   → userId: "..."

SSLM dùng Unchecked vì:
  → Đã có userId (from JWT) → set trực tiếp
  → Đơn giản hơn connect syntax
  → Create: { userId, ...data } → truyền userId scalar
```

### 4.5 Upsert operation

```typescript
return this.prisma.instructorProfile.upsert({
  where: { userId },                // Tìm profile theo userId
  update: data,                      // Nếu tìm thấy → update
  create: { userId, ...data } as Prisma.InstructorProfileUncheckedCreateInput,
});
```

```
Prisma upsert:
  1. WHERE: tìm record theo userId (unique field)
  2. Nếu FOUND → run UPDATE với data
  3. Nếu NOT FOUND → run CREATE với { userId, ...data }

  → Atomic operation (race-safe)
  → Không cần check-then-create pattern
  → 1 query thay vì 2 (findUnique + create/update)

create cast:
  { userId, ...data } as Prisma.InstructorProfileUncheckedCreateInput
  → Create cần userId (required field)
  → data chỉ có update fields → thêm userId
  → Cast vì TypeScript cannot verify spread type
```

---

## 5. INSTRUCTOR DASHBOARD — PARALLEL AGGREGATION

### 5.1 Implementation

```typescript
async getDashboard(userId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [profile, courseCount, availableBalance, pendingBalance, recentEarnings] =
    await Promise.all([
      // 1. Profile stats
      this.prisma.instructorProfile.findUnique({
        where: { userId },
        select: { totalStudents: true, totalCourses: true, totalRevenue: true },
      }),
      // 2. Active course count
      this.prisma.course.count({
        where: { instructorId: userId, deletedAt: null },
      }),
      // 3. Available balance (sum)
      this.prisma.earning.aggregate({
        where: { instructorId: userId, status: 'AVAILABLE' },
        _sum: { netAmount: true },
      }),
      // 4. Pending balance (sum)
      this.prisma.earning.aggregate({
        where: { instructorId: userId, status: 'PENDING' },
        _sum: { netAmount: true },
      }),
      // 5. Recent earnings (last 30 days)
      this.prisma.earning.findMany({
        where: {
          instructorId: userId,
          createdAt: { gte: thirtyDaysAgo },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          orderItem: { select: { title: true, price: true } },
        },
      }),
    ]);

  // 6. Top courses by students
  const courseStats = await this.prisma.course.findMany({
    where: { instructorId: userId, deletedAt: null },
    select: { id: true, title: true, totalStudents: true, avgRating: true },
    orderBy: { totalStudents: 'desc' },
    take: 10,
  });

  return {
    overview: {
      totalRevenue: profile?.totalRevenue ?? 0,
      totalStudents: profile?.totalStudents ?? 0,
      totalCourses: courseCount,
      availableBalance: availableBalance._sum.netAmount ?? 0,
      pendingBalance: pendingBalance._sum.netAmount ?? 0,
    },
    recentEarnings,
    courseStats,
  };
}
```

### 5.2 Promise.all — 5 Parallel Queries

```
Không có Promise.all (sequential):
  Profile  → 50ms
  Count    → 30ms
  Agg 1   → 40ms
  Agg 2   → 40ms
  Earnings → 60ms
  ─────────────
  Total:   220ms

Với Promise.all (parallel):
  Profile  ━━━ 50ms
  Count    ━━ 30ms
  Agg 1    ━━━ 40ms
  Agg 2    ━━━ 40ms
  Earnings ━━━━ 60ms
  ─────────────
  Total:   ~60ms (max of parallel queries)

→ ~3.6x faster!
→ Tất cả queries independent → chạy parallel an toàn
```

### 5.3 Prisma aggregate — Sum Earnings

```typescript
this.prisma.earning.aggregate({
  where: { instructorId: userId, status: 'AVAILABLE' },
  _sum: { netAmount: true },
})
// Result: { _sum: { netAmount: 3000000 } } (VND)
// Hoặc: { _sum: { netAmount: null } } (không có earnings)
```

```
Prisma aggregate:
  → SQL: SELECT SUM(net_amount) FROM earnings
         WHERE instructor_id = ? AND status = 'AVAILABLE'
  → Return: { _sum: { netAmount: number | null } }
  → null khi không có records match → dùng ?? 0 fallback

2 aggregate queries:
  AVAILABLE balance: tiền đã xác nhận, có thể rút
  PENDING balance: tiền chờ xác nhận (7-14 ngày)
  → Dashboard hiển thị cả hai
```

### 5.4 Nullish Coalescing `??`

```typescript
overview: {
  totalRevenue: profile?.totalRevenue ?? 0,
  totalStudents: profile?.totalStudents ?? 0,
  totalCourses: courseCount,
  availableBalance: availableBalance._sum.netAmount ?? 0,
  pendingBalance: pendingBalance._sum.netAmount ?? 0,
},
```

```
profile?.totalRevenue ?? 0:

?. (optional chaining):
  → profile = null → undefined (không throw error)
  → profile = { totalRevenue: 5000000 } → 5000000

?? (nullish coalescing):
  → undefined ?? 0 → 0
  → null ?? 0 → 0
  → 5000000 ?? 0 → 5000000
  → 0 ?? 0 → 0 (KHÁC || vì 0 là falsy nhưng ?? chỉ check null/undefined)

Tại sao ?? thay vì ||?
  profile?.totalRevenue || 0:
    0 || 0 → 0 ← OK
    null || 0 → 0 ← OK
    0 || 5 → 5 ← BUG! (0 là giá trị hợp lệ nhưng bị thay)

  profile?.totalRevenue ?? 0:
    0 ?? 5 → 0 ← ĐÚNG (0 giữ nguyên)
    null ?? 5 → 5 ← ĐÚNG (null thay bằng default)
```

### 5.5 courseStats — Sequential Query

```typescript
const courseStats = await this.prisma.course.findMany({
  where: { instructorId: userId, deletedAt: null },
  select: { id: true, title: true, totalStudents: true, avgRating: true },
  orderBy: { totalStudents: 'desc' },
  take: 10,
});
```

```
Tại sao KHÔNG trong Promise.all?

→ courseStats INDEPENDENT với 5 queries trên
→ CÓ THỂ thêm vào Promise.all → nhanh hơn

Lý do tách ra:
  → Readability: 6 queries trong Promise.all khó đọc
  → Promise.all destructuring dài: [a, b, c, d, e, f]
  → Trade-off: ~10ms slower vs code clarity
  → Dashboard load 1-2 lần/session → 10ms acceptable

Optimization nếu cần:
  → Thêm vào Promise.all → 6 parallel queries
  → Hoặc dùng Promise.all cho cả 2 phần
```

---

## 6. DTOs — CREATE APPLICATION & UPDATE PROFILE

### 6.1 CreateApplicationDto

```typescript
export class CreateApplicationDto {
  @ApiProperty({ example: ['JavaScript', 'React', 'Node.js'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  expertise!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(50)
  experience?: string;

  @IsOptional()
  @IsString()
  motivation?: string;

  @IsOptional()
  @IsString()
  cvUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certificateUrls?: string[];
}
```

**Array validation — `{ each: true }`:**

```typescript
@IsArray()                    // Phải là array
@ArrayMinSize(1)              // Ít nhất 1 phần tử
@IsString({ each: true })    // MỖI phần tử phải là string
expertise!: string[];
```

```
{ each: true } — class-validator option:
  → Apply validator cho TỪNG PHẦN TỬ trong array
  → KHÔNG có each: validate toàn bộ array là string → fail

  ['React', 'Node.js']  → @IsArray ✅ → @ArrayMinSize(1) ✅ → each string ✅
  []                     → @IsArray ✅ → @ArrayMinSize(1) ❌ (empty)
  [123, 'React']         → @IsArray ✅ → @ArrayMinSize(1) ✅ → 123 not string ❌
  'React'                → @IsArray ❌ (not array)
```

**@MinLength(50) cho experience:**

```
experience?: string;
  → Optional field
  → Nhưng NẾU gửi → phải >= 50 ký tự
  → Buộc viết chi tiết, không chỉ "5 years"
  → Giúp admin đánh giá application quality
```

### 6.2 UpdateInstructorProfileDto — @ValidateNested

```typescript
export class QualificationItem {
  @IsString()
  name!: string;

  @IsString()
  institution!: string;

  @IsOptional()
  @IsString()
  year?: string;
}

export class UpdateInstructorProfileDto {
  // ... string fields ...

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QualificationItem)
  qualifications?: QualificationItem[];

  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;
}
```

**@ValidateNested + @Type — Deep Validation:**

```typescript
@IsOptional()                        // Skip nếu không gửi
@IsArray()                           // Phải là array
@ValidateNested({ each: true })      // Validate MỖI phần tử theo class
@Type(() => QualificationItem)       // Transform mỗi phần tử thành QualificationItem
qualifications?: QualificationItem[];
```

```
@ValidateNested({ each: true }):
  → Với mỗi phần tử trong array → chạy class-validator decorators
  → Phần tử = QualificationItem → validate @IsString() name, institution

@Type(() => QualificationItem):
  → class-transformer decorator
  → Convert plain object → QualificationItem instance
  → REQUIRED cho @ValidateNested hoạt động

  Không có @Type:
    [{ name: 'AWS', institution: 'Amazon' }]
    → Vẫn là plain object, KHÔNG có class decorators
    → @ValidateNested skip validation → BUG

  Có @Type:
    [{ name: 'AWS', institution: 'Amazon' }]
    → plainToInstance(QualificationItem, each)
    → QualificationItem instance có @IsString() decorators
    → Validate name là string ✅

Ví dụ validation:
  [{ name: 'AWS', institution: 'Amazon', year: '2023' }]  → ✅
  [{ name: 'AWS', institution: 'Amazon' }]                 → ✅ (year optional)
  [{ name: 123, institution: 'Amazon' }]                    → ❌ name not string
  [{ institution: 'Amazon' }]                                → ❌ name missing
```

**socialLinks — @IsObject only:**

```typescript
@IsOptional()
@IsObject()
socialLinks?: Record<string, string>;
```

```
Không dùng @ValidateNested vì:
  → socialLinks là flat key-value object
  → Keys: github, linkedin, twitter, website (dynamic)
  → Values: URL strings
  → Không có fixed class structure → @ValidateNested không áp dụng

@IsObject():
  → Validate là object (không phải string, array, number)
  → Không deep-validate values
  → Trade-off: flexible nhưng kém strict

  { github: 'https://...', linkedin: 'https://...' } → ✅
  { github: 123 } → ✅ (value not validated)
  "not object" → ❌
```

---

## 7. INSTRUCTOR CONTROLLER — THIN PATTERN

### 7.1 Class decorators

```typescript
@Controller('instructor')
@ApiTags('Instructor')
@ApiBearerAuth()
@UseGuards(RolesGuard)
export class InstructorController {
  constructor(@Inject(InstructorService) private readonly instructorService: InstructorService) {}
```

```
4 class-level decorators:

@Controller('instructor')  → Route prefix: /api/instructor/*
@ApiTags('Instructor')     → Swagger group: "Instructor"
@ApiBearerAuth()           → Swagger: show lock icon + Authorize button
@UseGuards(RolesGuard)     → Apply RolesGuard to ALL endpoints

Thứ tự decorators:
  → Decorators execute BOTTOM to TOP
  → Nhưng cho class decorators → thứ tự không quan trọng (metadata only)
  → Convention: Controller → ApiTags → ApiBearerAuth → UseGuards (readable)
```

### 7.2 Endpoint implementations

```typescript
// Submit application — STUDENT only
@Post('applications')
@Roles('STUDENT')
@ApiOperation({ summary: 'Submit instructor application' })
async submitApplication(
  @CurrentUser() user: JwtPayload,
  @Body() dto: CreateApplicationDto,
) {
  return this.instructorService.submitApplication(user.sub, dto);
}
```

```
Thin controller pattern:
  1. @CurrentUser() → extract user ID from JWT
  2. @Body() dto → validated by ValidationPipe
  3. Call service method → pass userId + dto
  4. Return service result directly

Controller KHÔNG:
  ❌ Check if user exists
  ❌ Check if already instructor
  ❌ Check pending application
  → Tất cả business rules trong SERVICE
```

---

## 8. INSTRUCTOR MODULE WIRING

```typescript
@Module({
  controllers: [InstructorController],
  providers: [InstructorService],
  exports: [InstructorService],
})
export class InstructorModule {}
```

```
exports: [InstructorService]:
  → AdminModule (Phase 5.11) sẽ cần InstructorService
  → Admin approve application → cần gọi InstructorService methods
  → Export cho phép cross-module access

Không cần imports:
  → PrismaModule là GLOBAL module (@Global() decorator)
  → PrismaService tự động available trong TẤT CẢ modules
  → Không cần explicit import
```

---

## 9. ERROR CODES

```
InstructorService Error Codes:

Application:
  USER_NOT_FOUND               → 404 (submitApplication)
  ALREADY_INSTRUCTOR           → 400 (submitApplication — đã là instructor)
  APPLICATION_ALREADY_PENDING  → 400 (submitApplication — đã có đơn pending)

Profile:
  INSTRUCTOR_PROFILE_NOT_FOUND → 404 (getProfile — chưa có profile)

Dashboard:
  (Không throw — trả default values nếu profile null)
  → totalRevenue: 0, totalStudents: 0, etc.
  → Instructor mới chưa có data → dashboard hiển thị zeros
```

---

## 10. TÓM TẮT

```
Instructor Module — Key Patterns:

1. RBAC (Role-Based Access Control):
   ├── @UseGuards(RolesGuard) class-level
   ├── @Roles('STUDENT') — chỉ student nộp đơn
   ├── @Roles('INSTRUCTOR') — chỉ instructor xem profile/dashboard
   └── No @Roles() — any authenticated user

2. Application Flow:
   ├── 3 guard clauses: user exists, not instructor, no pending
   ├── Create with data spread: { userId, ...dto }
   └── Status: PENDING → APPROVED/REJECTED (by admin)

3. Profile Upsert:
   ├── upsert: create if not exists, update if exists
   ├── Destructure JSON fields: { qualifications, socialLinks, ...rest }
   ├── Double cast: as unknown as Prisma.InputJsonValue
   └── Conditional spread: ...(field !== undefined && { field: casted })

4. Dashboard Aggregation:
   ├── Promise.all: 5 parallel queries
   ├── Prisma aggregate: _sum for earnings
   ├── Nullish coalescing: ?? 0 for safe defaults
   └── Date calculation: 30 days ago

5. DTO Validation:
   ├── @IsArray() + @ArrayMinSize(1) + @IsString({ each: true })
   ├── @ValidateNested({ each: true }) + @Type(() => Class) for deep validation
   ├── !: definite assignment assertion
   └── @ApiProperty/@ApiPropertyOptional for Swagger
```
