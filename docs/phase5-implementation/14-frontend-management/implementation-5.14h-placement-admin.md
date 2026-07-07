# Implementation 5.14h — Placement Questions Admin + Fixes

> Admin CRUD cho placement questions + fix balanced selection + upsert result + import from text.

---

## 1. TỔNG QUAN

### 1.1 Mục tiêu

- Admin quản lý placement questions: CRUD, search, filter by level, sort, pagination
- Fix placement test logic: balanced 5/5/5 selection thay vì random, upsert thay vì create
- Seed data: 65 placement questions cho 5 lĩnh vực
- Student portal: fix auth flow — require login trước khi start test
- Import from text: cho phép admin paste text nhanh để tạo nhiều câu hỏi

### 1.2 Phạm vi

| Layer | Files | Nội dung |
|-------|-------|----------|
| Database | 2 files | Schema unique constraint + migration |
| Backend | 4 files | DTO, service (CRUD + batch), controller (5 endpoints) |
| Shared | 3 files | admin service, use-admin hooks, index exports |
| Management | 5 files | Page, import dialog, sidebar, breadcrumb, i18n (en + vi) |
| Student | 3 files | Page auth fix, deleted login-prompt, i18n cleanup |
| Seed | 1 file | seed-placement.ts (65 questions) |

---

## 2. DATABASE CHANGES

### 2.1 Schema — PlacementTest unique userId

```prisma
model PlacementTest {
  ...
  @@unique([userId])   // was @@index([userId])
  @@map("placement_tests")
}
```

**Lý do:** Mỗi user chỉ giữ 1 kết quả placement test (upsert pattern).

### 2.2 Migration

**File:** `apps/api/src/prisma/migrations/20260330120000_placement_test_unique_user/migration.sql`

```sql
DROP INDEX IF EXISTS "placement_tests_user_id_idx";
CREATE UNIQUE INDEX "placement_tests_user_id_key" ON "placement_tests"("user_id");
```

---

## 3. BACKEND CHANGES

### 3.1 Placement Test Service — Balanced Selection

**File:** `apps/api/src/modules/learning/placement-tests/placement-tests.service.ts`

**Trước:** Fisher-Yates shuffle all → take 15 (có thể 10 BEGINNER + 5 INTERMEDIATE + 0 ADVANCED)

**Sau:**
1. Group questions by level (BEGINNER, INTERMEDIATE, ADVANCED)
2. Shuffle mỗi group riêng
3. Pick 5 từ mỗi level
4. Nếu level nào < 5, fill từ leftover của các level khác
5. Final shuffle toàn bộ 15 câu

### 3.2 Placement Test Service — Upsert

**Trước:** `prisma.placementTest.create(...)` — mỗi lần tạo record mới

**Sau:** `prisma.placementTest.upsert({ where: { userId }, ... })` — ghi đè kết quả cũ

### 3.3 Admin Content — Placement Questions CRUD

**DTO:** `apps/api/src/modules/admin/dto/create-placement-question.dto.ts`
- question (string, min 5), options (PlacementOptionDto[], min 2), answer (string), level (enum), tagIds (string[], min 1)

**Service methods:**
- `getPlacementQuestions(query)` — paginated, search, level filter, sort (createdAt/level), order (asc/desc)
- `createPlacementQuestion(dto)` — single create
- `updatePlacementQuestion(id, dto)` — partial update
- `deletePlacementQuestion(id)` — delete
- `createPlacementQuestionsBatch(items)` — batch create in transaction

**Controller endpoints:**
- `GET /admin/placement-questions` — list with query params
- `POST /admin/placement-questions` — single create
- `POST /admin/placement-questions/batch` — batch create
- `PATCH /admin/placement-questions/:id` — update
- `DELETE /admin/placement-questions/:id` — delete

---

## 4. FRONTEND — MANAGEMENT PORTAL

### 4.1 Admin Placement Questions Page

**File:** `apps/management-portal/src/app/[locale]/admin/placement-questions/page.tsx`

