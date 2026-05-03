# 04 — Testing: Unit Tests cho Users & Instructor Modules

> Giải thích 74 unit tests — mock strategy, service vs controller testing, DTO validation,
> Prisma error testing, pagination mocking, và enrichWithFollowStatus test pattern.

---

## 1. TEST OVERVIEW

### 1.1 Phân bố tests

```
Phase 5.5 Tests (74 tests total):

Users Module:
  users.service.spec.ts         → 21 tests (business logic, follow system)
  users.controller.spec.ts      → 10 tests (delegation, optional auth)
  dto/dto.validation.spec.ts    → 10 tests (UpdateProfile, NotificationPreferences)

Instructor Module:
  instructor.service.spec.ts    → 10 tests (application, profile, dashboard)
  instructor.controller.spec.ts →  5 tests (delegation, role-based)
  dto/dto.validation.spec.ts    → 18 tests (CreateApplication, UpdateInstructorProfile)
```

### 1.2 Test Pyramid trong Phase 5.5

```
         ╱╲
        ╱  ╲        E2E Tests (Phase 5.15)
       ╱    ╲       → Real HTTP requests, real DB
      ╱──────╲
     ╱        ╲     Integration Tests (Phase 5.15)
    ╱          ╲    → Module-level, DB queries
   ╱────────────╲
  ╱              ╲  Unit Tests ← HIỆN TẠI (74 tests)
 ╱                ╲ → Mock dependencies, isolated logic
╱──────────────────╲

Unit tests run in < 3 seconds
  → Fast feedback loop
  → Run mỗi khi code thay đổi
  → CI/CD: block merge nếu fail
```

---

## 2. SERVICE TESTING — MOCK STRATEGY

### 2.1 Mock PrismaService — Users

```typescript
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  follow: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};
```

```
Mock pattern — chỉ mock methods thật sự dùng:

user.findUnique    → getMe, getPublicProfile, follow (check target)
user.update        → updateProfile, updateNotificationPreferences

follow.findUnique  → isFollowing, unfollow (check exists)
follow.findMany    → getFollowers, getFollowing, enrichWithFollowStatus
follow.create      → follow (inside $transaction)
follow.delete      → unfollow (inside $transaction)
follow.count       → getFollowers/getFollowing (pagination total)

$transaction       → follow, unfollow (atomic operations)

Không mock:
  ❌ user.create       → UsersService không tạo user
  ❌ user.findMany     → UsersService không list users
  ❌ user.delete       → UsersService không xóa user
  → Nếu service gọi method chưa mock → "is not a function" → test fail
  → Phát hiện service gọi method không mong đợi
```

### 2.2 Mock PrismaService — Instructor

```typescript
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  instructorApplication: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  instructorProfile: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  course: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  earning: {
    aggregate: jest.fn(),
    findMany: jest.fn(),
  },
};
```

```
InstructorService dùng NHIỀU Prisma models:
  → user (check role)
  → instructorApplication (CRUD)
  → instructorProfile (get/upsert)
  → course (count, stats)
  → earning (aggregate, list)

Mock phản ánh actual service dependencies:
  → Đọc mock → biết service truy cập models nào
  → Documentation through code
```

### 2.3 NestJS Testing Module

```typescript
beforeEach(async () => {
  const module = await Test.createTestingModule({
    providers: [
      UsersService,                                    // Real service
      { provide: PrismaService, useValue: mockPrisma }, // Mock dependency
    ],
  }).compile();

  service = module.get(UsersService);
  jest.clearAllMocks();
});
```

```
Test.createTestingModule():
  → Tạo mini NestJS DI container cho test
  → UsersService = REAL class (business logic được test)
  → PrismaService = MOCK object (database không thật)

{ provide: PrismaService, useValue: mockPrisma }:
  → Khi UsersService inject PrismaService → nhận mockPrisma
  → Service gọi this.prisma.user.findUnique → gọi jest.fn()
  → Test kiểm soát output qua mockResolvedValue

jest.clearAllMocks():
  → Reset call count, arguments, return values
  → Mỗi test bắt đầu clean (không bị ảnh hưởng test trước)

  Ví dụ:
    Test 1: mockPrisma.user.findUnique.mockResolvedValue(user)
    → findUnique called 1 time

    clearAllMocks()

    Test 2: findUnique.mock.calls.length → 0 (reset)
    → Test 2 không bị ảnh hưởng bởi Test 1
```

---

## 3. SERVICE TEST PATTERNS — USERS

