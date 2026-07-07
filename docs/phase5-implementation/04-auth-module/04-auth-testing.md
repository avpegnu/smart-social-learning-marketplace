# 04 — Auth Testing: Unit Tests, Mocking Strategy, và Test Patterns

> Giải thích cách test Auth module — 87 unit tests, mock strategy cho Prisma/Redis/Mail/JWT,
> controller vs service testing, DTO validation testing, và Jest patterns.

---

## 1. TEST STRATEGY OVERVIEW

### 1.1 Phân loại tests

```
SSLM Auth Module Tests (87 tests total):

auth.service.spec.ts      → 42 tests (business logic)
auth.controller.spec.ts   → 17 tests (HTTP behavior, cookies)
jwt.strategy.spec.ts      →  3 tests (JWT validation)
dto.validation.spec.ts    → 25 tests (DTO validation decorators)
```

### 1.2 Tại sao Unit Test, không phải E2E?

```
Unit Test:
  ✅ Nhanh (< 1 giây cho 87 tests)
  ✅ Isolated — mock tất cả dependencies
  ✅ Deterministic — không phụ thuộc DB/Redis/Network
  ✅ Specific — biết chính xác method nào fail
  ❌ Không test integration giữa components

E2E Test:
  ✅ Test real flow (HTTP → Controller → Service → DB)
  ❌ Chậm (cần Docker, DB, Redis)
  ❌ Flaky (network issues, timing)
  ❌ Setup phức tạp

SSLM strategy:
  Phase 5.4: Unit tests cho tất cả business logic
  Phase 5.15: E2E tests cho critical flows (register → verify → login)
```

---

## 2. SERVICE TESTING — MOCK STRATEGY

### 2.1 NestJS Testing Module

```typescript
const module: TestingModule = await Test.createTestingModule({
  providers: [
    AuthService,
    { provide: PrismaService, useValue: mockPrisma },
    { provide: JwtService, useValue: mockJwt },
    { provide: ConfigService, useValue: mockConfig },
    { provide: RedisService, useValue: mockRedis },
    { provide: MailService, useValue: mockMail },
  ],
}).compile();
```

```
Test.createTestingModule():
  → Tạo NestJS DI container cho test
  → Inject mock dependencies thay vì real services

useValue: mockXyz
  → Thay thế real provider bằng mock object
  → AuthService nhận mock thay vì real PrismaService
  → Test kiểm soát hoàn toàn mock behavior
```

### 2.2 Mock Objects Pattern

```typescript
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
};
```

```
Mock pattern — chỉ mock methods thật sự dùng:
  ✅ user.findUnique → login, register, forgotPassword
  ✅ user.create → register
  ✅ refreshToken.delete → refresh (rotation)

  Không mock:
  ❌ user.findMany → AuthService không dùng
  ❌ user.count → AuthService không dùng

  → Nếu service gọi method chưa mock → throw "is not a function"
  → Phát hiện nếu service gọi method không mong đợi
```

### 2.3 Module-Level Mocks — bcryptjs & crypto

```typescript
const MOCK_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

jest.mock('bcryptjs');
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => MOCK_UUID),
}));
```

**Tại sao jest.mock() ở module level?**

```
bcryptjs:
  jest.mock('bcryptjs') → tất cả exports thành jest.fn()
  (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
  → Kiểm soát hash output → test deterministic

crypto:
  jest.mock('crypto', () => ({ randomUUID: jest.fn(() => MOCK_UUID) }))
  → Mọi crypto.randomUUID() → return MOCK_UUID

  Tại sao không dùng jest.spyOn(crypto, 'randomUUID')?
  → crypto.randomUUID là non-configurable property
  → spyOn fails: "Cannot redefine property: randomUUID"
  → Module-level mock thay thế toàn bộ module → works
```

### 2.4 beforeEach — Reset State

```typescript
beforeEach(async () => {
  jest.clearAllMocks();
  // ... create testing module ...
});
```

```
jest.clearAllMocks():
  → Reset tất cả mock call counts
  → Reset tất cả mock return values
  → Mỗi test bắt đầu "sạch"

Tại sao clearAllMocks thay vì resetAllMocks?
  clearAllMocks:
    ✅ Clear call history
    ✅ Clear mock instances
    ❌ KHÔNG reset implementation (mockResolvedValue still works)

  resetAllMocks:
    ✅ Clear everything
    ✅ Reset implementation → jest.fn() trở về undefined

  SSLM dùng clearAllMocks + set mock values trong mỗi test
  → Explicit hơn: mỗi test tự set expected values
```

---

## 3. SERVICE TEST EXAMPLES

### 3.1 Register — Happy Path

