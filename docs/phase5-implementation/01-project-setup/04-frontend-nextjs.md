# 04 — Frontend Next.js Portals

> Giải thích kiến trúc Next.js 16, App Router, i18n, dark mode, và tất cả files trong `apps/student-portal/` và `apps/management-portal/`.

---

## 1. NEXT.JS LÀ GÌ?

### 1.1 Tổng quan

**Next.js** là React framework cho production. Nếu React là thư viện UI, Next.js là framework đầy đủ với:

- **Routing**: File-based routing (tạo file = tạo route)
- **Rendering**: Server Components, SSR, SSG, ISR
- **Optimization**: Automatic code splitting, image/font optimization
- **API**: Server Actions, Route Handlers
- **DX**: Hot reload, TypeScript support, Turbopack bundler

### 1.2 React vs Next.js

```
React (thư viện):
  - Chỉ là UI rendering library
  - Cần setup router (React Router), bundler (Vite/Webpack), SSR (tự setup)
  - Mặc định: Client-Side Rendering (CSR) — browser render tất cả
  - SEO kém (Google bot thấy trang trống)

Next.js (framework):
  - Đầy đủ: routing, rendering, optimization, deployment
  - File-based routing (không cần config)
  - Mặc định: Server Components — render trên server
  - SEO tốt (HTML đầy đủ cho search engines)
```

### 1.3 Tại sao SSLM có 2 frontend portals?

```
apps/student-portal/        → Dành cho Học sinh
  - Duyệt & mua khóa học
  - Xem video bài giảng
  - Chat, Q&A, Social feed
  - AI Tutor

apps/management-portal/     → Dành cho Giảng viên & Admin
  - Tạo & quản lý khóa học
  - Dashboard analytics
  - Quản lý users, reports
  - Rút tiền
```

**Lý do tách:**

1. **UX khác biệt**: Student cần UI khám phá, Instructor cần dashboard quản lý
2. **Performance**: Student portal load nhanh hơn vì không chứa admin code
3. **Security**: Admin features hoàn toàn tách biệt
4. **Deploy độc lập**: Deploy student portal mà không ảnh hưởng management

---

## 2. CẤU TRÚC FOLDER

```
apps/student-portal/                    (management-portal tương tự)
├── .env.local                          # Frontend env vars
├── .env.example                        # Template
├── package.json                        # Dependencies & scripts
├── tsconfig.json                       # TypeScript config
├── next.config.ts                      # Next.js config + i18n plugin
├── postcss.config.mjs                  # PostCSS config (Tailwind CSS v4)
├── next-env.d.ts                       # Auto-generated Next.js types
│
├── messages/                           # i18n translation files
│   ├── vi.json                         # Tiếng Việt
│   └── en.json                         # English
│
├── public/                             # Static files (images, favicon)
│
└── src/
    ├── app/                            # App Router — file-based routing
    │   ├── globals.css                 # Global CSS (Tailwind import)
    │   ├── layout.tsx                  # Root layout (fonts, metadata)
    │   └── [locale]/                   # Dynamic route segment (vi/en)
    │       ├── layout.tsx              # Locale layout (ThemeProvider, i18n)
    │       └── page.tsx                # Homepage
    │
    ├── i18n/                           # Internationalization config
    │   ├── routing.ts                  # Locale routing config
    │   ├── request.ts                  # Server-side locale resolution
    │   └── navigation.ts              # i18n-aware Link, useRouter, ...
    │
    └── lib/
        └── utils.ts                    # cn() helper function
```

---

## 3. GIẢI THÍCH TỪNG FILE

### 3.1 package.json — Scripts

```json
{
  "scripts": {
    "dev": "next dev --port 3001 --turbopack", // Dev server
    "build": "next build", // Production build
    "start": "next start --port 3001", // Run production build
    "lint": "next lint" // ESLint check
  }
}
```

#### Turbopack là gì?

**Turbopack** là bundler viết bằng Rust, thay thế Webpack trong development:

```
Webpack (cũ):
  - Viết bằng JavaScript
  - Cold start: ~3-5s
  - HMR (Hot Module Replacement): ~500ms

Turbopack (mới):
  - Viết bằng Rust (nhanh hơn JS ~10-100x)
  - Cold start: ~0.5s
  - HMR: ~10ms (gần instant)
```

`--turbopack` flag chỉ dùng cho development. Production build vẫn dùng Webpack (Turbopack chưa hỗ trợ production build).

### 3.2 Dependencies — Giải thích từng package

**UI Foundation:**

| Package                          | Mục đích                                                                    |
| -------------------------------- | --------------------------------------------------------------------------- |
| `class-variance-authority` (cva) | Quản lý component variants (size: sm/md/lg, variant: default/outline/ghost) |
| `clsx`                           | Conditional CSS class names: `clsx('btn', isActive && 'btn-active')`        |
| `tailwind-merge`                 | Merge Tailwind classes thông minh: `twMerge('px-2 px-4')` → `'px-4'`        |
| `lucide-react`                   | Icon library (400+ icons, tree-shakeable)                                   |

**State Management:**

| Package                 | Mục đích                                                         |
| ----------------------- | ---------------------------------------------------------------- |
| `@tanstack/react-query` | Server state management — data fetching, caching, sync           |
| `zustand`               | Client state management — lightweight (1KB) alternative to Redux |

**Forms:**

| Package               | Mục đích                                                              |
| --------------------- | --------------------------------------------------------------------- |
| `react-hook-form`     | Performant form library — uncontrolled components, minimal re-renders |
| `@hookform/resolvers` | Validation resolvers — kết nối RHF với Zod                            |
| `zod`                 | Schema validation library — type-safe, composable                     |

**i18n & Theme:**

| Package       | Mục đích                                    |
| ------------- | ------------------------------------------- |
| `next-intl`   | Internationalization cho Next.js App Router |
| `next-themes` | Dark/Light mode với zero-flash              |

**Rich Content:**

| Package                         | Mục đích                                               |
| ------------------------------- | ------------------------------------------------------ |
| `@tiptap/react`                 | Rich text editor (WYSIWYG) — dùng cho posts, Q&A       |
| `@tiptap/starter-kit`           | Tiptap extensions cơ bản (bold, italic, lists, ...)    |
| `@tiptap/extension-placeholder` | Placeholder text cho editor                            |
| `video.js`                      | Video player — dùng cho bài giảng (chỉ student-portal) |
| `recharts`                      | Chart library — analytics, progress                    |

**Real-time:**

| Package            | Mục đích                                         |
| ------------------ | ------------------------------------------------ |
| `socket.io-client` | WebSocket client — chat, notifications real-time |
| `sonner`           | Toast notification library (đẹp, nhẹ)            |

**Dev Dependencies:**

| Package                                | Mục đích                                              |
| -------------------------------------- | ----------------------------------------------------- |
| `tailwindcss` + `@tailwindcss/postcss` | Tailwind CSS v4 (PostCSS plugin)                      |
| `postcss`                              | CSS transformation pipeline                           |
| `eslint-config-next`                   | Next.js ESLint rules (Core Web Vitals, accessibility) |
| `typescript`                           | TypeScript compiler                                   |

### 3.3 tsconfig.json — TypeScript cho Next.js

```json
{
  "compilerOptions": {
    "target": "ES2017", // Output target
    "lib": ["dom", "dom.iterable", "esnext"], // Browser + modern JS APIs
    "strict": true, // Strict type checking
    "noEmit": true, // Next.js handles compilation, TS chỉ check types
    "module": "esnext", // ES Modules
    "moduleResolution": "bundler", // Resolution cho bundler (Turbopack/Webpack)
    "jsx": "react-jsx", // React 17+ JSX transform (không cần import React)
    "incremental": true, // Faster re-checks
    "plugins": [{ "name": "next" }], // Next.js TypeScript plugin
    "paths": {
      "@/*": ["./src/*"] // Path alias: @/components/... → src/components/...
    }
  },
  "include": [
    "next-env.d.ts", // Next.js type declarations
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts" // Auto-generated route types
  ]
}
```

