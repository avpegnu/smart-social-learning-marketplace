# 05 — Shared Packages (Monorepo)

> Giải thích 6 shared packages trong `packages/`, cách chúng hoạt động và tại sao cần thiết.

---

## 1. TẠI SAO CẦN SHARED PACKAGES?

### 1.1 Vấn đề: Code duplication

Không có shared packages:

```typescript
// apps/student-portal/src/types/user.ts
interface User { id: string; email: string; fullName: string; role: Role; }

// apps/management-portal/src/types/user.ts
interface User { id: string; email: string; fullName: string; role: Role; }
// ← COPY PASTE! Nếu thay đổi → phải sửa 2 chỗ

// apps/student-portal/src/utils/format-price.ts
function formatPrice(amount: number) { ... }

// apps/management-portal/src/utils/format-price.ts
function formatPrice(amount: number) { ... }
// ← COPY PASTE AGAIN! Bug fix → phải sửa 2 chỗ
```

### 1.2 Giải pháp: Shared packages

```typescript
// packages/shared-types/src/index.ts — DEFINE MỘT LẦN
export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}

// apps/student-portal — IMPORT
import { User } from '@shared/types';

// apps/management-portal — IMPORT (cùng source)
import { User } from '@shared/types';

// Thay đổi User interface → CẢ 2 apps tự động cập nhật
```

### 1.3 Nguyên tắc DRY

**DRY** = Don't Repeat Yourself. Mỗi piece of knowledge nên có **ONE single, authoritative representation** trong codebase.

---

## 2. CẤU TRÚC CHUNG CỦA MỖI PACKAGE

```
packages/shared-xxx/
├── package.json           # Package metadata & scripts
├── tsconfig.json          # TypeScript config
└── src/
    └── index.ts           # Entry point — export tất cả
```

### 2.1 package.json mẫu

```json
{
  "name": "@shared/types", // Scoped package name
  "version": "0.0.1",
  "private": true, // Không publish lên npm
  "main": "./src/index.ts", // Entry point (source, không build)
  "types": "./src/index.ts", // TypeScript types entry
  "scripts": {
    "lint": "eslint \"src/**/*.ts\"",
    "clean": "rm -rf dist"
  }
}
```

#### `"main": "./src/index.ts"` — Tại sao trỏ đến source?

Thông thường, npm packages trỏ `main` đến compiled code (`dist/index.js`). Nhưng trong **monorepo internal packages**, ta trỏ thẳng đến **TypeScript source**:

```
External package (react, lodash):
  package.json: "main": "dist/index.js"
  → Bundler import compiled JavaScript
  → Cần build trước khi dùng

Internal package (@shared/types):
  package.json: "main": "./src/index.ts"
  → Bundler (Turbopack, Webpack) import TypeScript trực tiếp
  → KHÔNG cần build — bundler của apps tự compile
  → Changes reflect immediately (không cần rebuild)
```

#### Scoped package name: @shared/xxx

`@shared` là **scope** — nhóm packages liên quan:

```
@shared/types       → packages/shared-types/
@shared/utils       → packages/shared-utils/
@shared/ui          → packages/shared-ui/
@shared/hooks       → packages/shared-hooks/
@shared/i18n        → packages/shared-i18n/
@shared/api-client  → packages/shared-api-client/
```

npm workspaces tự động resolve: khi code import `@shared/types`, npm biết trỏ đến `packages/shared-types/` thông qua symlink trong root `node_modules/`.

### 2.2 tsconfig.json mẫu

```json
{
  "compilerOptions": {
    "target": "ES2022", // Modern JavaScript
    "module": "ESNext", // ES Modules output
    "moduleResolution": "bundler", // Cho bundler resolve
    "declaration": true, // Generate .d.ts files
    "strict": true, // Strict type checking
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

---

## 3. GIẢI THÍCH TỪNG PACKAGE

### 3.1 @shared/types — TypeScript Type Definitions

**Mục đích:** Single source of truth cho tất cả TypeScript types/interfaces dùng chung giữa frontend và backend.

```typescript
// === User types ===

