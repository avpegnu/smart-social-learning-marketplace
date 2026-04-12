# 05 — Custom Decorators: @CurrentUser, @Roles, @Public

> Giải thích Decorators trong TypeScript/NestJS, cách tạo custom decorators,
> SetMetadata pattern, và createParamDecorator.

---

## 1. DECORATOR LÀ GÌ?

### 1.1 Concept

**Decorator** là function đặc biệt gắn thêm **metadata** (thông tin bổ sung) vào class, method, hoặc parameter. Khai báo bằng `@` prefix.

```typescript
@Injectable() // Class decorator — "class này có thể inject"
export class AuthService {
  @Get('profile') // Method decorator — "method này handle GET /profile"
  getProfile(
    @Param('id') id: string, // Parameter decorator — "lấy :id từ URL"
  ) {}
}
```

### 1.2 Decorator hoạt động thế nào?

```typescript
// Decorator thực chất là FUNCTION:
function Injectable() {
  return function (target: Function) {
    // Gắn metadata vào class
    Reflect.defineMetadata('injectable', true, target);
  };
}

// Khi viết:
@Injectable()
class AuthService {}

// Tương đương:
Injectable()(AuthService);
// → Gắn metadata: AuthService.injectable = true
// → NestJS DI đọc metadata này → biết class nào cần manage
```

### 1.3 Tại sao NestJS dùng Decorators?

```
Không có decorators (Express.js):
  router.get('/profile', authMiddleware, rolesMiddleware('ADMIN'), (req, res) => {
    const userId = req.user.id;  // Phải đọc từ request manually
    // ...
  });

Có decorators (NestJS):
  @Get('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  getProfile(@CurrentUser('sub') userId: string) {
    // Clean, declarative, type-safe
  }
```

---

## 2. METADATA PATTERN — SetMetadata

### 2.1 SetMetadata là gì?

`SetMetadata()` gắn key-value metadata vào controller method hoặc class. Metadata này được đọc lại bởi Guards, Interceptors, etc.

```
@Roles('ADMIN', 'INSTRUCTOR')
        │
        ▼
SetMetadata('roles', ['ADMIN', 'INSTRUCTOR'])
        │
        ▼
Metadata stored on method: { roles: ['ADMIN', 'INSTRUCTOR'] }
        │
        ▼
RolesGuard reads metadata → check user.role ∈ ['ADMIN', 'INSTRUCTOR']
```

### 2.2 `@Public()` Decorator

```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

**Phân tích:**

```typescript
// Public là factory function — gọi () trả về decorator
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
//           ^^^^^^   ^^   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//           Tên       Factory   NestJS helper gắn metadata

// Sử dụng:
@Public()
@Get('health')
healthCheck() { return { status: 'ok' }; }

// Tương đương:
SetMetadata('isPublic', true)  // Gắn lên method healthCheck
```

**Mục đích:** Đánh dấu endpoint **không cần JWT token**. JwtAuthGuard đọc metadata này:

```typescript
// JwtAuthGuard kiểm tra:
const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
  context.getHandler(), // Check method-level metadata
  context.getClass(), // Check class-level metadata
]);
if (isPublic) return true; // Bỏ qua JWT verification
```

**Use cases cho @Public():**

```typescript
@Controller('auth')
export class AuthController {
  @Public()
  @Post('login') // ← Không cần token (chưa login)
  login() {}

  @Public()
  @Post('register') // ← Không cần token (chưa có account)
  register() {}

  @Get('profile') // ← CẦN token (đã login)
  getProfile() {}
}
```

### 2.3 `@Roles()` Decorator

```typescript
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

**Rest parameters `...roles`** — nhận nhiều arguments:

```typescript
@Roles('ADMIN')                        // roles = ['ADMIN']
@Roles('ADMIN', 'INSTRUCTOR')         // roles = ['ADMIN', 'INSTRUCTOR']
```

**Sử dụng với RolesGuard:**

```typescript
@Post('approve')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')                        // Chỉ ADMIN mới gọi được
approveApplication() {}

@Post()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('INSTRUCTOR', 'ADMIN')         // INSTRUCTOR hoặc ADMIN
createCourse() {}
```

### 2.4 Tại sao export cả constant (`IS_PUBLIC_KEY`, `ROLES_KEY`)?

```typescript
export const IS_PUBLIC_KEY = 'isPublic'; // ← Export constant
export const ROLES_KEY = 'roles'; // ← Export constant
```

Guard cần dùng **cùng key** để đọc metadata:

```typescript
// Decorator gắn metadata:
SetMetadata('isPublic', true);

// Guard đọc metadata — phải dùng CÙNG KEY 'isPublic':
this.reflector.getAllAndOverride<boolean>('isPublic', [...]);
//                                        ^^^^^^^^^ Nếu typo → không đọc được!

// Dùng shared constant → không bao giờ typo:
this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [...]);
```

---

## 3. PARAMETER DECORATOR — createParamDecorator

### 3.1 `@CurrentUser()` Decorator

```typescript
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    return data ? user?.[data] : user;
  },
);
```

### 3.2 Phân tích

**`createParamDecorator()`** tạo custom parameter decorator cho controller methods.

**Parameters:**