### 3.1 getPublicProfile — isFollowing States

```typescript
describe('getPublicProfile', () => {
  it('should return isFollowing null when not logged in', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_PUBLIC_USER);

    const result = await service.getPublicProfile('user-1');
    //                                             ↑ no currentUserId

    expect(result).toEqual({ ...MOCK_PUBLIC_USER, isFollowing: null });
  });

  it('should return isFollowing true when following', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_PUBLIC_USER);
    mockPrisma.follow.findUnique.mockResolvedValue({
      followerId: 'user-2', followingId: 'user-1',
    });

    const result = await service.getPublicProfile('user-1', 'user-2');

    expect(result.isFollowing).toBe(true);
  });

  it('should return isFollowing null when viewing own profile', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_PUBLIC_USER);

    const result = await service.getPublicProfile('user-1', 'user-1');
    //                                             same ID ↑      ↑ same ID

    expect(result.isFollowing).toBeNull();
  });
});
```

```
3 isFollowing states — cover TOÀN BỘ logic:

  Anonymous (no currentUserId):
    → isFollowing = null (không applicable)
    → Test verify: không gọi isFollowing() method

  Following (currentUserId follows target):
    → follow.findUnique return record → true
    → Test verify: isFollowing = true

  Self-view (currentUserId === userId):
    → Skip isFollowing check (condition: currentUserId !== userId → false)
    → Test verify: isFollowing = null
    → Test verify: follow.findUnique NOT called

  Còn thiếu: false case (logged in, not following)
    → follow.findUnique return null → false
    → Test verify: isFollowing = false
```

### 3.2 follow — P2002 Error Testing

```typescript
it('should throw ConflictException on duplicate follow (P2002)', async () => {
  mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2' });

  // Simulate Prisma P2002 error
  const prismaError = new Prisma.PrismaClientKnownRequestError(
    'Unique constraint',
    { code: 'P2002', clientVersion: '5.0.0' },
  );
  mockPrisma.$transaction.mockRejectedValue(prismaError);

  try {
    await service.follow('user-1', 'user-2');
    fail('Should have thrown');
  } catch (error) {
    expect(error).toBeInstanceOf(ConflictException);
    const response = (error as ConflictException).getResponse();
    expect(response).toMatchObject({ code: 'ALREADY_FOLLOWING' });
  }
});
```

```
Tạo Prisma error cho test:

new Prisma.PrismaClientKnownRequestError('message', { code: 'P2002', clientVersion: '...' })
  → Tạo real Prisma error instance
  → code: 'P2002' = unique constraint violation
  → Service catch: error instanceof PrismaClientKnownRequestError → true
  → Service check: error.code === 'P2002' → true
  → Service throw: ConflictException { code: 'ALREADY_FOLLOWING' }

Import { Prisma } from '@prisma/client':
  → VALUE import (không phải type) vì PrismaClientKnownRequestError dùng với new
  → Giống service: cần runtime class reference cho instanceof check
```

### 3.3 follow — Re-throw Non-P2002 Errors

```typescript
it('should rethrow non-P2002 errors', async () => {
  mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
  const genericError = new Error('DB connection failed');
  mockPrisma.$transaction.mockRejectedValue(genericError);

  await expect(service.follow('user-1', 'user-2')).rejects.toThrow('DB connection failed');
});
```

```
Test verify: service KHÔNG swallow unexpected errors

catch block trong follow():
  if (error instanceof PrismaClientKnownRequestError && code === 'P2002') {
    throw ConflictException;  // Handle known error
  }
  throw error;  // Re-throw unknown errors

Test: DB connection error (NOT P2002)
  → Không match condition → throw error (re-throw)
  → Test verify: original error bubbles up
  → Quan trọng: silent swallowing errors = hard-to-debug bugs
```

### 3.4 getFollowers — Pagination + enrichWithFollowStatus

```typescript
it('should enrich with isFollowing status when logged in', async () => {
  const followData = [
    { follower: { id: 'f1', fullName: 'Follower 1', avatarUrl: null, bio: null } },
    { follower: { id: 'f2', fullName: 'Follower 2', avatarUrl: null, bio: null } },
  ];
  mockPrisma.follow.findMany
    .mockResolvedValueOnce(followData)        // 1st call: getFollowers query
    .mockResolvedValueOnce([{ followingId: 'f1' }]);  // 2nd call: enrichWithFollowStatus
  mockPrisma.follow.count.mockResolvedValue(2);

  const result = await service.getFollowers('user-1', pagination, 'current-user');

  expect(result.data[0]).toMatchObject({ id: 'f1', isFollowing: true });
  expect(result.data[1]).toMatchObject({ id: 'f2', isFollowing: false });
});
```