**Khác biệt so với NestJS tsconfig:**

| Setting            | NestJS (Backend)  | Next.js (Frontend)    |
| ------------------ | ----------------- | --------------------- |
| `module`           | `commonjs`        | `esnext`              |
| `moduleResolution` | (default)         | `bundler`             |
| `jsx`              | (không cần)       | `react-jsx`           |
| `noEmit`           | `false` (tự emit) | `true` (bundler emit) |
| `lib`              | (không cần DOM)   | `dom`, `dom.iterable` |
| `outDir`           | `./dist`          | (không cần — bundler) |

### 3.4 next.config.ts — Next.js Configuration

```typescript
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
```

**Plugin pattern:** `withNextIntl` wraps Next.js config, thêm i18n middleware tự động:

- Detect locale từ URL path hoặc Accept-Language header
- Redirect nếu cần (ví dụ: `/en/courses` → load English translations)
- Inject translations vào Server Components

### 3.5 postcss.config.mjs — Tailwind CSS v4

```javascript
const config = {
  plugins: {
    '@tailwindcss/postcss': {}, // Tailwind CSS v4 PostCSS plugin
  },
};
export default config;
```

#### Tailwind CSS là gì?

**Tailwind CSS** là utility-first CSS framework — thay vì viết CSS classes riêng, dùng pre-defined utility classes:

```html
<!-- Traditional CSS -->
<style>
  .card {
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  .card-title {
    font-size: 18px;
    font-weight: 600;
  }
</style>
<div class="card">
  <h3 class="card-title">Hello</h3>
</div>

<!-- Tailwind CSS -->
<div class="rounded-lg p-4 shadow-sm">
  <h3 class="text-lg font-semibold">Hello</h3>
</div>
```

#### Tailwind CSS v4 vs v3

```
Tailwind v3:
  - Config file: tailwind.config.ts (JavaScript)
  - Import: @tailwind base; @tailwind components; @tailwind utilities;
  - Plugin: postcss-tailwindcss (hoặc tailwindcss CLI)

Tailwind v4:
  - Config: CSS-based hoặc zero-config
  - Import: @import 'tailwindcss';  (một dòng duy nhất)
  - Plugin: @tailwindcss/postcss
  - Nhanh hơn, nhẹ hơn
```

### 3.6 globals.css

```css
@import 'tailwindcss';
```

Đây là CSS duy nhất cần — Tailwind v4 tự inject tất cả base styles, utility classes, và CSS reset.

---

## 4. APP ROUTER — FILE-BASED ROUTING

### 4.1 Lý thuyết

Next.js App Router dùng **file system** để định nghĩa routes:

```
src/app/
├── layout.tsx              → Root layout (wrap TẤT CẢ pages)
├── page.tsx                → Route: /
├── about/
│   └── page.tsx            → Route: /about
├── courses/
│   ├── page.tsx            → Route: /courses
│   └── [id]/
│       └── page.tsx        → Route: /courses/abc123 (dynamic)
└── [locale]/               → Dynamic segment: /vi/... hoặc /en/...
    ├── layout.tsx           → Locale layout (wrap locale pages)
    └── page.tsx             → Route: /vi hoặc /en
```

### 4.2 Các file đặc biệt trong App Router

| File            | Mục đích                                         |
| --------------- | ------------------------------------------------ |
| `layout.tsx`    | Layout wrap children — persist across navigation |
| `page.tsx`      | Page component — UI chính cho route              |
| `loading.tsx`   | Loading UI (React Suspense)                      |
| `error.tsx`     | Error boundary                                   |
| `not-found.tsx` | 404 page                                         |
| `template.tsx`  | Giống layout nhưng re-mount mỗi lần navigate     |

### 4.3 Dynamic Route: [locale]

```
src/app/[locale]/page.tsx

URL: /vi      → locale = 'vi'
URL: /en      → locale = 'en'
URL: /fr      → locale = 'fr' → notFound() vì không hỗ trợ
```

`[locale]` là **dynamic segment** — Next.js extract giá trị từ URL và truyền vào component qua `params`.