| Param  | Type                            | Giải thích                           |
| ------ | ------------------------------- | ------------------------------------ |
| `data` | `keyof JwtPayload \| undefined` | Argument truyền vào decorator        |
| `ctx`  | `ExecutionContext`              | Context chứa request, response, etc. |

**`request.user`** — Passport.js tự gắn decoded JWT payload vào `request.user` sau khi verify token:

```
Client → Authorization: Bearer eyJhbGci...
                                │
JwtAuthGuard → Passport verify token
                                │
                    Decoded: { sub: 'clx1...', role: 'STUDENT' }
                                │
                    Gắn vào request.user
                                │
@CurrentUser() → đọc request.user
```

### 3.3 Cách sử dụng

```typescript
// Lấy toàn bộ JWT payload
@Get('profile')
getProfile(@CurrentUser() user: JwtPayload) {
  // user = { sub: 'clx1...', role: 'STUDENT', iat: ..., exp: ... }
  return this.usersService.findById(user.sub);
}

// Chỉ lấy 1 field cụ thể
@Post('courses')
createCourse(@CurrentUser('sub') userId: string) {
  // userId = 'clx1...' — trực tiếp lấy sub field
  return this.coursesService.create(userId, dto);
}

@Get('role')
getRole(@CurrentUser('role') role: string) {
  // role = 'STUDENT' — trực tiếp lấy role field
}
```

### 3.4 Logic `data ? user?.[data] : user`

```typescript
return data ? user?.[data] : user;
//     ^^^^   ^^^^^^^^^^^^^   ^^^^
//     Nếu có data (key)?     Không → trả về toàn bộ user
//              │
//              └── Có → trả về user[data] (1 field)
//                        user?.  = optional chaining (null-safe)
```

```
@CurrentUser()         → data = undefined → return user (toàn bộ)
@CurrentUser('sub')    → data = 'sub'     → return user?.sub
@CurrentUser('role')   → data = 'role'    → return user?.role
```

---

## 4. ExecutionContext — CONTEXT CỦA REQUEST

### 4.1 ExecutionContext là gì?

**ExecutionContext** chứa thông tin về request hiện tại. NestJS hỗ trợ nhiều loại transport:

```
HTTP Request:    ctx.switchToHttp()   → getRequest(), getResponse()
WebSocket:       ctx.switchToWs()     → getClient(), getData()
RPC (Microservice): ctx.switchToRpc() → getContext(), getData()
```

### 4.2 Cách đọc request trong mỗi context

```typescript
// HTTP — đọc Express request
const request = ctx.switchToHttp().getRequest();
const userId = request.user.sub;
const ip = request.ip;
const method = request.method;

// WebSocket — đọc Socket.IO client
const client = ctx.switchToWs().getClient<Socket>();
const userId = client.data.userId;
const token = client.handshake.auth?.token;
```

### 4.3 `getHandler()` và `getClass()`

```typescript
const handler = context.getHandler(); // Reference đến controller method
const cls = context.getClass(); // Reference đến controller class
```

Dùng trong Guards/Interceptors để đọc metadata:

```typescript
// Reflector đọc metadata từ method VÀ class:
this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
  context.getHandler(), // @Public() trên method
  context.getClass(), // @Public() trên class (apply cho tất cả methods)
]);
```

---

## 5. BARREL EXPORT — `index.ts`

### 5.1 File `decorators/index.ts`

```typescript
export { CurrentUser } from './current-user.decorator';
export { Roles, ROLES_KEY } from './roles.decorator';
export { Public, IS_PUBLIC_KEY } from './public.decorator';
```

### 5.2 Tại sao cần barrel export?

```typescript
// ❌ Không có barrel — import dài dòng
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

// ✅ Có barrel — import gọn từ index
import { CurrentUser, Roles, Public } from '../common/decorators';
//                                                    ^^^^^^^^^^ tự động resolve index.ts
```

---

## 6. SO SÁNH 3 LOẠI DECORATORS TRONG SSLM

| Decorator        | Loại         | NestJS API             | Đọc bởi                                    |
| ---------------- | ------------ | ---------------------- | ------------------------------------------ |
| `@Public()`      | Method/Class | `SetMetadata`          | JwtAuthGuard (Reflector)                   |
| `@Roles(...)`    | Method/Class | `SetMetadata`          | RolesGuard (Reflector)                     |
| `@CurrentUser()` | Parameter    | `createParamDecorator` | NestJS framework (inject vào method param) |

---

## 7. TÓM TẮT

```
Decorators trong Phase 5.3:

@Public()
  ├── SetMetadata('isPublic', true)
  ├── Bypass JwtAuthGuard
  └── Dùng cho: login, register, health check, public endpoints

@Roles('ADMIN', 'INSTRUCTOR')
  ├── SetMetadata('roles', ['ADMIN', 'INSTRUCTOR'])
  ├── RolesGuard kiểm tra user.role ∈ requiredRoles
  └── Dùng cho: admin endpoints, instructor-only actions

@CurrentUser() / @CurrentUser('sub')
  ├── createParamDecorator → đọc request.user
  ├── Trả về toàn bộ JwtPayload hoặc 1 field
  └── Dùng cho: lấy userId, role trong controller methods
```
