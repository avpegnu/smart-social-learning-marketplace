# Implementation 5.14i — Question Bank: Difficulty & Per-Bank Tags

## Overview

Add `difficulty` (enum) and per-bank tags to `QuestionBankItem`. Instead of referencing global admin-managed `Tag`, introduce a new `QuestionBankTag` model scoped to each bank — so instructors can create their own topic labels (e.g. "Chapter 1", "OOP", "Loops") independently. Update all CRUD flows and the "Import from Bank" dialog to support filtering.

---

## Design Decision: Per-Bank Tags vs Global Tags

| Approach | Pros | Cons |
|----------|------|------|
| **Global `Tag`** (admin-managed) | Simple, no new model | Wrong scope — instructor depends on admin, tags too broad |
| **Per-bank `QuestionBankTag`** | Correct scope, instructor self-managed, bank-specific context | New model + CRUD |

**Chosen: Per-bank tags.** Each bank has its own tag list. An instructor teaching "JavaScript Basics" creates tags like "Variables", "Functions", "Async" — completely independent from a "React Advanced" bank.

---

## Scope of Changes

| Layer | Files | What Changes |
|-------|-------|--------------|
| **Schema** | `schema.prisma` | New `QuestionBankTag` model, add `difficulty` + `tagIds` to `QuestionBankItem`, add `tags` relation to `QuestionBank` |
| **Migration** | `migrations/xxx/migration.sql` | CREATE TABLE + ALTER TABLE |
| **Backend DTO** | `create-bank-question.dto.ts`, new `bank-tag.dto.ts` | Question: add `difficulty` + `tagIds`. Tag: create/update DTOs |
| **Backend Service** | `question-banks.service.ts` | Tag CRUD methods, pass new fields in question create/update |
| **Backend Controller** | `question-banks.controller.ts` | 3 new tag endpoints |
| **Backend Tests** | `question-banks.service.spec.ts` | Update + new tests for difficulty/tags |
| **Shared Hooks** | `question-bank.service.ts`, `use-question-banks.ts` | New tag service methods + hooks, update payload type |
| **Frontend — Bank Detail** | `[bankId]/page.tsx` | Tag management section, difficulty/tags in question form + display |
| **Frontend — Import Text** | new `import-bank-text-dialog.tsx` | 2-step: paste text → assign difficulty + bank tags |
| **Frontend — Import from Bank** | `import-from-bank-dialog.tsx` | Difficulty + tag filters |
| **i18n** | `en.json`, `vi.json` | New keys |

---

## Step 1: Prisma Schema

### File: `apps/api/src/prisma/schema.prisma`

### 1a. New `QuestionBankTag` model (after `QuestionBank`)

```prisma
model QuestionBankTag {
  id     String @id @default(cuid())
  bankId String @map("bank_id")
  name   String

  bank QuestionBank @relation(fields: [bankId], references: [id], onDelete: Cascade)

  @@unique([bankId, name])
  @@index([bankId])
  @@map("question_bank_tags")
}
```

**Key points:**
- `@@unique([bankId, name])` — no duplicate tag names within the same bank
- Cascade delete — when bank is deleted, its tags are also deleted
- No `color` or `slug` — keep it minimal, just a name label

### 1b. Add `tags` relation to `QuestionBank`

```prisma
model QuestionBank {
  // ... existing fields ...
  
  instructor User               @relation(fields: [instructorId], references: [id], onDelete: Cascade)
  questions  QuestionBankItem[]
  tags       QuestionBankTag[]   // NEW

  @@index([instructorId])
  @@map("question_banks")
}
```

### 1c. Add `difficulty` + `tagIds` to `QuestionBankItem`

```prisma
model QuestionBankItem {
  id          String       @id @default(cuid())
  bankId      String       @map("bank_id")
  question    String
  explanation String?
  order       Int          @default(0)
  difficulty  CourseLevel?                                  // NEW
  tagIds      String[]     @default([]) @map("tag_ids")    // NEW — refs QuestionBankTag.id
  createdAt   DateTime     @default(now()) @map("created_at")

  bank    QuestionBank           @relation(fields: [bankId], references: [id], onDelete: Cascade)
  options QuestionBankOption[]

  @@index([bankId])
  @@map("question_bank_items")
}
```