### 4.4 Route Groups: (auth), (main), (learning)

```
src/app/[locale]/
├── (auth)/           → Group cho auth pages
│   ├── login/
│   └── register/
├── (main)/           → Group cho main pages
│   ├── courses/
│   └── social/
└── (learning)/       → Group cho learning pages
    └── learn/
```

**Route groups** (parentheses) = tổ chức folder logic, KHÔNG ảnh hưởng URL:

- `(auth)/login/page.tsx` → URL: `/vi/login` (KHÔNG phải `/vi/auth/login`)
- Mỗi group có thể có layout riêng (ví dụ: auth layout không có navbar)

---

## 5. LAYOUT SYSTEM

### 5.1 Root Layout — `src/app/layout.tsx`

```tsx
import { Inter, JetBrains_Mono } from 'next/font/google';

// Google Fonts — Next.js tự download, optimize, host locally
const inter = Inter({
  subsets: ['latin', 'vietnamese'], // Subset chứa Vietnamese characters
  variable: '--font-inter', // CSS variable name
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono', // Monospace font cho code blocks
});

export const metadata: Metadata = {
  title: 'Smart Social Learning Marketplace',
  description: 'Nền tảng học trực tuyến kết hợp mạng xã hội và AI Tutor',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

#### Tại sao `suppressHydrationWarning`?

**Hydration** là quá trình React "kích hoạt" HTML server-rendered trên client:

1. Server render HTML: `<html class="dark">` (dựa vào theme preference)
2. Client nhận HTML, React "hydrate" — so sánh DOM
3. Nếu server render `class=""` nhưng client muốn `class="dark"` → **Hydration mismatch warning**

`suppressHydrationWarning` trên `<html>` tag: cho React biết "attribute trên thẻ này có thể khác giữa server/client — đừng warn". Đây là pattern chuẩn khi dùng `next-themes`.

#### Next.js Font Optimization

```typescript
const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
});
```

Next.js tự động:

1. Download font files từ Google Fonts tại build time
2. Host font files cùng app (không cần request đến Google)
3. Inject `@font-face` declarations
4. Apply `font-display: swap` (hiện fallback font trong khi load)

**CSS Variable approach**: Đặt font vào CSS variable `--font-inter`, Tailwind dùng qua `font-sans` class.

### 5.2 Locale Layout — `src/app/[locale]/layout.tsx`

```tsx
export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params; // Extract locale từ URL

  // Validate locale
  if (!routing.locales.includes(locale as 'vi' | 'en')) {
    notFound(); // 404 nếu locale không hỗ trợ
  }

  // Load translation messages
  const messages = await getMessages();

  return (
    <ThemeProvider
      attribute="data-theme" // Thêm data-theme="dark" lên <html>
      defaultTheme="system" // Mặc định theo OS preference
      enableSystem // Lắng nghe OS theme changes
      storageKey="sslm-theme" // localStorage key
    >
      <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
    </ThemeProvider>
  );
}
```

#### Layout Nesting

Layouts nest tự động — mỗi level wrap level dưới:

```
RootLayout (fonts, metadata, <html>, <body>)
  └── LocaleLayout (ThemeProvider, i18n Provider)
       └── (main) GroupLayout (Navbar, Footer)  [sẽ thêm sau]
            └── Page (nội dung)
```

Khi navigate giữa các pages trong cùng layout → **layout KHÔNG re-render**, chỉ page thay đổi. Đây là lý do navbar/sidebar không nhấp nháy khi chuyển trang.

---

## 6. I18N (INTERNATIONALIZATION) — next-intl

### 6.1 Lý thuyết i18n

**i18n** (internationalization — "i" + 18 chữ + "n") = chuẩn bị app cho multi-language.
**l10n** (localization) = dịch nội dung cho từng ngôn ngữ cụ thể.

```
i18n setup:
  - Routing: /vi/courses vs /en/courses
  - Translation loading: vi.json, en.json
  - Date/Number formatting: 1.000.000đ vs $1,000,000