```
mockResolvedValueOnce — ordered responses:

follow.findMany được gọi 2 LẦN trong 1 service call:
  1. getFollowers → findMany (lấy follow records với user relations)
  2. enrichWithFollowStatus → findMany (batch check follow status)

mockResolvedValueOnce(A).mockResolvedValueOnce(B):
  → Lần gọi 1: return A (follow records)
  → Lần gọi 2: return B (follow status)
  → Lần gọi 3: return undefined (no more mocks)

Test verify enrichment:
  current-user follows f1 (có trong enrichWithFollowStatus response)
  current-user KHÔNG follow f2 (không có)
  → f1.isFollowing = true
  → f2.isFollowing = false
```

### 3.5 Pagination Mock

```typescript
const pagination = {
  page: 1,
  limit: 20,
  skip: 0,
} as unknown as import('@/common/dto/pagination.dto').PaginationDto;
```

```
Tại sao cast?
  PaginationDto là class với getter (skip) + decorators
  Test chỉ cần 3 values: page, limit, skip
  → Tạo plain object + cast → đủ cho service methods
  → Không cần instantiate real PaginationDto

as unknown as PaginationDto:
  → Plain object không match PaginationDto type
  → Double cast qua unknown → TypeScript accept
  → Runtime: service chỉ đọc .page, .limit, .skip → works
```

---

## 4. SERVICE TEST PATTERNS — INSTRUCTOR

### 4.1 submitApplication — 3 Business Rules

```typescript
it('should throw NotFoundException if user not found', async () => {
  mockPrisma.user.findUnique.mockResolvedValue(null);

  try {
    await service.submitApplication('nonexistent', MOCK_APPLICATION_DTO);
    fail('Should have thrown');
  } catch (error) {
    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse())
      .toMatchObject({ code: 'USER_NOT_FOUND' });
  }
});

it('should throw BadRequestException if already instructor', async () => {
  mockPrisma.user.findUnique.mockResolvedValue({ role: 'INSTRUCTOR' });
  // ...expect BadRequest { code: 'ALREADY_INSTRUCTOR' }
});

it('should throw BadRequestException if application already pending', async () => {
  mockPrisma.user.findUnique.mockResolvedValue({ role: 'STUDENT' });
  mockPrisma.instructorApplication.findFirst.mockResolvedValue({ status: 'PENDING' });
  // ...expect BadRequest { code: 'APPLICATION_ALREADY_PENDING' }
});
```

```
3 tests cho 3 guard clauses:
  → Mỗi test verify 1 specific error condition
  → Mock setup tạo exact scenario cho condition
  → Verify: đúng exception type + đúng error code

Test pattern — fail('Should have thrown'):
  try {
    await service.method();
    fail('Should have thrown');  // Nếu đến đây = service KHÔNG throw = BUG
  } catch (error) {
    expect(error).toBeInstanceOf(XxxException);
    expect(error.getResponse()).toMatchObject({ code: '...' });
  }

  Tại sao try/catch thay vì rejects.toThrow?
  → rejects.toThrow chỉ check exception class
  → try/catch cho phép verify error RESPONSE (code, field)
  → Granular assertion: biết đúng error code nào
```

### 4.2 getDashboard — Multiple Mock Values

```typescript
it('should return dashboard with overview, recentEarnings, and courseStats', async () => {
  mockPrisma.instructorProfile.findUnique.mockResolvedValue({
    totalStudents: 100, totalCourses: 5, totalRevenue: 5000000,
  });
  mockPrisma.course.count.mockResolvedValue(5);
  mockPrisma.earning.aggregate
    .mockResolvedValueOnce({ _sum: { netAmount: 3000000 } })   // available
    .mockResolvedValueOnce({ _sum: { netAmount: 2000000 } });  // pending
  mockPrisma.earning.findMany.mockResolvedValue([]);
  mockPrisma.course.findMany.mockResolvedValue([
    { id: 'c1', title: 'React', totalStudents: 50, avgRating: 4.5 },
  ]);

  const result = await service.getDashboard('user-1');

  expect(result.overview).toEqual({
    totalRevenue: 5000000,
    totalStudents: 100,
    totalCourses: 5,
    availableBalance: 3000000,
    pendingBalance: 2000000,
  });
});
```

