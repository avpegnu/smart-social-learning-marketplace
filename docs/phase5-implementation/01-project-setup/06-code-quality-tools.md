# 06 — Code Quality Tools (ESLint, Prettier, Husky, commitlint)

> Giải thích hệ thống đảm bảo chất lượng code: linting, formatting, git hooks, và commit conventions.

---

## 1. TỔNG QUAN — CODE QUALITY PIPELINE

```
Developer writes code
        │
        ▼
   ┌─────────┐
   │ ESLint   │  → Phát hiện lỗi logic, code patterns xấu
   └────┬─────┘
        │
        ▼
   ┌──────────┐
   │ Prettier  │  → Format code đồng nhất (indent, quotes, ...)
   └────┬──────┘
        │
        ▼
   git add & git commit
        │
        ▼
   ┌──────────┐
   │ Husky     │  → Trigger git hooks
   │ (pre-commit)│
   └────┬──────┘
        │
        ▼
   ┌────────────┐
   │ lint-staged │  → Chạy ESLint + Prettier CHỈ trên staged files
   └────┬────────┘
        │
        ▼
   ┌────────────┐
   │ commitlint  │  → Validate commit message format
   │ (commit-msg)│
   └────┬────────┘
        │
        ▼
   Commit thành công ✅
```

**Ý nghĩa:** Code xấu hoặc commit message sai format → **KHÔNG THỂ commit** → buộc developer sửa trước khi commit.

---

## 2. ESLINT — CODE LINTER

### 2.1 Linter là gì?

**Linter** phân tích source code mà KHÔNG chạy nó (static analysis), tìm:

- **Bugs tiềm ẩn**: Unused variables, unreachable code, type errors
- **Bad patterns**: `any` type, `console.log` trong production, missing error handling
- **Style issues**: Inconsistent naming, import order

```typescript
// ESLint sẽ BÁO LỖI cho code này:

const x = 5; // ❌ no-unused-vars: 'x' declared but never used
console.log('debug'); // ⚠️ no-console: Unexpected console statement
const data: any = {}; // ❌ no-explicit-any: Use 'unknown' instead
import type User from './types'; // ❌ consistent-type-imports: Use 'import type'
```

### 2.2 File eslint.config.mjs giải thích

```javascript
import js from '@eslint/js'; // ESLint core rules
import tseslint from 'typescript-eslint'; // TypeScript-specific rules
import eslintConfigPrettier from 'eslint-config-prettier'; // Tắt rules conflict Prettier

export default tseslint.config(
  // Layer 1: JavaScript recommended rules
  js.configs.recommended,
  // → no-undef, no-unused-vars, no-unreachable, ...

  // Layer 2: TypeScript recommended rules
  ...tseslint.configs.recommended,
  // → no-explicit-any, prefer-const, no-empty-function, ...

  // Layer 3: Prettier compatibility
  eslintConfigPrettier,
  // → TẮT tất cả ESLint rules về formatting (do Prettier đã handle)

  // Layer 4: Custom rules
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // → Error khi có unused vars, TRỪ vars bắt đầu bằng _
      // Ví dụ: const _unused = 5;  ← OK, không báo lỗi

      '@typescript-eslint/no-explicit-any': 'error',
      // → KHÔNG cho dùng 'any' type. Dùng 'unknown' thay thế.

      '@typescript-eslint/consistent-type-imports': 'error',
      // → Bắt buộc: import type { User } from './types'
      //   Thay vì: import { User } from './types' (nếu User là type)
      // Lý do: type imports bị strip khi compile → bundle nhỏ hơn

      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // → Warning khi dùng console.log() (quên xóa debug log)
      //   NHƯNG cho phép console.warn() và console.error()
    },
  },

  // Layer 5: Ignore patterns
  {
    ignores: ['node_modules/**', 'dist/**', '.next/**', 'build/**', 'coverage/**', '.turbo/**'],
    // → KHÔNG lint các folders này (build output, cache, dependencies)
  },
);
```

### 2.3 ESLint Flat Config (v9) vs Legacy Config

```
Legacy config (.eslintrc.js) — ESLint v8 trở về trước:
  module.exports = {
    extends: ['eslint:recommended'],
    plugins: ['@typescript-eslint'],
    rules: { ... }
  };
  → Phức tạp: extends, plugins, overrides, cascading config

Flat config (eslint.config.mjs) — ESLint v9+:
  export default [
    js.configs.recommended,
    { rules: { ... } }
  ];
  → Đơn giản: array of config objects, merged theo thứ tự
  → Là TƯƠNG LAI, legacy config sẽ bị deprecated
```

### 2.4 eslint-config-prettier — Tại sao cần?

**Vấn đề:** ESLint và Prettier đều có rules về formatting:

- ESLint: `indent: ['error', 2]` → 2 spaces
- Prettier: `tabWidth: 2` → 2 spaces
- Nếu conflict → file pass Prettier nhưng fail ESLint (hoặc ngược lại)

**Giải pháp:** `eslint-config-prettier` TẮT tất cả ESLint rules liên quan đến formatting → để Prettier lo hoàn toàn phần formatting, ESLint chỉ lo phần logic.

```
Phân chia trách nhiệm:
  ESLint   → Code QUALITY  (bugs, patterns, types)
  Prettier → Code STYLE    (indent, quotes, line width)
```

---

## 3. PRETTIER — CODE FORMATTER

### 3.1 Formatter là gì?

**Formatter** tự động format code theo rules đồng nhất. Developer KHÔNG CẦN nghĩ về:

- Dùng single quote hay double quote?
- Có trailing comma không?
- Indent bao nhiêu spaces?

Prettier quyết định tất cả → **zero debate about style**.

### 3.2 File .prettierrc giải thích

```json
{
  "semi": true, // Luôn có semicolon cuối statement
  // const x = 5;  ✅
  // const x = 5   ❌

  "trailingComma": "all", // Trailing comma ở mọi nơi
  // { a: 1, b: 2, }  ✅ (comma sau phần tử cuối)
  // Lợi ích: git diff sạch hơn khi thêm phần tử mới

  "singleQuote": true, // Dùng single quotes
  // import { User } from '@shared/types';  ✅
  // import { User } from "@shared/types";  ❌

  "printWidth": 100, // Max 100 chars/line
  // Dài hơn 100 → Prettier tự xuống dòng

  "tabWidth": 2, // 2 spaces per tab
  "useTabs": false, // Spaces, không tabs
  "bracketSpacing": true, // Spaces trong object braces
  // { a: 1 }  ✅
  // {a: 1}    ❌

  "arrowParens": "always", // Luôn có parentheses trong arrow function
  // (x) => x * 2   ✅
  // x => x * 2     ❌

  "endOfLine": "lf", // Unix line endings
  // Đồng bộ với .editorconfig

  "plugins": ["prettier-plugin-tailwindcss"]
  // Tự động sort Tailwind CSS classes theo official order
  // "p-4 flex mt-2" → "mt-2 flex p-4" (layout → spacing → sizing)
}
```

### 3.3 prettier-plugin-tailwindcss

Plugin này tự động sắp xếp Tailwind classes theo thứ tự chính thức:

```tsx
// Trước format:
<div className="p-4 flex text-white mt-2 bg-blue-500 items-center rounded-lg">

// Sau format (Prettier + tailwind plugin):
<div className="mt-2 flex items-center rounded-lg bg-blue-500 p-4 text-white">

// Thứ tự: layout → flexbox → spacing → sizing → typography → backgrounds → borders
```

**Lợi ích:** Team không cần tranh luận về thứ tự classes, dễ đọc và consistent.

### 3.4 File .prettierignore

```
node_modules        # Dependencies
dist                # Build output
.next               # Next.js build
build               # Generic build
coverage            # Test coverage
.turbo              # Turbo cache
pnpm-lock.yaml      # Lock files (auto-generated)
package-lock.json   # Lock files (auto-generated)
*.min.js            # Minified files
*.min.css           # Minified files
```

Prettier bỏ qua các files này vì:

- Generated files: format lại vô nghĩa
- Lock files: rất lớn, format chậm, và NPM tự quản lý
- Minified files: designed to be compact

---

## 4. HUSKY — GIT HOOKS

### 4.1 Git Hooks là gì?

**Git hooks** là scripts tự động chạy tại các thời điểm cụ thể trong Git workflow:

```
git commit
  │
  ├── pre-commit hook    → Chạy TRƯỚC khi commit tạo
  │   └── Nếu exit code ≠ 0 → ABORT commit
  │
  ├── prepare-commit-msg → Customize commit message
  │
  ├── commit-msg hook    → Validate commit message
  │   └── Nếu exit code ≠ 0 → ABORT commit
  │
  └── post-commit        → Sau khi commit thành công
```

### 4.2 Husky là gì?

**Husky** giúp cài đặt Git hooks dễ dàng:

- Hooks được lưu trong `.husky/` folder → commit vào Git → team member nào cũng có
- Khi `npm install` → Husky tự động install hooks (qua `prepare` script)

```json
// package.json
{
  "scripts": {
    "prepare": "husky" // npm install → husky init → install git hooks
  }
}
```

### 4.3 pre-commit hook

```bash
# .husky/pre-commit
npx lint-staged
```

**Khi `git commit`:**

1. Git trigger `pre-commit` hook
2. Hook chạy `npx lint-staged`
3. lint-staged xử lý (xem section 5)
4. Nếu lint-staged fail → commit bị ABORT
5. Nếu lint-staged pass → tiếp tục commit

