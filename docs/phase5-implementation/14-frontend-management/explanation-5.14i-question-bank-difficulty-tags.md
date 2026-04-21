# Explanation 5.14i — Question Bank: Difficulty & Per-Bank Tags

## Problem Statement

Question bank items had no metadata — no difficulty level and no topic categorization. When an instructor has a bank with 100+ questions and wants to import specific ones into a quiz (e.g., "10 medium questions about Chapter 3"), there was no way to filter.

## Design Decision: Per-Bank Tags vs Global Tags

The system already has a global `Tag` model managed by admins (used for courses). The question was: should question bank items reference these global tags?

**Answer: No.** Global tags are wrong scope for question banks because:

1. **Admin-managed** — instructors can't create their own global tags
2. **Too broad** — global tags describe course topics ("React", "Node.js"), not internal bank topics ("Chapter 1", "Variables", "Loops")
3. **Wrong ownership** — a "JavaScript Basics" bank needs tags like "Functions", "Arrays" — these are bank-specific, not global concepts

**Chosen approach: `QuestionBankTag` model** — each bank has its own tag list, managed entirely by the instructor who owns the bank.

```
QuestionBank
  ├── QuestionBankTag[] ← instructor creates: "Chapter 1", "OOP", "Loops"
  └── QuestionBankItem[]
        ├── difficulty: CourseLevel?
        └── tagIds: String[] → references QuestionBankTag.id
```

## Why `tagIds: String[]` Instead of a Join Table?

Same pattern as `PlacementQuestion.tagIds`:

- Tags are per-bank (typically 5–15 per bank) — small set
- No complex relational queries needed — filtering is done client-side after fetching all questions
- Simpler schema — no `_QuestionBankItemToTag` join table
- Trade-off: no FK constraint, but `deleteTag` handles cleanup atomically via `array_remove`

## Why `difficulty` Reuses `CourseLevel` Enum?

`CourseLevel` already defines `BEGINNER | INTERMEDIATE | ADVANCED` — exactly what's needed for question difficulty. No new enum required. The field is nullable so existing questions remain valid without backfill.

## Tag Deletion & Orphan Cleanup

When a tag is deleted, its ID must be removed from all questions that reference it. This is done atomically in a transaction:

```typescript
await this.prisma.$transaction([
  this.prisma.questionBankTag.delete({ where: { id: tagId } }),
  this.prisma.$executeRaw`
    UPDATE question_bank_items
    SET tag_ids = array_remove(tag_ids, ${tagId})
    WHERE bank_id = ${bankId} AND ${tagId} = ANY(tag_ids)
  `,
]);
```

`array_remove` is a PostgreSQL function that removes all occurrences of a value from an array. The `ANY(tag_ids)` condition ensures only affected rows are updated.

## Import from Bank — Filter Flow

The import-from-bank dialog (used in quiz builder) now supports filtering:

1. Instructor selects a bank
2. Filters section appears — difficulty dropdown + bank tag chips
3. Filtered count shows `"X / Y questions match"`
4. Manual/random mode operates on the **filtered** set
5. Filters reset when switching banks

Tags for the filter come from the bank detail response (which now includes `tags` relation) — no extra API call needed.

## Import from Text — 2-Step Dialog

The bank detail page previously used the shared `ImportQuizDialog` (1-step: paste text → import). Now it uses a new `ImportBankTextDialog` (2-step):

1. **Step 1:** Paste text (same `parseQuizText()` parser)
2. **Step 2:** Assign difficulty + bank tags to all imported questions

This replaces `ImportQuizDialog` only in the bank detail page. The quiz builder still uses `ImportQuizDialog` directly (quiz questions don't have difficulty/tags).

## Bug Fix: Bank Count Display

The import-from-bank dialog showed `React (0)` instead of `React (9)` because it used `_count.questions` (Prisma relation count) but the bank list API returns `questionCount` (a denormalized field). Fixed by reading `questionCount` from the response.

## Files Changed

### Backend (6 files)
- **schema.prisma** — New `QuestionBankTag` model, `difficulty` + `tagIds` on `QuestionBankItem`, `tags` relation on `QuestionBank`
- **migration.sql** — CREATE TABLE + ALTER TABLE
- **bank-tag.dto.ts** — New: `CreateBankTagDto`, `UpdateBankTagDto`
- **create-bank-question.dto.ts** — Added optional `difficulty` (IsEnum) + `tagIds` (IsArray)
- **question-banks.service.ts** — Tag CRUD (getTags, createTag, updateTag, deleteTag), pass new fields in addQuestion/addQuestionsBatch/updateQuestion, include tags in findById
- **question-banks.controller.ts** — 4 new tag endpoints (GET/POST/PATCH/DELETE)

### Tests (1 file)
- **question-banks.service.spec.ts** — 25 tests: updated addQuestion/batch tests for difficulty+tagIds, new describe blocks for getTags/createTag/updateTag/deleteTag

### Shared (3 files)
- **question-bank.service.ts** — Updated `BankQuestionPayload` type, added tag API methods
- **use-question-banks.ts** — 3 new hooks: `useCreateBankTag`, `useUpdateBankTag`, `useDeleteBankTag`
- **index.ts** — Export new hooks

### Frontend (5 files)
- **[bankId]/page.tsx** — Tag management section (inline chip CRUD), difficulty+tags in question form, badges on question list
- **import-bank-text-dialog.tsx** — New: 2-step dialog (paste text → assign difficulty + tags)
- **import-from-bank-dialog.tsx** — Added filter section (difficulty + bank tags), fixed questionCount display bug
- **en.json** / **vi.json** — New i18n keys for tags, difficulty, filters

### Config (1 file)
- **tsconfig.json** — Added `"types": ["node", "jest"]` to fix IDE warnings on test files