```typescript
it('should register a new user and send verification email', async () => {
  mockPrisma.user.findUnique.mockResolvedValue(null); // email chưa tồn tại
  mockPrisma.user.create.mockResolvedValue({}); // create thành công
  (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

  const result = await service.register({
    email: 'test@example.com',
    password: 'Password123',
    fullName: 'Test User',
  });

  expect(result).toEqual({ message: 'REGISTER_SUCCESS' });
  expect(mockPrisma.user.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      email: 'test@example.com',
      passwordHash: 'hashed-password',
      verificationToken: MOCK_UUID,
    }),
  });
  expect(mockMail.sendVerificationEmail).toHaveBeenCalledWith('test@example.com', MOCK_UUID);
});
```

```
Test strategy:
  1. Setup mocks (Given)
     → findUnique returns null (no existing user)
     → bcrypt.hash returns deterministic value
  2. Execute method (When)
     → service.register(dto)
  3. Assert results (Then)
     → Return value correct
     → Prisma called with correct data
     → Mail service called with correct params
```

### 3.2 Login — Rate Limiting

```typescript
it('should throw TOO_MANY_LOGIN_ATTEMPTS when rate limited', async () => {
  mockRedis.checkRateLimit.mockResolvedValue(false); // rate limited

  await expect(
    service.login({ email: 'test@example.com', password: 'x' }, '127.0.0.1'),
  ).rejects.toThrow(BadRequestException);
});
```

```
Test pattern — early return / throw:
  → Mock redis.checkRateLimit → false (blocked)
  → Service should throw TRƯỚC khi query database
  → Verify: prisma.user.findUnique NOT called (guard clause effective)
```

### 3.3 Login — Account Status Checks

```typescript
it('should throw EMAIL_NOT_VERIFIED for unverified users', async () => {
  mockRedis.checkRateLimit.mockResolvedValue(true);
  mockPrisma.user.findUnique.mockResolvedValue({
    ...mockUser,
    status: 'UNVERIFIED',
  });

  await expect(
    service.login({ email: 'test@example.com', password: 'Password123' }, '127.0.0.1'),
  ).rejects.toThrow(UnauthorizedException);
});
```

```
Pattern — override individual fields:
  { ...mockUser, status: 'UNVERIFIED' }
  → Base mock user + override 1 field
  → DRY: không copy toàn bộ user object mỗi test
```

### 3.4 Forgot Password — Anti-Enumeration

```typescript
it('should return success even if email does not exist', async () => {
  mockPrisma.user.findUnique.mockResolvedValue(null); // email không tồn tại

  const result = await service.forgotPassword('nonexistent@example.com');

  expect(result).toEqual({ message: 'RESET_EMAIL_SENT' });
  expect(mockMail.sendResetPasswordEmail).not.toHaveBeenCalled(); // KHÔNG gửi email
});
```

```
Critical security test:
  → Email không tồn tại → vẫn return success
  → Mail KHÔNG được gọi (không gửi email cho nonexistent)
  → Response GIỐNG HỆT trường hợp email tồn tại
  → Anti-enumeration pattern verified
```

### 3.5 Reset Password — Invalidate All Sessions

```typescript
it('should invalidate all refresh tokens after password reset', async () => {
  mockPrisma.user.findFirst.mockResolvedValue(mockUser);
  (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
  mockPrisma.user.update.mockResolvedValue({});
  mockPrisma.refreshToken.deleteMany.mockResolvedValue({});

  await service.resetPassword({ token: 'reset-token', newPassword: 'NewPass123' });

  expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
    where: { userId: mockUser.id },
  });
});
```

```
Test verify security behavior:
  → After password reset → ALL refresh tokens cho user bị xóa
  → deleteMany with userId (không phải specific token)
  → Tất cả sessions invalidated
```

---

## 4. CONTROLLER TESTING

### 4.1 Khác biệt với Service Testing

```
Service Test:
  ├── Mock: Prisma, Redis, JWT, Config, Mail
  ├── Test: Business logic, error handling, data flow
  └── Assert: Return values, mock call arguments

Controller Test:
  ├── Mock: AuthService (chỉ 1 dependency)
  ├── Test: HTTP behavior, cookie management, request parsing
  └── Assert: Cookie set/clear, response format, delegation
```

### 4.2 Mock Request & Response

```typescript
const mockRequest = {
  cookies: { refreshToken: 'mock-refresh-token' },
} as unknown as Request;

const mockResponse = {
  cookie: jest.fn(),
  clearCookie: jest.fn(),
} as unknown as Response;
```

```
Express Request mock:
  → Chỉ mock properties controller đọc (cookies)
  → `as unknown as Request` → TypeScript cast (partial mock)

Express Response mock:
  → Mock methods controller gọi (cookie, clearCookie)
  → Verify cookie options, names, values
```