**Why `tagIds: String[]` instead of a join table?**
- Same proven pattern as `PlacementQuestion.tagIds`
- Tags are scoped to a bank (small set, typically 5–15)
- No need for complex relational queries — just client-side filtering
- Simpler schema, fewer tables

### 1d. Migration SQL

```sql
-- CreateTable: question_bank_tags
CREATE TABLE "question_bank_tags" (
    "id" TEXT NOT NULL,
    "bank_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "question_bank_tags_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "question_bank_tags_bank_id_idx" ON "question_bank_tags"("bank_id");
CREATE UNIQUE INDEX "question_bank_tags_bank_id_name_key" ON "question_bank_tags"("bank_id", "name");

ALTER TABLE "question_bank_tags" ADD CONSTRAINT "question_bank_tags_bank_id_fkey"
    FOREIGN KEY ("bank_id") REFERENCES "question_banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: question_bank_items — add difficulty + tag_ids
ALTER TABLE "question_bank_items" ADD COLUMN "difficulty" "CourseLevel";
ALTER TABLE "question_bank_items" ADD COLUMN "tag_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
```

---

## Step 2: Backend DTOs

### 2a. New file: `apps/api/src/modules/question-banks/dto/bank-tag.dto.ts`

```typescript
import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateBankTagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;
}

export class UpdateBankTagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;
}
```

### 2b. Update: `apps/api/src/modules/question-banks/dto/create-bank-question.dto.ts`

Add to `CreateBankQuestionDto`:

```typescript
import { CourseLevel } from '@prisma/client';

// ... existing BankOptionDto unchanged ...

export class CreateBankQuestionDto {
  @IsString()
  @MinLength(3)
  question!: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()                          // NEW
  @IsEnum(CourseLevel)                   // NEW
  difficulty?: CourseLevel;              // NEW

  @IsOptional()                          // NEW
  @IsArray()                             // NEW
  @IsString({ each: true })             // NEW
  tagIds?: string[];                     // NEW

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => BankOptionDto)
  options!: BankOptionDto[];
}
```

Both fields optional — fully backward-compatible.

---

## Step 3: Backend Service

### File: `apps/api/src/modules/question-banks/question-banks.service.ts`

### 3a. Tag CRUD methods (add to service)

```typescript
// ── Bank Tag CRUD ──

async getTags(bankId: string, instructorId: string) {
  await this.verifyOwnership(bankId, instructorId);
  return this.prisma.questionBankTag.findMany({
    where: { bankId },
    orderBy: { name: 'asc' },
  });
}

async createTag(bankId: string, instructorId: string, dto: CreateBankTagDto) {
  await this.verifyOwnership(bankId, instructorId);
  return this.prisma.questionBankTag.create({
    data: { bankId, name: dto.name.trim() },
  });
}

async updateTag(bankId: string, tagId: string, instructorId: string, dto: UpdateBankTagDto) {
  await this.verifyOwnership(bankId, instructorId);
  const tag = await this.prisma.questionBankTag.findFirst({
    where: { id: tagId, bankId },
  });
  if (!tag) throw new NotFoundException({ code: 'BANK_TAG_NOT_FOUND' });
  return this.prisma.questionBankTag.update({
    where: { id: tagId },
    data: { name: dto.name.trim() },
  });
}

async deleteTag(bankId: string, tagId: string, instructorId: string) {
  await this.verifyOwnership(bankId, instructorId);
  const tag = await this.prisma.questionBankTag.findFirst({
    where: { id: tagId, bankId },
  });
  if (!tag) throw new NotFoundException({ code: 'BANK_TAG_NOT_FOUND' });

  // Remove tagId from all questions that reference it
  await this.prisma.$transaction([
    this.prisma.questionBankTag.delete({ where: { id: tagId } }),
    this.prisma.$executeRaw`
      UPDATE question_bank_items
      SET tag_ids = array_remove(tag_ids, ${tagId})
      WHERE bank_id = ${bankId} AND ${tagId} = ANY(tag_ids)
    `,
  ]);
}
```

**Important:** `deleteTag` also cleans up `tagIds` arrays on questions — no orphaned references.

### 3b. Update `findById` — include tags