export interface User {
  id: string; // CUID from Prisma
  email: string;
  fullName: string;
  role: Role;
  avatarUrl: string | null; // Nullable — user có thể chưa set avatar
  isActive: boolean;
  createdAt: string; // ISO 8601 string (JSON serialize Date → string)
  updatedAt: string;
}

export enum Role {
  STUDENT = 'STUDENT',
  INSTRUCTOR = 'INSTRUCTOR',
  ADMIN = 'ADMIN',
}
```

#### Tại sao `createdAt: string` thay vì `Date`?

Khi backend gửi JSON response, `Date` objects tự động serialize thành ISO string:

```
Backend (Prisma):     createdAt: Date (2024-01-15T10:30:00.000Z)
JSON.stringify():     "createdAt": "2024-01-15T10:30:00.000Z"  ← string
Frontend nhận:        createdAt: string
```

Nên type definition dùng `string` cho dates — đây là type SAU KHI qua JSON.

#### API Response types

```typescript
// Standardized response wrapper
export interface ApiResponse<T> {
  data: T; // Actual data
  meta?: PaginationMeta; // Pagination info (optional)
}

export interface PaginationMeta {
  page: number; // Current page (1-based)
  limit: number; // Items per page
  total: number; // Total items
  totalPages: number; // Total pages
}

// Standardized error format
export interface ApiError {
  code: string; // Machine-readable: 'EMAIL_ALREADY_EXISTS'
  message: string; // Human-readable (for dev, NOT for UI)
  statusCode: number; // HTTP status: 400, 401, 404, ...
  field?: string; // Which field has error: 'email'
}
```

**Generic type `<T>` giải thích:**

```typescript
ApiResponse<User>        → { data: User, meta?: PaginationMeta }
ApiResponse<User[]>      → { data: User[], meta?: PaginationMeta }
ApiResponse<Course>      → { data: Course, meta?: PaginationMeta }
// T là placeholder — thay bằng type thực tế khi dùng
```

### 3.2 @shared/utils — Utility Functions

**Mục đích:** Pure functions (không side effects) dùng chung.

#### formatPrice()

```typescript
export function formatPrice(amount: number, locale: string = 'vi'): string {
  if (locale === 'vi') {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
    // 1500000 → "1.500.000 ₫"
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
  // 1500000 → "VND 1,500,000"
}
```

**Intl.NumberFormat** là Web API chuẩn cho number formatting — tự động handle:

- Thousands separator (dấu chấm hoặc dấu phẩy tùy locale)
- Currency symbol placement
- Decimal digits

#### formatRelativeTime()

```typescript
export function formatRelativeTime(date: string | Date, locale: string = 'vi'): string {
  // Tính khoảng cách thời gian
  const diffDays = Math.floor(diffHours / 24);

  // Intl.RelativeTimeFormat — format "5 phút trước", "2 days ago"
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffDays > 0) return rtf.format(-diffDays, 'day'); // "3 ngày trước"
  if (diffHours > 0) return rtf.format(-diffHours, 'hour'); // "2 giờ trước"
  if (diffMinutes > 0) return rtf.format(-diffMinutes, 'minute'); // "5 phút trước"
  return rtf.format(-diffSeconds, 'second'); // "vài giây trước"
}
```

**Intl.RelativeTimeFormat** tự động localize:

- `locale='vi'`: "3 ngày trước", "2 giờ trước"
- `locale='en'`: "3 days ago", "2 hours ago"
- `numeric: 'auto'`: "yesterday" thay vì "1 day ago"

### 3.3 @shared/i18n — Internationalization Shared Config

```typescript
// Supported locales — dùng `as const` để TypeScript biết chính xác values
export const SUPPORTED_LOCALES = ['vi', 'en'] as const;

// Type từ const array: 'vi' | 'en' (không phải string chung chung)
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'vi';

// Mapping: Backend error codes → i18n translation keys
export const API_ERROR_KEYS: Record<string, string> = {
  INVALID_CREDENTIALS: 'apiErrors.invalidCredentials',
  EMAIL_ALREADY_EXISTS: 'apiErrors.emailAlreadyExists',
  INVALID_REFRESH_TOKEN: 'apiErrors.invalidRefreshToken',
  ACCOUNT_SUSPENDED: 'apiErrors.accountSuspended',
  EMAIL_NOT_VERIFIED: 'apiErrors.emailNotVerified',
};
```

#### `as const` là gì?

```typescript
// Không có as const:
const LOCALES = ['vi', 'en']; // Type: string[] — mất thông tin cụ thể