### 4.3 Cookie Verification Tests

```typescript
it('should set refresh token cookie on login', async () => {
  mockAuthService.login.mockResolvedValue({
    accessToken: 'access',
    refreshToken: 'refresh',
    user: mockUser,
  });

  await controller.login(loginDto, '127.0.0.1', mockResponse);

  expect(mockResponse.cookie).toHaveBeenCalledWith(
    'refreshToken',
    'refresh',
    expect.objectContaining({
      httpOnly: true,
      path: '/api/auth',
    }),
  );
});
```

```
Test verify:
  1. Cookie NAME correct: 'refreshToken'
  2. Cookie VALUE correct: service's refreshToken
  3. Cookie OPTIONS correct: httpOnly, path

  expect.objectContaining() → partial match
  → Không cần list TẤT CẢ options (secure, maxAge, etc.)
  → Focus trên critical security options
```

### 4.4 refreshToken NOT in Response Body

```typescript
it('should NOT return refreshToken in response body', async () => {
  const result = await controller.login(loginDto, '127.0.0.1', mockResponse);

  expect(result).not.toHaveProperty('refreshToken');
  expect(result).toHaveProperty('accessToken');
  expect(result).toHaveProperty('user');
});
```

```
CRITICAL security test:
  → refreshToken CHỈ trong cookie, KHÔNG trong body
  → Verify controller filters service response correctly
  → XSS protection: body accessible by JS, cookie httpOnly is not
```

### 4.5 Missing Refresh Token

```typescript
it('should throw MISSING_REFRESH_TOKEN if no cookie', async () => {
  const reqWithoutCookie = { cookies: {} } as unknown as Request;

  await expect(controller.refresh(reqWithoutCookie, mockResponse)).rejects.toThrow(
    UnauthorizedException,
  );
});
```

---

## 5. JWT STRATEGY TESTING

```typescript
describe('JwtStrategy', () => {
  it('should return sub and role from JWT payload', () => {
    const payload = { sub: 'user-123', role: 'STUDENT', iat: 123, exp: 456 };
    const result = strategy.validate(payload);

    expect(result).toEqual({ sub: 'user-123', role: 'STUDENT' });
    expect(result).not.toHaveProperty('iat');
    expect(result).not.toHaveProperty('exp');
  });
});
```

```
Test validate():
  → Input: full JWT payload (sub, role, iat, exp)
  → Output: chỉ { sub, role } (strip iat, exp)
  → Verify: iat, exp KHÔNG có trong result

Tại sao strip iat/exp?
  → Controller/Service không cần biết token issued/expiry time
  → Giảm data truyền qua request pipeline
  → Security: ít thông tin = ít attack surface
```

---

## 6. DTO VALIDATION TESTING

### 6.1 Helper Functions

```typescript
async function validateDto(DtoClass: ClassConstructor<object>, data: Record<string, unknown>) {
  const instance = plainToInstance(DtoClass, data);
  const errors = await validate(instance);
  return errors.flatMap((e) => Object.keys(e.constraints || {}));
}

async function expectValid(DtoClass: ClassConstructor<object>, data: Record<string, unknown>) {
  const constraints = await validateDto(DtoClass, data);
  expect(constraints).toHaveLength(0);
}

async function expectInvalid(DtoClass: ClassConstructor<object>, data: Record<string, unknown>) {
  const constraints = await validateDto(DtoClass, data);
  expect(constraints.length).toBeGreaterThan(0);
}
```

```
validateDto flow:
  1. plainToInstance(RegisterDto, { email: 'bad' })
     → Tạo RegisterDto instance từ plain object
     → class-transformer khớp properties

  2. validate(instance)
     → class-validator chạy decorators (@IsEmail, @MinLength, etc.)
     → Return validation errors

  3. errors.flatMap(e => Object.keys(e.constraints))
     → Extract constraint names: ['isEmail', 'minLength']
     → Empty array = no errors = valid ✅
```

### 6.2 RegisterDto Tests

```typescript
describe('RegisterDto', () => {
  const validData = {
    email: 'test@example.com',
    password: 'Password123',
    fullName: 'Nguyễn Văn A',
  };

  it('should pass with valid data', async () => {
    await expectValid(RegisterDto, validData);
  });

  it('should fail with invalid email', async () => {
    await expectInvalid(RegisterDto, { ...validData, email: 'not-an-email' });
  });

  it('should fail with short password (< 8 chars)', async () => {
    await expectInvalid(RegisterDto, { ...validData, password: 'Ab1' });
  });

  it('should fail with password missing uppercase', async () => {
    await expectInvalid(RegisterDto, { ...validData, password: 'password123' });
  });

  it('should fail with password missing number', async () => {
    await expectInvalid(RegisterDto, { ...validData, password: 'Password' });
  });
});
```