**Features:**
- Debounced search input
- Level filter dropdown (All/Beginner/Intermediate/Advanced)
- Sort dropdown (Newest/Oldest/By level)
- Server-side pagination (15 items/page)
- DataTable: question text + tags, level badge, options (correct highlighted), edit/delete actions
- Create/Edit modal via ReactDOM.createPortal
- Delete confirmation via ConfirmDialog
- "Import from Text" button → ImportTextDialog

### 4.2 Import Text Dialog

**File:** `apps/management-portal/src/components/placement/import-text-dialog.tsx`

**2-step wizard:**
1. **Paste text** — same format as quiz import (numbered, `a)` `b)`, `*` for correct)
2. **Assign level + tags** — single level + tag chips for all imported questions

Uses existing `parseQuizText()` from `@/lib/validations/course` → converts to placement format.

### 4.3 Sidebar + Breadcrumb

- Sidebar: added `placementQuestions` nav item with ClipboardCheck icon
- Breadcrumb: added labels for `tags`, `placement-questions`, `question-banks`

---

## 5. FRONTEND — STUDENT PORTAL

### 5.1 Auth Flow Fix

**Trước:** User làm hết test → bấm Submit → modal login → login → redirect landing (mất state)

**Sau:** User bấm Start → nếu chưa login → redirect `/login?redirect=/placement-test`

**Deleted:** `apps/student-portal/src/components/placement/login-prompt.tsx`

---

## 6. SEED DATA

**File:** `apps/api/src/prisma/seed-placement.ts`

- 65 questions: Web Dev (15), Data Science (15), Mobile (15), DevOps (15), General (5)
- Mỗi domain: 5 BEGINNER + 5 INTERMEDIATE + 5 ADVANCED
- Maps tag slugs → IDs at runtime
- Idempotent: skip duplicates on re-run
- Run: `npx ts-node -O '{"module":"CommonJS"}' src/prisma/seed-placement.ts`

---

## 7. TESTS

### 7.1 Placement Tests Service (8 tests)

| Test | Description |
|------|-------------|
| startTest — no answers | Questions returned without answer field |
| startTest — balanced 5/5/5 | Exactly 5 per level when enough questions |
| startTest — fill from leftover | Fills remaining from other levels when one has < 5 |
| startTest — fewer than 15 | Returns all when total < 15 |
| startTest — category filter | Filters by category tags with hasSome |
| submitTest — BEGINNER | Grades correctly, recommends BEGINNER |
| submitTest — ADVANCED | Recommends ADVANCED when score >= 70% |
| submitTest — upsert | Uses upsert (not create), checks where/update/create args |

### 7.2 Admin Content Service — Placement (7 tests)

| Test | Description |
|------|-------------|
| getPlacementQuestions — paginated | Returns paginated result |
| getPlacementQuestions — search | Filters by question text |
| getPlacementQuestions — level | Filters by level |
| getPlacementQuestions — sort | Sorts by specified field |
| createPlacementQuestion | Creates with correct data |
| updatePlacementQuestion | Updates specified fields only |
| deletePlacementQuestion | Deletes by id |
| createPlacementQuestionsBatch | Creates multiple in $transaction |

---

## 8. I18N

### Management Portal

**Namespace `nav`:** Added `placementQuestions`

**Namespace `placementQuestions`:** 43+ keys cho CRUD page + import text dialog

### Student Portal

**Namespace `placementTest`:** Removed 4 unused login prompt keys

---

## 9. COMMITS

1. `feat(api): add placement seed data and fix balanced selection` — seed file, balanced 5/5/5, upsert, schema unique, migration
2. `fix(student): require login before starting placement test` — auth flow fix, delete login-prompt, i18n cleanup
3. `feat(management): add admin placement questions management` — page, sidebar, hooks, service, controller, i18n
4. `feat(management): add import from text for placement questions` — import dialog, batch endpoint, breadcrumb labels

---

## 10. FILES TỔNG QUAN

| Commit | Created | Modified | Deleted |
|--------|---------|----------|---------|
| 1. Seed + fix | 2 | 3 | 0 |
| 2. Auth flow | 0 | 3 | 1 |
| 3. Admin CRUD | 3 | 6 | 0 |
| 4. Import text | 1 | 5 | 0 |
| **Total** | **6** | **~17** | **1** |