l10n content:
  - vi.json: { "greeting": "Xin chào" }
  - en.json: { "greeting": "Hello" }
```

### 6.2 routing.ts — Locale Configuration

```typescript
export const routing = defineRouting({
  locales: ['vi', 'en'], // Supported languages
  defaultLocale: 'vi', // Default = Vietnamese
  localePrefix: 'as-needed', // Chỉ thêm prefix khi KHÔNG phải default
});
```

**localePrefix: 'as-needed' nghĩa là:**

```
Vietnamese (default — không cần prefix):
  /courses           → vi
  /ai-tutor          → vi

English (cần prefix):
  /en/courses        → en
  /en/ai-tutor       → en
```

So sánh các strategies:

| Strategy    | Vietnamese    | English                       |
| ----------- | ------------- | ----------------------------- |
| `always`    | `/vi/courses` | `/en/courses`                 |
| `as-needed` | `/courses`    | `/en/courses`                 |
| `never`     | `/courses`    | `/courses` (detect by header) |

### 6.3 request.ts — Server-side Locale Resolution

```typescript
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale; // Locale từ URL path

  // Fallback nếu locale không hợp lệ
  if (!locale || !routing.locales.includes(locale as 'vi' | 'en')) {
    locale = routing.defaultLocale; // → 'vi'
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Dynamic import: chỉ load file translation của locale hiện tại
    // → /vi → load vi.json
    // → /en → load en.json
  };
});
```

### 6.4 navigation.ts — i18n-aware Navigation

```typescript
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
```

**Thay thế** các navigation APIs của Next.js bằng phiên bản i18n-aware:

```tsx
// ❌ Sai — Next.js Link không biết locale:
import Link from 'next/link';
<Link href="/courses">Courses</Link>; // → /courses (luôn luôn)

// ✅ Đúng — next-intl Link tự thêm locale prefix:
import { Link } from '@/i18n/navigation';
<Link href="/courses">Courses</Link>;
// User đang ở /en → render: /en/courses
// User đang ở /vi → render: /courses (no prefix, as-needed)
```

### 6.5 Translation Files — messages/vi.json

```json
{
  "common": {
    "appName": "Smart Social Learning Marketplace",
    "loading": "Đang tải...",
    "save": "Lưu",
    "cancel": "Hủy",
    "delete": "Xóa",
    "edit": "Chỉnh sửa",
    "search": "Tìm kiếm"
  }
}
```

**Cách dùng trong component:**

```tsx
import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('common');  // Namespace: common

  return (
    <h1>{t('appName')}</h1>         // → "Smart Social Learning Marketplace"
    <p>{t('loading')}</p>            // → "Đang tải..." (vi) hoặc "Loading..." (en)
  );
}
```

---

## 7. DARK/LIGHT MODE — next-themes

### 7.1 Cách hoạt động

```
1. User chọn theme (hoặc dùng system default)
2. next-themes lưu vào localStorage key "sslm-theme"
3. next-themes thêm attribute data-theme="dark" lên <html>
4. Tailwind CSS đọc data-theme → apply dark variant

<html data-theme="dark">        ← next-themes set
  <div class="bg-background">   ← Tailwind: light → white, dark → near-black
```

### 7.2 ThemeProvider config

```tsx
<ThemeProvider
  attribute="data-theme"      // Attribute name trên <html>
  defaultTheme="system"       // 3 options: "light", "dark", "system"
  enableSystem                // Listen OS prefers-color-scheme changes
  storageKey="sslm-theme"     // localStorage key (unique per app)
>
```

### 7.3 Design Tokens

Thay vì hardcode colors, dùng **semantic tokens** qua Tailwind:

```tsx
// ❌ Sai — hardcode color:
<div className="bg-white text-black dark:bg-gray-900 dark:text-white">