```
earning.aggregate gọi 2 lần (available + pending):
  → mockResolvedValueOnce cho từng lần gọi
  → Lần 1: { _sum: { netAmount: 3000000 } } (available)
  → Lần 2: { _sum: { netAmount: 2000000 } } (pending)

Test verify TOÀN BỘ dashboard response:
  → overview.totalRevenue = 5000000 (from profile)
  → overview.availableBalance = 3000000 (from aggregate 1)
  → overview.pendingBalance = 2000000 (from aggregate 2)
  → recentEarnings = [] (empty)
  → courseStats.length = 1

Test "zeros when profile null":
  → instructorProfile.findUnique → null
  → earning.aggregate → { _sum: { netAmount: null } }
  → Verify: totalRevenue = 0, availableBalance = 0
  → Test ?? 0 nullish coalescing behavior
```

---

## 5. CONTROLLER TESTING

### 5.1 Khác biệt Service vs Controller Test

```
Service Test:
  Mock: PrismaService (database layer)
  Test: Business logic, validation, error handling
  Assert: Return values, Prisma call arguments, thrown exceptions

Controller Test:
  Mock: UsersService / InstructorService (business layer)
  Test: Request parsing, delegation, optional auth
  Assert: Correct method called, correct arguments, response passthrough
```

### 5.2 Users Controller — Optional Auth Testing

```typescript
describe('getPublicProfile', () => {
  it('should pass currentUserId when user is logged in', async () => {
    mockUsersService.getPublicProfile.mockResolvedValue(profile);

    await controller.getPublicProfile('user-2', MOCK_JWT);
    //                                         ↑ logged in

    expect(mockUsersService.getPublicProfile)
      .toHaveBeenCalledWith('user-2', 'user-1');
    //                                ↑ user?.sub = 'user-1'
  });

  it('should pass undefined when user is not logged in', async () => {
    mockUsersService.getPublicProfile.mockResolvedValue(profile);

    await controller.getPublicProfile('user-2', undefined);
    //                                         ↑ not logged in

    expect(mockUsersService.getPublicProfile)
      .toHaveBeenCalledWith('user-2', undefined);
    //                                ↑ user?.sub = undefined
  });
});
```

```
Test focus: controller correctly passes user?.sub

Logged in:
  @CurrentUser() user = { sub: 'user-1', role: 'STUDENT' }
  user?.sub = 'user-1'
  → Service nhận currentUserId = 'user-1'

Not logged in:
  @CurrentUser() user = undefined
  user?.sub = undefined
  → Service nhận currentUserId = undefined

Controller test KHÔNG test isFollowing logic:
  → Đó là service responsibility
  → Controller chỉ pass argument correctly
  → Separation of concerns in testing
```

### 5.3 Instructor Controller — Role Delegation

```typescript
it('should call service.submitApplication with userId and dto', async () => {
  const dto = { expertise: ['React'], experience: 'A'.repeat(50) } as never;
  const created = { id: 'app-1', status: 'PENDING' };
  mockInstructorService.submitApplication.mockResolvedValue(created);

  const result = await controller.submitApplication(MOCK_STUDENT, dto);

  expect(result).toEqual(created);
  expect(mockInstructorService.submitApplication)
    .toHaveBeenCalledWith('user-1', dto);
});
```

```
`as never` cast for DTO:
  → dto = plain object, not CreateApplicationDto instance
  → TypeScript complain: missing class methods/decorators
  → `as never` = "trust me" cast → TypeScript accept any value
  → Runtime: service chỉ đọc properties → works fine

Test verify delegation:
  1. Controller nhận MOCK_STUDENT (JwtPayload) + dto
  2. Extract user.sub = 'user-1'
  3. Call service.submitApplication('user-1', dto)
  4. Return service result without modification

  → Controller = pure passthrough (thin controller verified)
```

### 5.4 RolesGuard Override in Tests

```typescript
const module = await Test.createTestingModule({
  controllers: [InstructorController],
  providers: [{ provide: InstructorService, useValue: mockInstructorService }],
})
  .overrideGuard(RolesGuard)
  .useValue({ canActivate: () => true })
  .compile();
```

```
.overrideGuard(RolesGuard).useValue({ canActivate: () => true }):
  → Replace RolesGuard with dummy that ALWAYS passes
  → Controller test không test authorization (that's guard's job)
  → Focus: controller delegation logic only

Tại sao không test RolesGuard trong controller test?
  → RolesGuard có test riêng (Phase 5.3)
  → Controller test = HTTP behavior + delegation
  → Guard test = authorization logic
  → Separation of concerns
```