```
Test pattern:
  → Base validData (all fields valid)
  → Override 1 field per test → verify that specific validation
  → Vietnamese names supported: 'Nguyễn Văn A' ✅
```

### 6.3 Empty String Tests — @IsString() Behavior

```typescript
it('should pass with empty password (no @IsNotEmpty on password)', async () => {
  await expectValid(LoginDto, { ...validData, password: '' });
});

it('should pass with empty token (no @IsNotEmpty on token)', async () => {
  await expectValid(VerifyEmailDto, { token: '' });
});
```

```
class-validator behavior:
  @IsString() → ✅ "" (empty string IS a string)
  @IsNotEmpty() → ❌ "" (empty string is empty)

Current DTOs chỉ có @IsString(), KHÔNG có @IsNotEmpty()
→ Empty strings pass validation

Tests document ACTUAL behavior:
  → Test names explicitly note "(no @IsNotEmpty on ...)"
  → Future improvement: thêm @IsNotEmpty() cho required fields
  → Tests phải update khi thêm decorator
```

---

## 7. TEST PATTERNS TỔNG HỢP

### 7.1 Given-When-Then (Arrange-Act-Assert)

```typescript
it('should register a new user', async () => {
  // Given (Arrange) — Setup mocks
  mockPrisma.user.findUnique.mockResolvedValue(null);
  mockPrisma.user.create.mockResolvedValue({});
  (bcrypt.hash as jest.Mock).mockResolvedValue('hash');

  // When (Act) — Execute
  const result = await service.register(dto);

  // Then (Assert) — Verify
  expect(result).toEqual({ message: 'REGISTER_SUCCESS' });
  expect(mockPrisma.user.create).toHaveBeenCalled();
});
```

### 7.2 Testing Thrown Exceptions

```typescript
// Pattern 1: rejects.toThrow(ExceptionClass)
await expect(service.login(dto, ip)).rejects.toThrow(UnauthorizedException);

// Pattern 2: rejects.toThrow() + verify error code
try {
  await service.login(dto, ip);
  fail('Should have thrown');
} catch (error) {
  expect(error).toBeInstanceOf(UnauthorizedException);
  expect((error as UnauthorizedException).getResponse()).toEqual(
    expect.objectContaining({ code: 'INVALID_CREDENTIALS' }),
  );
}
```

### 7.3 Verifying Mock Calls

```typescript
// Verify method was called
expect(mockMail.sendVerificationEmail).toHaveBeenCalled();

// Verify method was called with specific args
expect(mockPrisma.user.create).toHaveBeenCalledWith({
  data: expect.objectContaining({ email: 'test@example.com' }),
});

// Verify method was NOT called
expect(mockMail.sendResetPasswordEmail).not.toHaveBeenCalled();

// Verify call count
expect(mockRedis.del).toHaveBeenCalledTimes(1);
```

---

## 8. TÓM TẮT

```
Auth Module Tests — 87 tests:

Test Files:
  ├── auth.service.spec.ts (42 tests)
  │   ├── Mock: Prisma, JWT, Config, Redis, Mail
  │   ├── Tests: All 9 service methods
  │   ├── Focus: Business logic, security patterns
  │   └── Key: rate limiting, anti-enumeration, token rotation
  │
  ├── auth.controller.spec.ts (17 tests)
  │   ├── Mock: AuthService only
  │   ├── Tests: Cookie set/clear, response format, delegation
  │   ├── Focus: HTTP behavior, NOT business logic
  │   └── Key: refreshToken NOT in body, MISSING_REFRESH_TOKEN
  │
  ├── jwt.strategy.spec.ts (3 tests)
  │   ├── Mock: ConfigService
  │   ├── Tests: validate() strips iat/exp
  │   └── Focus: JWT payload transformation
  │
  └── dto.validation.spec.ts (25 tests)
      ├── Mock: None (direct class-validator)
      ├── Tests: All 6 DTOs, valid/invalid cases
      ├── Focus: Decorator behavior
      └── Key: Vietnamese names, empty string behavior

Mock Strategy:
  ├── jest.mock('bcryptjs') → control hash output
  ├── jest.mock('crypto') → deterministic UUIDs
  ├── jest.fn() → Prisma, Redis, Mail, JWT
  └── clearAllMocks() → clean state between tests

Patterns:
  ├── Given-When-Then structure
  ├── Spread override: { ...mockUser, status: 'UNVERIFIED' }
  ├── rejects.toThrow() for async exceptions
  ├── expect.objectContaining() for partial match
  └── not.toHaveBeenCalled() for guard clause verification
```
