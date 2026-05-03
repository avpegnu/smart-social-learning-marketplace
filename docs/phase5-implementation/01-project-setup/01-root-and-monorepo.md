# 01 — Root Configuration & Monorepo Architecture

> Giải thích toàn bộ file và folder ở root level, cùng lý thuyết về Monorepo.

---

## 1. TỔNG QUAN CẤU TRÚC ROOT

```
smart-social-learning-marketplace/
├── .editorconfig              # Chuẩn hóa editor settings
├── .gitignore                 # Danh sách file/folder Git bỏ qua
├── .husky/                    # Git hooks (pre-commit, commit-msg)
├── .prettierrc                # Prettier config (format code)
├── .prettierignore            # File Prettier bỏ qua
├── commitlint.config.js       # Validate commit messages
├── docker-compose.yml         # Docker containers (DB, Redis, pgAdmin)
├── eslint.config.mjs          # ESLint config (lint code)
├── package.json               # Root package — workspaces + scripts
├── package-lock.json          # Lock file — fixed dependency versions
├── turbo.json                 # Turborepo orchestration config
├── CLAUDE.md                  # AI coding instructions (gitignored)
│
├── apps/                      # 3 applications
│   ├── api/                   # NestJS backend (port 3000)
│   ├── student-portal/        # Next.js student app (port 3001)
│   └── management-portal/     # Next.js instructor/admin app (port 3002)
│
├── packages/                  # 6 shared packages
│   ├── shared-types/          # TypeScript types dùng chung
│   ├── shared-utils/          # Utility functions dùng chung
│   ├── shared-ui/             # React components dùng chung
│   ├── shared-hooks/          # React hooks dùng chung
│   ├── shared-i18n/           # i18n config dùng chung
│   └── shared-api-client/     # API client dùng chung
│
└── docs/                      # Design documentation (gitignored)
```

---

## 2. MONOREPO LÀ GÌ?

### 2.1 Định nghĩa

**Monorepo** (mono repository) là mô hình quản lý code trong đó **nhiều project/package cùng nằm trong một Git repository**, thay vì mỗi project một repo riêng (polyrepo).

```
# Polyrepo (truyền thống) — mỗi project 1 repo riêng
├── repo: sslm-api         → NestJS backend
├── repo: sslm-student      → Next.js student portal
├── repo: sslm-management   → Next.js management portal
├── repo: sslm-shared-types → TypeScript types
├── repo: sslm-shared-utils → Utilities
└── ... (6+ repos riêng lẻ)

# Monorepo — tất cả trong 1 repo
└── repo: smart-social-learning-marketplace
    ├── apps/api/
    ├── apps/student-portal/
    ├── apps/management-portal/
    ├── packages/shared-types/
    ├── packages/shared-utils/
    └── ...
```

### 2.2 Tại sao chọn Monorepo?

| Lợi ích                    | Giải thích                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| **Code sharing dễ dàng**   | `shared-types`, `shared-utils` dùng chung giữa frontend & backend mà không cần publish npm package |
| **Atomic changes**         | Thay đổi API response type → cập nhật cả backend + frontend trong 1 commit                         |
| **Consistent tooling**     | ESLint, Prettier, TypeScript config chung cho toàn bộ project                                      |
| **Single source of truth** | 1 repo, 1 CI/CD pipeline, 1 version history                                                        |
| **Dependency management**  | npm hoists shared dependencies lên root, tránh duplicate                                           |

### 2.3 Nhược điểm cần lưu ý

| Nhược điểm         | Cách giải quyết                                |
| ------------------ | ---------------------------------------------- |
| Repo lớn dần       | Turborepo cache — chỉ build/test phần thay đổi |
| CI chậm            | Turborepo remote caching + task filtering      |
| Phức tạp hơn setup | Đã setup xong ở phase này                      |

---

## 3. NPM WORKSPACES

### 3.1 Lý thuyết

**npm workspaces** là tính năng built-in của npm (từ v7+) cho phép quản lý nhiều packages trong 1 repo. Nó giải quyết 2 vấn đề chính:

1. **Dependency hoisting**: Dependencies chung được install 1 lần ở root `node_modules/`, các sub-packages tự động sử dụng qua symlink.
2. **Cross-package linking**: Package A có thể `import` từ package B mà không cần `npm publish`.

### 3.2 Cấu hình trong package.json

```json
{
  "workspaces": [
    "apps/*", // Tất cả folders trong apps/
    "packages/*" // Tất cả folders trong packages/
  ]
}
```

**Cách npm xử lý:**

1. npm quét `apps/*` và `packages/*`, tìm tất cả folder có `package.json`
2. Tạo symlink trong root `node_modules/` trỏ đến từng package
3. Hoist dependencies chung lên root `node_modules/`

```
node_modules/
├── react/                  ← Hoisted (dùng chung)
├── typescript/             ← Hoisted (dùng chung)
├── @nestjs/core/           ← Hoisted (chỉ api dùng, nhưng vẫn hoist)
├── @shared/types → symlink → ../../packages/shared-types/
├── @shared/utils → symlink → ../../packages/shared-utils/
└── ...
```