### 4.4 commit-msg hook

```bash
# .husky/commit-msg
npx --no-install commitlint --edit "$1"
```

**Khi `git commit -m "message"`:**

1. Git tạo temp file chứa commit message
2. Git trigger `commit-msg` hook, truyền path file vào `$1`
3. commitlint đọc message, validate theo rules
4. Nếu message sai format → commit bị ABORT
5. Nếu message đúng → commit thành công

`--no-install`: Không tự install commitlint nếu chưa có (dùng version đã install).

---

## 5. LINT-STAGED — CHỈ LINT FILES ĐÃ STAGED

### 5.1 Vấn đề

Chạy ESLint + Prettier trên TOÀN BỘ codebase mỗi lần commit:

- Chậm (hàng trăm files)
- Lint cả files người khác viết
- Không cần thiết — chỉ cần check files MÌNH ĐANG THAY ĐỔI

### 5.2 Giải pháp: lint-staged

**lint-staged** chỉ chạy linters trên files đã `git add` (staged):

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      // TypeScript files
      "eslint --fix", // 1. Auto-fix ESLint issues
      "prettier --write" // 2. Auto-format với Prettier
    ],
    "*.{json,css,md,yml,yaml}": [
      // Non-code files
      "prettier --write" // Chỉ format (không lint)
    ]
  }
}
```

### 5.3 Flow chi tiết

```
1. Developer sửa 3 files:
   - src/components/Button.tsx     (modified)
   - src/utils/format.ts          (modified)
   - README.md                    (modified)

2. git add src/components/Button.tsx src/utils/format.ts
   (chỉ stage 2 files TypeScript, chưa stage README)

3. git commit -m "feat(ui): add button component"

4. pre-commit hook → lint-staged chạy:
   a. Button.tsx matches "*.{ts,tsx}":
      → eslint --fix Button.tsx
      → prettier --write Button.tsx
   b. format.ts matches "*.{ts,tsx}":
      → eslint --fix format.ts
      → prettier --write format.ts
   c. README.md: KHÔNG xử lý (chưa staged)

5. Nếu ESLint phát hiện error không auto-fix được → ABORT commit
   Nếu tất cả pass → tiếp tục đến commit-msg hook
```

### 5.4 --fix và --write

```
eslint --fix:      Tự sửa được một số lỗi (unused imports, missing semicolons)
                   Lỗi logic (no-explicit-any) → KHÔNG tự sửa → báo error → abort

prettier --write:  Tự format file và ghi lại
                   Luôn thành công (Prettier không bao giờ fail)
```

---

## 6. COMMITLINT — COMMIT MESSAGE CONVENTION

### 6.1 Conventional Commits là gì?

**Conventional Commits** là specification cho commit messages:

```
<type>(<scope>): <description>

Examples:
  feat(api): add course enrollment endpoint
  fix(student): resolve dark mode flash on page load
  refactor(shared): extract price formatting to shared-utils
  chore(config): update ESLint rules for import order
  docs(api): add swagger documentation for auth endpoints
```

### 6.2 Tại sao cần convention?

```
❌ Commit messages không có convention:
  "fix bug"
  "update stuff"
  "WIP"
  "asdfasdf"
  "Monday changes"

✅ Conventional Commits:
  "fix(student): resolve video player crash on mobile Safari"
  "feat(api): add real-time notification via WebSocket"
  "refactor(shared): migrate formatPrice to Intl.NumberFormat"

Lợi ích:
  1. Git history dễ đọc, dễ tìm
  2. Tự động generate CHANGELOG
  3. Semantic versioning automation
  4. Dễ review: biết ngay commit làm gì
```

### 6.3 File commitlint.config.js giải thích

```javascript
export default {
  extends: ['@commitlint/config-conventional'], // Base rules

  rules: {
    // Type phải là 1 trong danh sách này (severity: error)
    'type-enum': [
      2, // 2 = error (0=disable, 1=warning, 2=error)
      'always', // Luôn kiểm tra
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation changes
        'style', // Code style (formatting, no logic change)
        'refactor', // Code restructuring (no feature/fix)
        'perf', // Performance improvement
        'test', // Adding/updating tests
        'chore', // Maintenance (deps, config, scripts)
        'ci', // CI/CD changes
        'build', // Build system changes
        'revert', // Revert previous commit
      ],
    ],

    // Scope nên là 1 trong danh sách (severity: warning)
    'scope-enum': [
      1, // 1 = warning (không block commit)
      'always',
      [
        'api', // Backend
        'student', // Student portal
        'management', // Management portal
        'shared', // Shared packages
        'types', // @shared/types
        'ui', // @shared/ui
        'utils', // @shared/utils
        'hooks', // @shared/hooks
        'i18n', // @shared/i18n
        'api-client', // @shared/api-client
        'prisma', // Database schema
        'config', // Configuration files
        'docker', // Docker setup
        'deps', // Dependencies update
      ],
    ],

    // Subject phải lowercase
    'subject-case': [2, 'always', 'lower-case'],
    // ✅ "add user authentication"
    // ❌ "Add User Authentication"

    // Subject tối đa 100 ký tự
    'subject-max-length': [2, 'always', 100],

    // Body tối đa 200 ký tự/dòng (warning)
    'body-max-line-length': [1, 'always', 200],
  },
};
```

### 6.4 Ví dụ commit messages

```bash
# ✅ Hợp lệ:
git commit -m "feat(api): add course enrollment endpoint"
git commit -m "fix(student): resolve dark mode flash on page load"
git commit -m "chore(deps): update NestJS to v11.2"
git commit -m "refactor(shared): extract common types to shared-types"