```typescript
async findById(bankId: string, instructorId: string) {
  const bank = await this.prisma.questionBank.findUnique({
    where: { id: bankId },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        include: { options: { orderBy: { order: 'asc' } } },
      },
      tags: { orderBy: { name: 'asc' } },   // NEW
    },
  });
  // ... existing ownership check ...
}
```

### 3c. Update `addQuestion` — pass difficulty + tagIds

```typescript
const question = await tx.questionBankItem.create({
  data: {
    bankId,
    question: dto.question,
    explanation: dto.explanation,
    difficulty: dto.difficulty ?? null,     // NEW
    tagIds: dto.tagIds ?? [],              // NEW
    order: (lastQuestion?.order ?? -1) + 1,
    options: {
      create: dto.options.map((opt, i) => ({
        text: opt.text,
        isCorrect: opt.isCorrect,
        order: i,
      })),
    },
  },
  include: { options: true },
});
```

### 3d. Update `addQuestionsBatch` — same change in loop

```typescript
data: {
  bankId,
  question: dto.question,
  explanation: dto.explanation,
  difficulty: dto.difficulty ?? null,     // NEW
  tagIds: dto.tagIds ?? [],              // NEW
  order: nextOrder++,
  options: { create: ... },
}
```

### 3e. Update `updateQuestion` — pass new fields

```typescript
data: {
  question: dto.question,
  explanation: dto.explanation,
  difficulty: dto.difficulty ?? null,     // NEW
  tagIds: dto.tagIds ?? [],              // NEW
  options: { create: ... },
}
```

---

## Step 4: Backend Controller

### File: `apps/api/src/modules/question-banks/question-banks.controller.ts`

Add 3 new tag endpoints (group them together after bank CRUD, before question CRUD):

```typescript
// ── Bank Tags ──

@Get(':id/tags')
@ApiOperation({ summary: 'List tags for a question bank' })
async getTags(
  @Param('id', ParseCuidPipe) id: string,
  @CurrentUser() user: JwtPayload,
) {
  return this.service.getTags(id, user.sub);
}

@Post(':id/tags')
@ApiOperation({ summary: 'Create a tag in a question bank' })
async createTag(
  @Param('id', ParseCuidPipe) id: string,
  @CurrentUser() user: JwtPayload,
  @Body() dto: CreateBankTagDto,
) {
  return this.service.createTag(id, user.sub, dto);
}

@Delete(':id/tags/:tagId')
@ApiOperation({ summary: 'Delete a tag from a question bank' })
async deleteTag(
  @Param('id', ParseCuidPipe) id: string,
  @Param('tagId', ParseCuidPipe) tagId: string,
  @CurrentUser() user: JwtPayload,
) {
  await this.service.deleteTag(id, tagId, user.sub);
  return { message: 'Tag deleted' };
}
```

**Note:** No `PATCH` tag endpoint — rename is an edge case. If needed, delete + create is sufficient for v1. Keep the API surface minimal.

Actually, include update for completeness since renaming a tag is a common action:

```typescript
@Patch(':id/tags/:tagId')
@ApiOperation({ summary: 'Update a tag in a question bank' })
async updateTag(
  @Param('id', ParseCuidPipe) id: string,
  @Param('tagId', ParseCuidPipe) tagId: string,
  @CurrentUser() user: JwtPayload,
  @Body() dto: UpdateBankTagDto,
) {
  return this.service.updateTag(id, tagId, user.sub, dto);
}
```

---

## Step 5: Backend Tests

### File: `apps/api/src/modules/question-banks/question-banks.service.spec.ts`

### 5a. Add `questionBankTag` + `$executeRaw` to mock prisma

```typescript
const prisma = {
  // ... existing mocks ...
  questionBankTag: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $executeRaw: jest.fn(),
};
```

### 5b. Update existing `addQuestion` test — include difficulty + tagIds

```typescript
const dto = {
  question: 'What is JS?',
  explanation: 'JavaScript',
  difficulty: 'INTERMEDIATE',
  tagIds: ['tag1', 'tag2'],
  options: [
    { text: 'A language', isCorrect: true },
    { text: 'A framework', isCorrect: false },
  ],
};
```