// ✅ Đúng — semantic tokens:
<div className="bg-background text-foreground">
```

Tokens tự động chuyển đổi theo theme:

| Token                   | Light      | Dark       |
| ----------------------- | ---------- | ---------- |
| `bg-background`         | White      | Near-black |
| `text-foreground`       | Black      | White      |
| `bg-card`               | White      | Dark gray  |
| `text-muted-foreground` | Gray       | Light gray |
| `border`                | Light gray | Dark gray  |

---

## 8. SERVER COMPONENTS vs CLIENT COMPONENTS

### 8.1 Lý thuyết

Next.js App Router mặc định tất cả components là **Server Components**:

```
Server Component (mặc định):
  ✅ Render trên server → client nhận HTML hoàn chỉnh
  ✅ SEO tốt (HTML có content)
  ✅ Không gửi JavaScript xuống client (nhẹ hơn)
  ✅ Có thể truy cập DB, file system trực tiếp
  ❌ Không dùng được hooks (useState, useEffect)
  ❌ Không dùng được event handlers (onClick, onChange)
  ❌ Không dùng được Browser APIs (window, localStorage)

Client Component ('use client'):
  ✅ Dùng được hooks, events, Browser APIs
  ✅ Interactive: forms, modals, dropdowns
  ❌ Gửi JavaScript xuống client (nặng hơn)
  ❌ SEO kém hơn (cần hydration)
```

### 8.2 Khi nào dùng 'use client'?

```tsx
// Homepage — Server Component (KHÔNG cần 'use client')
// Chỉ hiển thị text tĩnh, không có interaction
export default function HomePage() {
  const t = useTranslations('common'); // Server-side translation
  return <h1>{t('appName')}</h1>;
}

// LoginForm — Client Component (CẦN 'use client')
// Có form, useState, event handlers
('use client');
export function LoginForm() {
  const [email, setEmail] = useState('');
  return <input onChange={(e) => setEmail(e.target.value)} />;
}
```

**Lưu ý:** `useTranslations` từ next-intl hoạt động ở CẢ Server và Client Components.

---

## 9. UTILITY FUNCTION — cn()

### 9.1 File lib/utils.ts

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### 9.2 Tại sao cần cn()?

**clsx**: Conditional class names

```typescript
clsx('btn', isActive && 'btn-active', size === 'lg' && 'btn-lg');
// isActive=true, size='lg' → 'btn btn-active btn-lg'
// isActive=false, size='sm' → 'btn'
```

**tailwind-merge**: Giải quyết Tailwind class conflicts

```typescript
// Vấn đề: Tailwind classes conflict
twMerge('px-2 py-1 px-4'); // → 'py-1 px-4' (px-4 wins, px-2 removed)

// Không có twMerge:
('px-2 py-1 px-4'); // Browser áp dụng cả px-2 VÀ px-4 → kết quả không dự đoán được
```

**cn() = clsx + twMerge**: Dùng khi build component variants

```tsx
function Button({ variant, className }: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded-lg px-4 py-2', // Base styles
        variant === 'primary' && 'bg-primary text-white',
        variant === 'outline' && 'border-input border',
        className, // Override from parent
      )}
    />
  );
}

// Usage:
<Button variant="primary" className="px-8" />;
// cn() resolves: 'rounded-lg px-8 py-2 bg-primary text-white'
// px-4 (base) bị override bởi px-8 (className) ← tailwind-merge handles this
```

`cn()` là standard utility trong mọi project dùng shadcn/ui.

---

## 10. KHÁC BIỆT GIỮA 2 PORTALS

| Aspect             | Student Portal                    | Management Portal             |
| ------------------ | --------------------------------- | ----------------------------- |
| **Port**           | 3001                              | 3002                          |
| **Metadata title** | Smart Social Learning Marketplace | SSLM Management               |
| **Route groups**   | (auth), (main), (learning)        | (auth), (instructor), (admin) |
| **video.js**       | ✅ Có (xem video bài giảng)       | ❌ Không                      |
| **Target users**   | Students                          | Instructors, Admins           |
| **i18n config**    | Giống nhau                        | Giống nhau                    |
| **Theme config**   | Giống nhau                        | Giống nhau                    |

Ngoài những khác biệt trên, cấu trúc code và config hoàn toàn tương tự. Shared logic nằm trong `packages/`.