### 3.3 Cách import giữa các packages

```typescript
// Trong apps/student-portal/src/...
import { User, Role } from '@shared/types';
import { formatPrice } from '@shared/utils';

// npm tự biết @shared/types trỏ đến packages/shared-types/
// vì trong packages/shared-types/package.json có: "name": "@shared/types"
```

### 3.4 packageManager field

```json
{
  "packageManager": "npm@11.1.0"
}
```

**Mục đích:** Turborepo yêu cầu field này để biết dùng package manager nào. Nếu thiếu, `turbo build` sẽ báo lỗi không detect được workspace protocol.

---

## 4. TURBOREPO

### 4.1 Lý thuyết

**Turborepo** là build system cho JavaScript/TypeScript monorepos. Nó orchestrates (điều phối) các tasks (build, lint, test) trên nhiều packages, với 2 killer features:

1. **Intelligent caching**: Nếu code không đổi → dùng kết quả cache, không chạy lại
2. **Parallel execution**: Chạy tasks song song trên các packages không phụ thuộc nhau

### 4.2 File turbo.json giải thích

```json
{
  "$schema": "https://turbo.build/schema.json", // IDE autocomplete
  "tasks": {
    "dev": {
      "cache": false, // KHÔNG cache dev server (luôn chạy fresh)
      "persistent": true // Task chạy liên tục (không exit), ví dụ dev server
    },
    "build": {
      "dependsOn": ["^build"], // Build dependencies trước (ký hiệu ^ = topological)
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"] // Folders được cache
    },
    "lint": {
      "dependsOn": ["^lint"] // Lint dependencies trước
    },
    "clean": {
      "cache": false // Clean thì không cache
    },
    "test": {
      "cache": false // Test luôn chạy fresh
    }
  }
}
```

### 4.3 dependsOn: ["^build"] là gì?

Ký hiệu `^` = **topological dependency**. Nghĩa là: "Build tất cả packages mà package này phụ thuộc TRƯỚC, rồi mới build package này."

```
Thứ tự build khi chạy `turbo build`:

1. shared-types      (không phụ thuộc gì)     ← Build trước
2. shared-utils      (không phụ thuộc gì)     ← Build trước
3. shared-i18n       (không phụ thuộc gì)     ← Build trước
4. shared-hooks      (không phụ thuộc gì)     ← Build trước
5. shared-ui         (có thể phụ thuộc types) ← Build sau types
6. shared-api-client (có thể phụ thuộc types) ← Build sau types
7. api               (phụ thuộc types, utils) ← Build sau packages
8. student-portal    (phụ thuộc nhiều packages) ← Build cuối
9. management-portal (phụ thuộc nhiều packages) ← Build cuối
```

### 4.4 Scripts trong root package.json

```json
{
  "scripts": {
    "dev": "turbo dev", // Chạy dev server cho TẤT CẢ apps
    "build": "turbo build", // Build tất cả apps + packages
    "lint": "turbo lint", // Lint tất cả
    "clean": "turbo clean && rm -rf node_modules",
    "db:dev": "docker compose up -d", // Start Docker containers
    "db:stop": "docker compose down", // Stop Docker containers
    "db:reset": "docker compose down -v && docker compose up -d", // Reset DB data
    "prepare": "husky" // Auto-setup Git hooks khi npm install
  }
}
```

**Khi chạy `npm run dev`:**

1. npm gọi `turbo dev`
2. Turbo đọc `turbo.json`, thấy `dev` task có `persistent: true`
3. Turbo chạy song song:
   - `apps/api/` → `nest start --watch` (port 3000)
   - `apps/student-portal/` → `next dev --port 3001 --turbopack`
   - `apps/management-portal/` → `next dev --port 3002 --turbopack`
4. Tất cả 3 dev servers chạy đồng thời trong 1 terminal

---

## 5. FILE .editorconfig

### 5.1 Lý thuyết

**EditorConfig** là standard để đồng bộ coding style giữa các IDE/editors khác nhau (VSCode, WebStorm, Vim...). Khi mở project, IDE tự đọc `.editorconfig` và áp dụng settings.

### 5.2 Giải thích từng setting

```ini
root = true                        # Đây là file gốc, không tìm .editorconfig ở folder cha

[*]                                # Áp dụng cho TẤT CẢ file types
indent_style = space               # Dùng space, KHÔNG dùng tab
indent_size = 2                    # 2 spaces per indent (chuẩn JS/TS ecosystem)
end_of_line = lf                   # Line ending = LF (Unix style, không phải CRLF Windows)
charset = utf-8                    # UTF-8 encoding
trim_trailing_whitespace = true    # Xóa whitespace thừa cuối dòng
insert_final_newline = true        # Luôn có 1 dòng trống cuối file (chuẩn POSIX)

[*.md]                             # Riêng file Markdown
trim_trailing_whitespace = false   # Giữ trailing spaces (có ý nghĩa trong Markdown)

[*.{yml,yaml}]                     # Riêng YAML files
indent_size = 2                    # Explicitly 2 spaces

[Makefile]                         # Riêng Makefile
indent_style = tab                 # Makefile BẮT BUỘC dùng tab
```