Verify `tx.questionBankItem.create` is called with `difficulty: 'INTERMEDIATE'` and `tagIds: ['tag1', 'tag2']`.

### 5c. Add test: "should default difficulty to null and tagIds to [] when not provided"

```typescript
const dto = {
  question: 'What is JS?',
  options: [
    { text: 'A language', isCorrect: true },
    { text: 'A framework', isCorrect: false },
  ],
};
// Verify create called with difficulty: null, tagIds: []
```

### 5d. Update `addQuestionsBatch` test — include difficulty + tagIds

### 5e. New describe block: `'Bank Tags'`

```typescript
describe('getTags', () => {
  it('should return tags for bank', async () => {
    prisma.questionBank.findUnique.mockResolvedValue({ instructorId: 'inst1' });
    prisma.questionBankTag.findMany.mockResolvedValue([
      { id: 't1', bankId: 'qb1', name: 'Chapter 1' },
    ]);
    const result = await service.getTags('qb1', 'inst1');
    expect(result).toHaveLength(1);
  });
});

describe('createTag', () => {
  it('should create tag', async () => {
    prisma.questionBank.findUnique.mockResolvedValue({ instructorId: 'inst1' });
    prisma.questionBankTag.create.mockResolvedValue({
      id: 't1', bankId: 'qb1', name: 'Chapter 1',
    });
    const result = await service.createTag('qb1', 'inst1', { name: 'Chapter 1' });
    expect(result.name).toBe('Chapter 1');
  });

  it('should throw if not bank owner', async () => {
    prisma.questionBank.findUnique.mockResolvedValue({ instructorId: 'other' });
    await expect(service.createTag('qb1', 'inst1', { name: 'X' }))
      .rejects.toThrow(ForbiddenException);
  });
});

describe('deleteTag', () => {
  it('should delete tag and clean up tagIds on questions', async () => {
    prisma.questionBank.findUnique.mockResolvedValue({ instructorId: 'inst1' });
    prisma.questionBankTag.findFirst.mockResolvedValue({ id: 't1' });
    prisma.$transaction.mockResolvedValue([]);

    await service.deleteTag('qb1', 't1', 'inst1');
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('should throw if tag not found', async () => {
    prisma.questionBank.findUnique.mockResolvedValue({ instructorId: 'inst1' });
    prisma.questionBankTag.findFirst.mockResolvedValue(null);
    await expect(service.deleteTag('qb1', 't1', 'inst1'))
      .rejects.toThrow(NotFoundException);
  });
});
```

---

## Step 6: Shared Hooks

### 6a. File: `packages/shared-hooks/src/services/question-bank.service.ts`

Update `BankQuestionPayload` and add tag service methods:

```typescript
export interface BankQuestionPayload {
  question: string;
  explanation?: string;
  difficulty?: string;     // NEW
  tagIds?: string[];       // NEW
  options: Array<{ text: string; isCorrect: boolean }>;
}

// NEW — Bank Tag methods
export const questionBankService = {
  // ... existing methods unchanged ...

  // Tags
  getTags: (bankId: string) =>
    apiClient.get(`/instructor/question-banks/${bankId}/tags`),

  createTag: (bankId: string, data: { name: string }) =>
    apiClient.post(`/instructor/question-banks/${bankId}/tags`, data),

  updateTag: (bankId: string, tagId: string, data: { name: string }) =>
    apiClient.patch(`/instructor/question-banks/${bankId}/tags/${tagId}`, data),

  deleteTag: (bankId: string, tagId: string) =>
    apiClient.del(`/instructor/question-banks/${bankId}/tags/${tagId}`),
};
```

### 6b. File: `packages/shared-hooks/src/queries/use-question-banks.ts`

Add tag mutation hooks:

```typescript
export function useCreateBankTag() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ bankId, name }: { bankId: string; name: string }) =>
      questionBankService.createTag(bankId, { name }),
    onSuccess: (_, { bankId }) => {
      queryClient.invalidateQueries({ queryKey: keys.detail(bankId) });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateBankTag() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ bankId, tagId, name }: { bankId: string; tagId: string; name: string }) =>
      questionBankService.updateTag(bankId, tagId, { name }),
    onSuccess: (_, { bankId }) => {
      queryClient.invalidateQueries({ queryKey: keys.detail(bankId) });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteBankTag() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ bankId, tagId }: { bankId: string; tagId: string }) =>
      questionBankService.deleteTag(bankId, tagId),
    onSuccess: (_, { bankId }) => {
      queryClient.invalidateQueries({ queryKey: keys.detail(bankId) });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
```