---

## 6. DTO VALIDATION TESTING

### 6.1 Shared Helper Functions

```typescript
async function validateDto<T extends object>(
  DtoClass: new () => T,
  data: Record<string, unknown>,
): Promise<string[]> {
  const instance = plainToInstance(DtoClass, data);
  const errors = await validate(instance);
  return errors.flatMap((e) => Object.keys(e.constraints || {}));
}

async function expectValid<T extends object>(
  DtoClass: new () => T,
  data: Record<string, unknown>,
) {
  const constraints = await validateDto(DtoClass, data);
  expect(constraints).toHaveLength(0);
}

async function expectInvalid<T extends object>(
  DtoClass: new () => T,
  data: Record<string, unknown>,
) {
  const constraints = await validateDto(DtoClass, data);
  expect(constraints.length).toBeGreaterThan(0);
}
```

```
Reused pattern từ Phase 5.4 (Auth DTO tests):

validateDto flow:
  1. plainToInstance(CreateApplicationDto, { expertise: ['React'] })
     → Tạo DTO instance với data
     → class-transformer gán properties

  2. validate(instance)
     → class-validator chạy decorators (@IsArray, @IsString, etc.)
     → Return ValidationError[]

  3. errors.flatMap(e => Object.keys(e.constraints))
     → Extract constraint names: ['isArray', 'arrayMinSize']
     → Empty = valid ✅

expectValid: constraints === 0 → test pass
expectInvalid: constraints > 0 → test pass

Generic type <T extends object>:
  → Works với bất kỳ DTO class
  → `new () => T` = class constructor (no-arg)
  → TypeScript biết T là object type
```

### 6.2 CreateApplicationDto — Array Validation

```typescript
describe('CreateApplicationDto', () => {
  it('should fail with empty expertise array', async () => {
    await expectInvalid(CreateApplicationDto, { expertise: [] });
  });

  it('should fail with non-string items in expertise', async () => {
    await expectInvalid(CreateApplicationDto, { expertise: [123, 456] });
  });

  it('should fail with experience too short (< 50 chars)', async () => {
    await expectInvalid(CreateApplicationDto, {
      expertise: ['React'],
      experience: 'short',  // < 50 chars
    });
  });

  it('should pass with experience exactly 50 chars', async () => {
    await expectValid(CreateApplicationDto, {
      expertise: ['React'],
      experience: 'A'.repeat(50),  // exactly 50
    });
  });
});
```

```
Boundary testing:
  → experience: 'short' (5 chars < 50) → ❌
  → experience: 'A'.repeat(50) (exactly 50) → ✅
  → Test @MinLength(50) boundary condition

Array validation:
  → [] → @ArrayMinSize(1) fail (empty array)
  → [123] → @IsString({ each: true }) fail (not string)
  → ['React'] → all pass ✅

Optional field with validation:
  → { expertise: ['React'] } → experience undefined → @IsOptional → skip → ✅
  → { expertise: ['React'], experience: 'short' } → @IsOptional → present → @MinLength → ❌
```

### 6.3 UpdateInstructorProfileDto — Nested Validation

```typescript
it('should pass with valid qualifications array', async () => {
  await expectValid(UpdateInstructorProfileDto, {
    qualifications: [{ name: 'AWS', institution: 'Amazon', year: '2023' }],
  });
});

it('should pass with qualifications without optional year', async () => {
  await expectValid(UpdateInstructorProfileDto, {
    qualifications: [{ name: 'AWS', institution: 'Amazon' }],
  });
});

it('should pass with empty object (all optional)', async () => {
  await expectValid(UpdateInstructorProfileDto, {});
});
```

```
All-optional DTO:
  → {} → mọi field @IsOptional() → skip → ✅
  → Cho phép partial updates

Nested validation (qualifications):
  → [{ name: 'AWS', institution: 'Amazon' }] → ✅
  → @ValidateNested + @Type → deep validate QualificationItem
  → year optional → { name, institution } → ✅

Test coverage cho nested objects:
  → Valid with all fields
  → Valid without optional year
  → Ensures @ValidateNested + @Type works correctly
```

---

## 7. ERROR ASSERTION PATTERNS

### 7.1 try/catch + getResponse

```typescript
try {
  await service.follow('user-1', 'user-1');
  fail('Should have thrown');
} catch (error) {
  expect(error).toBeInstanceOf(BadRequestException);
  const response = (error as BadRequestException).getResponse();
  expect(response).toMatchObject({ code: 'CANNOT_FOLLOW_SELF' });
}
```