# ❌ Không hợp lệ:
git commit -m "Fix bug"                    # Missing type format
git commit -m "feat: Add login"            # subject-case: "Add" is uppercase
git commit -m "feature(api): add login"    # "feature" not in type-enum
git commit -m "feat(api): add very long description that exceeds one hundred characters limit which is set in our commitlint configuration file"
                                           # subject-max-length exceeded
```

### 6.5 Commit Types chi tiết

| Type       | Khi nào dùng                          | Ví dụ                                           |
| ---------- | ------------------------------------- | ----------------------------------------------- |
| `feat`     | Thêm tính năng MỚI cho user           | `feat(api): add course search with filters`     |
| `fix`      | Sửa bug                               | `fix(student): resolve infinite scroll loading` |
| `refactor` | Thay đổi code KHÔNG thay đổi behavior | `refactor(api): extract auth logic to guard`    |
| `docs`     | Chỉ thay đổi documentation            | `docs(api): add swagger tags for courses`       |
| `style`    | Formatting, whitespace (không logic)  | `style(shared): apply prettier formatting`      |
| `perf`     | Cải thiện performance                 | `perf(api): add Redis caching for course list`  |
| `test`     | Thêm/sửa tests                        | `test(api): add unit tests for auth service`    |
| `chore`    | Maintenance, config, deps             | `chore(deps): update React to 19.2`             |
| `ci`       | CI/CD pipeline changes                | `ci: add GitHub Actions workflow`               |
| `build`    | Build system changes                  | `build(docker): optimize Dockerfile layers`     |
| `revert`   | Revert commit trước                   | `revert: revert "feat(api): add course search"` |

---

## 7. FLOW TỔNG HỢP — TỪ CODE ĐẾN COMMIT

```
Step 1: Developer viết code
  └── VSCode: ESLint plugin hiện real-time errors (red underlines)
  └── VSCode: Prettier format on save (auto-fix style issues)

Step 2: Developer chạy lint (optional)
  └── npm run lint → turbo lint → ESLint check toàn bộ codebase

Step 3: git add changed-files
  └── Stage files cho commit

Step 4: git commit -m "feat(api): add user registration"
  │
  ├── [pre-commit hook] → Husky trigger
  │   └── lint-staged runs:
  │       ├── ESLint --fix on *.{ts,tsx} staged files
  │       │   ├── Auto-fix: unused imports, missing semicolons
  │       │   └── Cannot fix: any type, missing return type → ERROR → ABORT
  │       └── Prettier --write on all staged files
  │           └── Auto-format and re-stage
  │
  ├── [commit-msg hook] → Husky trigger
  │   └── commitlint validates message format:
  │       ├── Type "feat" ∈ type-enum? ✅
  │       ├── Scope "api" ∈ scope-enum? ✅
  │       ├── Subject "add user registration" lowercase? ✅
  │       ├── Subject length ≤ 100? ✅
  │       └── All pass → CONTINUE
  │
  └── Commit created ✅

Step 5: Review git log
  └── Clean, consistent commit history
  └── Easy to understand what changed and why
```

---

## 8. TÓM TẮT TOOLS

| Tool             | File config            | Mục đích                              | Thời điểm chạy             |
| ---------------- | ---------------------- | ------------------------------------- | -------------------------- |
| **ESLint**       | `eslint.config.mjs`    | Phát hiện bugs, enforce code patterns | IDE real-time + pre-commit |
| **Prettier**     | `.prettierrc`          | Format code đồng nhất                 | IDE on-save + pre-commit   |
| **Husky**        | `.husky/`              | Install & manage Git hooks            | `npm install` (auto)       |
| **lint-staged**  | `package.json`         | Run linters on staged files only      | pre-commit hook            |
| **commitlint**   | `commitlint.config.js` | Validate commit messages              | commit-msg hook            |
| **EditorConfig** | `.editorconfig`        | Đồng bộ editor settings               | IDE (always)               |