### 5.3 Tại sao end_of_line = lf?

- **LF** (`\n`): Unix/macOS dùng
- **CRLF** (`\r\n`): Windows dùng
- Trong development, team thống nhất dùng **LF** để tránh diff noise (Git hiện "thay đổi" ở mọi dòng chỉ vì line ending khác nhau). Git trên Windows có config `core.autocrlf` để tự convert.

---

## 6. FILE .gitignore

### 6.1 Giải thích từng section

```gitignore
# Dependencies — node_modules rất nặng (hàng trăm MB), KHÔNG BAO GIỜ commit
node_modules/
.pnp
.pnp.js

# Build outputs — kết quả build, tái tạo được từ source code
dist/         # NestJS build output
build/        # Generic build output
.next/        # Next.js build output
out/          # Next.js static export
.turbo/       # Turborepo cache

# Documentation — docs riêng tư, không push GitHub
/docs         # "/" = chỉ match folder docs/ ở root, KHÔNG match sub-folders
CLAUDE.md     # AI instructions file

# Environment — chứa secrets (DB password, API keys)
.env
.env.local
.env.*.local

# IDE — settings cá nhân của từng developer
.vscode/settings.json
.idea/        # JetBrains IDE
*.swp         # Vim swap files
*.swo

# OS — file hệ điều hành tạo tự động
.DS_Store     # macOS
Thumbs.db     # Windows

# Docker volumes — data PostgreSQL/Redis local
pgdata/
redisdata/

# Misc
*.tsbuildinfo    # TypeScript incremental build cache
next-env.d.ts    # Next.js auto-generated type declarations
```

### 6.2 Lưu ý quan trọng

- `/docs` (có `/` đầu) = chỉ match `docs/` ở **root** directory
- `docs/` (không `/` đầu) = match `docs/` ở **BẤT KỲ** level nào
- `node_modules/` match ở mọi level (cả root và sub-packages)

---

## 7. FILE package.json (ROOT)

### 7.1 Các fields quan trọng

```json
{
  "name": "smart-social-learning-marketplace", // Tên project
  "version": "0.0.1", // Semantic versioning
  "private": true, // KHÔNG publish lên npm registry
  "type": "module" // Dùng ES Modules (import/export)
}
```

### 7.2 "type": "module" là gì?

Node.js có 2 module systems:

|              | CommonJS (CJS)              | ES Modules (ESM)                           |
| ------------ | --------------------------- | ------------------------------------------ |
| **Syntax**   | `const x = require('x')`    | `import x from 'x'`                        |
| **Export**   | `module.exports = x`        | `export default x`                         |
| **File ext** | `.js` (default) hoặc `.cjs` | `.mjs` hoặc `.js` (khi `"type": "module"`) |
| **Loading**  | Synchronous                 | Asynchronous                               |
| **Status**   | Legacy (vẫn phổ biến)       | Modern standard                            |

Khi đặt `"type": "module"`, tất cả `.js` files trong package sẽ được Node.js xử lý như ES Modules. Điều này cần thiết cho `commitlint.config.js` (sử dụng `export default`).

### 7.3 "private": true

Đảm bảo package này KHÔNG BAO GIỜ bị publish lên npm registry (dù vô tình chạy `npm publish`). Đây là best practice cho monorepo root và internal packages.

### 7.4 engines field

```json
{
  "engines": {
    "node": ">=22.0.0", // Yêu cầu Node.js 22+ (LTS hiện tại)
    "npm": ">=10.0.0" // Yêu cầu npm 10+
  }
}
```

Khi ai đó chạy `npm install` với Node < 22, npm sẽ cảnh báo version không phù hợp.

---

## 8. FILE package-lock.json

### 8.1 Lý thuyết

`package-lock.json` là **lock file** — nó ghi lại CHÍNH XÁC version của mọi dependency đã install.

**Tại sao cần?**

```json
// package.json nói:
"react": "^19.2.0"    // ^ = chấp nhận 19.2.0, 19.2.1, 19.3.0, ...

// package-lock.json ghi chính xác:
"react": "19.2.0"     // Đây là version THỰC TẾ đã install
```

Nếu không có lock file:

- Developer A install → được react 19.2.0
- Developer B install 2 tháng sau → được react 19.3.0 (version mới hơn)
- → Bug "chạy máy tui được, máy bạn không được" 😱

**Lock file đảm bảo:** Mọi người trong team + CI/CD server đều install ĐÚNG Y version đã test.

**Quy tắc:**

- ✅ LUÔN commit `package-lock.json`
- ❌ KHÔNG commit `node_modules/` (quá nặng, tái tạo từ lock file)