### 6c. File: `packages/shared-hooks/src/index.ts`

Export new hooks:

```typescript
export { useCreateBankTag, useUpdateBankTag, useDeleteBankTag } from './queries/use-question-banks';
```

---

## Step 7: Frontend — Bank Detail Page

### File: `apps/management-portal/src/app/[locale]/instructor/question-banks/[bankId]/page.tsx`

### 7a. Update types

```typescript
interface BankTag {
  id: string;
  name: string;
}

interface QuestionBankItem {
  id: string;
  question: string;
  explanation: string | null;
  order: number;
  difficulty: string | null;   // NEW
  tagIds: string[];            // NEW
  options: QuestionOption[];
}

interface QuestionBankDetail {
  id: string;
  name: string;
  description: string | null;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
  questions: QuestionBankItem[];
  tags: BankTag[];             // NEW
}

interface QuestionFormData {
  question: string;
  explanation: string;
  difficulty: string;          // NEW — '' = not set
  tagIds: string[];            // NEW
  options: OptionFormData[];
}
```

### 7b. Tag management section (inline chip CRUD)

Place above the "Questions" section, after the Stats card. Simple inline UI:

```tsx
{/* Bank Tags */}
<div className="space-y-2">
  <div className="flex items-center justify-between">
    <h2 className="text-lg font-semibold">{t('bankTags')}</h2>
  </div>

  <div className="flex flex-wrap items-center gap-2">
    {bank.tags.map((tag) => (
      <Badge key={tag.id} variant="secondary" className="gap-1 pr-1">
        {tag.name}
        <button
          type="button"
          onClick={() => handleDeleteTag(tag.id)}
          className="hover:bg-muted rounded-full p-0.5"
        >
          <X className="h-3 w-3" />
        </button>
      </Badge>
    ))}

    {/* Inline add: input appears when clicking + */}
    {showTagInput ? (
      <form onSubmit={handleCreateTag} className="flex items-center gap-1">
        <Input
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          placeholder={t('tagNamePlaceholder')}
          className="h-7 w-32 text-xs"
          autoFocus
          onBlur={() => !newTagName.trim() && setShowTagInput(false)}
        />
        <Button type="submit" size="icon" variant="ghost" className="h-7 w-7"
          disabled={!newTagName.trim()}>
          <Check className="h-3.5 w-3.5" />
        </Button>
      </form>
    ) : (
      <Button
        variant="outline" size="sm" className="h-7 text-xs"
        onClick={() => setShowTagInput(true)}
      >
        <Plus className="mr-1 h-3 w-3" /> {t('addTag')}
      </Button>
    )}
  </div>

  {bank.tags.length === 0 && !showTagInput && (
    <p className="text-muted-foreground text-xs">{t('noTags')}</p>
  )}
</div>
```

State & handlers:
```typescript
const [showTagInput, setShowTagInput] = useState(false);
const [newTagName, setNewTagName] = useState('');
const createTag = useCreateBankTag();
const deleteTagMutation = useDeleteBankTag();

const handleCreateTag = (e: React.FormEvent) => {
  e.preventDefault();
  if (!newTagName.trim()) return;
  createTag.mutate(
    { bankId, name: newTagName.trim() },
    {
      onSuccess: () => {
        setNewTagName('');
        setShowTagInput(false);
        toast.success(t('tagCreated'));
      },
    },
  );
};

const handleDeleteTag = (tagId: string) => {
  deleteTagMutation.mutate({ bankId, tagId }, {
    onSuccess: () => toast.success(t('tagDeleted')),
  });
};
```

### 7c. Difficulty + tags in question create/edit dialog

After explanation field in the ConfirmDialog:

```tsx
{/* Difficulty */}
<div className="space-y-1">
  <Label className="text-sm">{t('difficulty')}</Label>
  <Select
    options={difficultyOptions}
    value={questionForm.difficulty}
    onChange={(e) => setQuestionForm(prev => ({ ...prev, difficulty: e.target.value }))}
    placeholder={t('selectDifficulty')}
  />
</div>

{/* Bank Tags (chip toggle, NOT global TagSelector) */}
{bank.tags.length > 0 && (
  <div className="space-y-1">
    <Label className="text-sm">{t('questionTags')}</Label>
    <div className="flex flex-wrap gap-1.5">
      {bank.tags.map((tag) => {
        const isSelected = questionForm.tagIds.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => {
              setQuestionForm(prev => ({
                ...prev,
                tagIds: isSelected
                  ? prev.tagIds.filter(id => id !== tag.id)
                  : [...prev.tagIds, tag.id],
              }));
            }}
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
              isSelected
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {tag.name}
          </button>
        );
      })}
    </div>
  </div>
)}
```

Constants:
```typescript
const DIFFICULTY_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;

const difficultyOptions = DIFFICULTY_LEVELS.map(l => ({
  value: l,
  label: t(`difficulty_${l.toLowerCase()}`),
}));

const DIFFICULTY_VARIANT: Record<string, 'secondary' | 'default' | 'destructive'> = {
  BEGINNER: 'secondary',
  INTERMEDIATE: 'default',
  ADVANCED: 'destructive',
};
```

### 7d. Show difficulty + tags on question list items

After question text, before options:

```tsx
{(q.difficulty || q.tagIds.length > 0) && (
  <div className="flex flex-wrap gap-1.5 pl-6 mt-1">
    {q.difficulty && (
      <Badge variant={DIFFICULTY_VARIANT[q.difficulty]} className="text-[10px]">
        {t(`difficulty_${q.difficulty.toLowerCase()}`)}
      </Badge>
    )}
    {q.tagIds.map(tagId => {
      const tag = bank.tags.find(t => t.id === tagId);
      return tag ? (
        <Badge key={tagId} variant="outline" className="text-[10px]">
          {tag.name}
        </Badge>
      ) : null;
    })}
  </div>
)}
```

### 7e. Update payload + edit pre-fill

`handleSaveQuestion`:
```typescript
const payload = {
  question: questionForm.question.trim(),
  explanation: questionForm.explanation.trim() || undefined,
  difficulty: questionForm.difficulty || undefined,     // NEW
  tagIds: questionForm.tagIds,                         // NEW
  options: questionForm.options
    .filter(o => o.text.trim())
    .map(o => ({ text: o.text.trim(), isCorrect: o.isCorrect })),
};
```

`openEditQuestion`:
```typescript
setQuestionForm({
  question: q.question,
  explanation: q.explanation ?? '',
  difficulty: q.difficulty ?? '',       // NEW
  tagIds: q.tagIds ?? [],              // NEW
  options: q.options.sort((a, b) => a.order - b.order)
    .map(o => ({ text: o.text, isCorrect: o.isCorrect })),
});
```

---

## Step 8: Frontend — Import Bank Text Dialog

### New file: `apps/management-portal/src/components/question-banks/import-bank-text-dialog.tsx`