// Có as const:
const LOCALES = ['vi', 'en'] as const; // Type: readonly ['vi', 'en']
// TypeScript biết chính xác: chỉ có 'vi' và 'en'

type Locale = (typeof LOCALES)[number]; // = 'vi' | 'en'
```

#### API_ERROR_KEYS — Error Flow

```
1. Backend throws:
   throw new ConflictException({ code: 'EMAIL_ALREADY_EXISTS', field: 'email' });

2. Frontend receives error:
   { code: 'EMAIL_ALREADY_EXISTS', statusCode: 409, field: 'email' }

3. Frontend maps to i18n key:
   const key = API_ERROR_KEYS[error.code];  // → 'apiErrors.emailAlreadyExists'

4. Frontend gets localized message:
   const message = t(key);  // vi: "Email đã tồn tại" | en: "Email already exists"

5. Display to user
```

**Tại sao pattern này?**

- Backend KHÔNG biết user dùng ngôn ngữ nào → không nên trả text localized
- Backend trả **machine-readable code** → frontend map sang ngôn ngữ phù hợp
- Thêm ngôn ngữ mới chỉ cần thêm translation file, KHÔNG sửa backend

### 3.4 @shared/ui — Shared React Components (Empty)

```typescript
// Sẽ chứa:
// - shadcn/ui components được customize
// - Common layout components (Card, Badge, Avatar, ...)
// - Form components dùng chung

export {}; // Empty for now
```

Chưa có nội dung vì shadcn/ui sẽ được init ở bước tiếp theo.

### 3.5 @shared/hooks — Shared React Hooks (Empty)

```typescript
// Sẽ chứa:
// - useDebounce() — debounce search input
// - useMediaQuery() — responsive breakpoints
// - useLocalStorage() — type-safe localStorage
// - useIntersectionObserver() — infinite scroll, lazy loading

export {}; // Empty for now
```

### 3.6 @shared/api-client — API Client & Query Hooks (Empty)

```typescript
// Sẽ chứa:
// - Axios/Fetch instance với interceptors (auto-refresh token)
// - TanStack Query hooks:
//   - useUser(), useCourses(), useEnrollments(), ...
//   - useMutationCreateCourse(), useMutationLogin(), ...
// - Query key factories: queryKeys.courses.all(), queryKeys.users.detail(id)

export {}; // Empty for now
```

---

## 4. CÁCH IMPORT VÀ SỬ DỤNG

```typescript
// ╔═══════════════════════════════════════════════════════╗
// ║  Bất kỳ file nào trong apps/ hoặc packages/         ║
// ╚═══════════════════════════════════════════════════════╝

// Import types
import type { User, Role, ApiResponse, ApiError } from '@shared/types';

// Import utilities
import { formatPrice, formatRelativeTime } from '@shared/utils';

// Import i18n config
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, API_ERROR_KEYS } from '@shared/i18n';

// Import UI components (sau khi implement)
import { Button, Card, Avatar } from '@shared/ui';

// Import hooks (sau khi implement)
import { useDebounce, useMediaQuery } from '@shared/hooks';

// Import API client (sau khi implement)
import { useUser, useCourses } from '@shared/api-client';
```

---

## 5. DEPENDENCY GRAPH

```
                    @shared/types
                   ╱      │       ╲
                  ╱       │        ╲
         @shared/utils  @shared/i18n  @shared/api-client
                  ╲       │        ╱        │
                   ╲      │       ╱         │
                    @shared/ui    @shared/hooks
                   ╱      │       ╲
                  ╱       │        ╲
            student-    api      management-
            portal               portal
```

- `@shared/types` là foundation — không depend on ai
- Packages khác CÓ THỂ depend on `@shared/types`
- Apps (leaf nodes) import từ packages
- Turborepo xử lý build order dựa trên dependency graph này