```
Pattern dùng khi cần verify error CODE:

1. fail('Should have thrown'):
   → Nếu service KHÔNG throw → test fail with clear message
   → Tránh false positive (test pass vì catch block skip)

2. expect(error).toBeInstanceOf(BadRequestException):
   → Verify HTTP exception type (400, 404, 409)

3. (error as BadRequestException).getResponse():
   → NestJS exception method: trả response body
   → { code: 'CANNOT_FOLLOW_SELF' } (our error code)

4. expect(response).toMatchObject({ code: '...' }):
   → Partial match: chỉ check code field
   → Response có thể chứa thêm fields (message, statusCode)
   → toMatchObject = subset match
```

### 7.2 rejects.toThrow — Simple Pattern

```typescript
await expect(service.follow('user-1', 'user-2'))
  .rejects.toThrow('DB connection failed');
```

```
Dùng khi chỉ cần verify error MESSAGE:
  → Ngắn gọn hơn try/catch
  → Nhưng KHÔNG check error code
  → Dùng cho generic errors (re-throw)
```

---

## 8. MOCK DATA CONSTANTS

### 8.1 Users Module

```typescript
const MOCK_USER = {
  id: 'user-1',
  email: 'test@example.com',
  fullName: 'Test User',
  avatarUrl: null,
  bio: 'Hello world',
  role: 'STUDENT',
  status: 'ACTIVE',
  followerCount: 10,
  followingCount: 5,
  notificationPreferences: null,
  createdAt: new Date('2024-01-01'),
  instructorProfile: null,
};

const MOCK_PUBLIC_USER = {
  id: 'user-1',
  fullName: 'Test User',
  avatarUrl: null,
  bio: 'Hello world',
  role: 'STUDENT',
  followerCount: 10,
  followingCount: 5,
  createdAt: new Date('2024-01-01'),
  instructorProfile: null,
};
```

```
2 mock objects cho 2 select levels:

MOCK_USER = getMe() response:
  → Full profile: email, status, notificationPreferences
  → Dùng trong getMe tests

MOCK_PUBLIC_USER = getPublicProfile() response:
  → Public fields only: không email, status, notificationPreferences
  → Dùng trong getPublicProfile tests

Tại sao 2 objects thay vì 1?
  → Service dùng khác select → return khác fields
  → Mock phải match actual Prisma response
  → Test verify exact response format
```

### 8.2 Instructor Module

```typescript
const MOCK_APPLICATION_DTO = {
  expertise: ['React', 'Node.js'],
  experience: 'A'.repeat(50),
  motivation: 'Want to teach',
};

const MOCK_STUDENT: JwtPayload = { sub: 'user-1', role: 'STUDENT' };
const MOCK_INSTRUCTOR: JwtPayload = { sub: 'user-2', role: 'INSTRUCTOR' };
```

```
MOCK_APPLICATION_DTO:
  → Valid DTO data cho submitApplication tests
  → experience: 'A'.repeat(50) → satisfy @MinLength(50)

MOCK_STUDENT, MOCK_INSTRUCTOR:
  → Controller tests cần JwtPayload objects
  → Different roles cho different endpoint tests
  → STUDENT: submitApplication
  → INSTRUCTOR: getProfile, updateProfile, getDashboard
```

---

## 9. TÓM TẮT

```
Phase 5.5 Testing — 74 tests:

Test Strategy:
  ├── Service tests: mock PrismaService, test business logic
  ├── Controller tests: mock Service, test delegation + optional auth
  ├── DTO tests: no mocks, test class-validator decorators
  └── Guard tests: already done in Phase 5.3

Key Patterns:
  ├── jest.fn() + mockResolvedValue for Prisma methods
  ├── mockResolvedValueOnce for ordered responses (aggregate, findMany)
  ├── overrideGuard(RolesGuard) → { canActivate: () => true }
  ├── Prisma.PrismaClientKnownRequestError for P2002 testing
  ├── try/catch + fail() + getResponse() for error code assertion
  ├── plainToInstance + validate for DTO testing
  └── as unknown as Type for partial mocks

Coverage:
  ├── Happy paths: all methods
  ├── Error paths: all guard clauses + business rules
  ├── Edge cases: self-follow, empty arrays, boundary values
  ├── Pagination: with/without auth, enrichWithFollowStatus
  └── JSON fields: qualifications, socialLinks, notificationPreferences
```