2-step dialog (same UX pattern as placement's `ImportTextDialog`):

**Step 1:** Paste text + parse with `parseQuizText()`
**Step 2:** Assign difficulty (select) + bank tags (chip toggle) → apply to all parsed questions

```tsx
interface ImportBankTextDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (questions: BankQuestionPayload[]) => void;
  bankTags: Array<{ id: string; name: string }>;   // passed from parent
}
```

**Key:** The dialog receives `bankTags` as a prop (from `bank.tags`) — no need to fetch tags separately.

Replaces current `ImportQuizDialog` usage in bank detail page:
```tsx
// Before:
<ImportQuizDialog open={showImportText} onClose={...} onImport={...} />

// After:
<ImportBankTextDialog
  open={showImportText}
  onClose={() => setShowImportText(false)}
  bankTags={bank.tags}
  onImport={(questions) => {
    addQuestionsBatch.mutate({ bankId, questions }, {
      onSuccess: () => { toast.success(t('imported')); setShowImportText(false); },
    });
  }}
/>
```

---

## Step 9: Frontend — Import from Bank Dialog (Filters)

### File: `apps/management-portal/src/components/courses/wizard/import-from-bank-dialog.tsx`

This dialog is used in the **quiz builder** to import questions from a bank into a lesson quiz.

### 9a. Update `BankQuestion` type

```typescript
interface BankQuestion {
  id: string;
  question: string;
  explanation?: string;
  difficulty?: string | null;   // NEW
  tagIds?: string[];            // NEW
  options: Array<{ id: string; text: string; isCorrect: boolean }>;
}
```

Also need a `BankTag` type for the bank's tags:
```typescript
interface BankTag {
  id: string;
  name: string;
}
```

### 9b. Extract tags from bank detail response

The bank detail already includes `tags` (from step 3b). Parse it:

```typescript
const bankTags: BankTag[] = useMemo(() => {
  if (!bankDetail) return [];
  const detail = bankDetail as { data: { tags?: BankTag[] } };
  return detail.data?.tags ?? [];
}, [bankDetail]);
```

### 9c. Add filter state

```typescript
const [filterDifficulty, setFilterDifficulty] = useState<string>('');
const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
```

Reset filters when bank selection changes:
```typescript
useEffect(() => {
  setFilterDifficulty('');
  setFilterTagIds([]);
  setSelectedIds(new Set());
}, [selectedBankId]);
```

### 9d. Compute filtered questions

```typescript
const filteredQuestions = useMemo(() => {
  let result = questions;
  if (filterDifficulty) {
    result = result.filter(q => q.difficulty === filterDifficulty);
  }
  if (filterTagIds.length > 0) {
    result = result.filter(q =>
      q.tagIds?.some(id => filterTagIds.includes(id))
    );
  }
  return result;
}, [questions, filterDifficulty, filterTagIds]);
```

### 9e. Filter UI in step 1 (after bank selection + available count)

```tsx
{selectedBankId && questions.length > 0 && (
  <div className="border-border space-y-3 border-t pt-3">
    <Label className="text-sm font-medium">{t('filters')}</Label>

    {/* Difficulty filter */}
    <div className="space-y-1">
      <Select
        options={[
          { value: '', label: t('allDifficulties') },
          ...DIFFICULTY_LEVELS.map(l => ({ value: l, label: t(l.toLowerCase()) })),
        ]}
        value={filterDifficulty}
        onChange={(e) => setFilterDifficulty(e.target.value)}
      />
    </div>

    {/* Tag filter (from selected bank's tags) */}
    {bankTags.length > 0 && (
      <div className="space-y-1">
        <div className="flex flex-wrap gap-1.5">
          {bankTags.map(tag => {
            const isActive = filterTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => setFilterTagIds(prev =>
                  isActive ? prev.filter(x => x !== tag.id) : [...prev, tag.id]
                )}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      </div>
    )}

    {/* Filtered count */}
    <p className="text-muted-foreground text-xs">
      {t('matchingQuestions', { count: filteredQuestions.length, total: questions.length })}
    </p>
  </div>
)}
```

### 9f. Use `filteredQuestions` in step 2

- Manual mode: iterate `filteredQuestions` for selection checkboxes
- Random mode: `shuffleAndPick(filteredQuestions, count)` in `handleNext` and `handleReRandom`
- Clamp `randomCount` to `filteredQuestions.length`
- Disable "Next" when `filteredQuestions.length === 0`

### 9g. Show difficulty badge on question items

In both manual and random step-2 views, after question text:

```tsx
<div className="flex items-center gap-1.5">
  <p className="text-sm font-medium">Q{idx + 1}: {q.question}</p>
  {q.difficulty && (
    <Badge variant={DIFFICULTY_VARIANT[q.difficulty]} className="text-[10px] px-1.5 py-0">
      {t(q.difficulty.toLowerCase())}
    </Badge>
  )}
</div>
```

---

## Step 10: i18n Keys

### `apps/management-portal/messages/en.json`

Add to `questionBanks`:
```json
"bankTags": "Tags",
"addTag": "Add Tag",
"tagNamePlaceholder": "Tag name...",
"tagCreated": "Tag created",
"tagDeleted": "Tag deleted",
"noTags": "No tags yet. Add tags to categorize questions.",
"questionTags": "Tags",
"difficulty": "Difficulty",
"selectDifficulty": "Select difficulty...",
"difficulty_beginner": "Beginner",
"difficulty_intermediate": "Intermediate",
"difficulty_advanced": "Advanced"
```

Add to `importFromBank`:
```json
"filters": "Filters",
"allDifficulties": "All difficulties",
"matchingQuestions": "{count} / {total} questions match",
"beginner": "Beginner",
"intermediate": "Intermediate",
"advanced": "Advanced"
```

### `apps/management-portal/messages/vi.json`

Add to `questionBanks`:
```json
"bankTags": "Nhãn",
"addTag": "Thêm nhãn",
"tagNamePlaceholder": "Tên nhãn...",
"tagCreated": "Đã tạo nhãn",
"tagDeleted": "Đã xóa nhãn",
"noTags": "Chưa có nhãn. Thêm nhãn để phân loại câu hỏi.",
"questionTags": "Nhãn",
"difficulty": "Độ khó",
"selectDifficulty": "Chọn độ khó...",
"difficulty_beginner": "Cơ bản",
"difficulty_intermediate": "Trung bình",
"difficulty_advanced": "Nâng cao"
```

Add to `importFromBank`:
```json
"filters": "Bộ lọc",
"allDifficulties": "Tất cả",
"matchingQuestions": "{count} / {total} câu hỏi phù hợp",
"beginner": "Cơ bản",
"intermediate": "Trung bình",
"advanced": "Nâng cao"
```

---

## Commit Plan

| # | Scope | Message | Files |
|---|-------|---------|-------|
| 1 | `api` | `feat(api): add per-bank tags and difficulty to question bank items` | schema, migration, DTOs, service, controller, tests |
| 2 | `shared` | `feat(shared): add bank tag hooks and update question payload types` | question-bank.service.ts, use-question-banks.ts, index.ts |
| 3 | `management` | `feat(management): add tag management and difficulty to question bank detail` | [bankId]/page.tsx, import-bank-text-dialog.tsx, i18n |
| 4 | `management` | `feat(management): add difficulty and tag filters to import from bank dialog` | import-from-bank-dialog.tsx, i18n |

---

## Summary of Touched Files

```
# Backend
apps/api/src/prisma/schema.prisma                                          # Modified
apps/api/src/prisma/migrations/YYYYMMDD.../migration.sql                   # New
apps/api/src/modules/question-banks/dto/create-bank-question.dto.ts        # Modified
apps/api/src/modules/question-banks/dto/bank-tag.dto.ts                    # New
apps/api/src/modules/question-banks/question-banks.service.ts              # Modified
apps/api/src/modules/question-banks/question-banks.controller.ts           # Modified
apps/api/src/modules/question-banks/question-banks.service.spec.ts         # Modified

# Shared
packages/shared-hooks/src/services/question-bank.service.ts                # Modified
packages/shared-hooks/src/queries/use-question-banks.ts                    # Modified
packages/shared-hooks/src/index.ts                                         # Modified

# Frontend
apps/management-portal/src/app/[locale]/instructor/question-banks/[bankId]/page.tsx  # Modified
apps/management-portal/src/components/question-banks/import-bank-text-dialog.tsx      # New
apps/management-portal/src/components/courses/wizard/import-from-bank-dialog.tsx      # Modified
apps/management-portal/messages/en.json                                    # Modified
apps/management-portal/messages/vi.json                                    # Modified
```

**Total: 12 modified + 3 new = 15 files**

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Existing questions have no difficulty/tags | Both fields nullable/optional — zero data backfill |
| `tagIds` has no FK to `QuestionBankTag` | Acceptable: tags are per-bank (small set), `deleteTag` cleans up orphaned refs via `array_remove` |
| Instructor deletes a tag that questions reference | `deleteTag` uses `$executeRaw` with `array_remove` to strip the deleted tagId from all questions atomically |
| Bank detail response grows with tags | Tags are lightweight (id + name), typically 5–15 per bank — negligible overhead |
| `ImportQuizDialog` no longer used in bank detail | It's still used in quiz builder. Bank detail switches to `ImportBankTextDialog` |
| `@@unique([bankId, name])` Prisma error on duplicate | Backend catches P2002 and returns `{ code: 'BANK_TAG_DUPLICATE' }` |
