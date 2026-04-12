# Sub-phase 5.14f — Question Bank (Ngân hàng câu hỏi)

> Giảng viên quản lý ngân hàng câu hỏi riêng, import vào quiz bằng manual pick hoặc random.
> Dependencies: 5.14c (Course Wizard & Curriculum Editor), 5.6 (Courses & Quizzes backend).

---

## 1. Database Schema

### New Models

```prisma
model QuestionBank {
  id            String   @id @default(cuid())
  instructorId  String   @map("instructor_id")
  name          String
  description   String?
  questionCount Int      @default(0) @map("question_count")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  instructor User               @relation(fields: [instructorId], references: [id], onDelete: Cascade)
  questions  QuestionBankItem[]

  @@index([instructorId])
  @@map("question_banks")
}

model QuestionBankItem {
  id          String   @id @default(cuid())
  bankId      String   @map("bank_id")
  question    String
  explanation String?
  order       Int      @default(0)
  createdAt   DateTime @default(now()) @map("created_at")

  bank    QuestionBank           @relation(fields: [bankId], references: [id], onDelete: Cascade)
  options QuestionBankOption[]

  @@index([bankId])
  @@map("question_bank_items")
}

model QuestionBankOption {
  id         String  @id @default(cuid())
  questionId String  @map("question_id")
  text       String
  isCorrect  Boolean @default(false) @map("is_correct")
  order      Int     @default(0)

  question QuestionBankItem @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@index([questionId])
  @@map("question_bank_options")
}
```

### Migration
```bash
npx prisma migrate dev --name add_question_bank
```

---

## 2. Backend API

### New Module: `modules/question-banks/`

```
modules/question-banks/
├── question-banks.module.ts
├── question-banks.controller.ts
├── question-banks.service.ts
├── question-banks.service.spec.ts
└── dto/
    ├── create-question-bank.dto.ts
    ├── update-question-bank.dto.ts
    ├── create-bank-question.dto.ts
    └── update-bank-question.dto.ts
```

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/instructor/question-banks` | Instructor | Tạo bank mới |
| `GET` | `/instructor/question-banks` | Instructor | Danh sách banks (có pagination, search) |
| `GET` | `/instructor/question-banks/:id` | Instructor (owner) | Chi tiết bank + questions |
| `PATCH` | `/instructor/question-banks/:id` | Instructor (owner) | Sửa tên/mô tả bank |
| `DELETE` | `/instructor/question-banks/:id` | Instructor (owner) | Xóa bank |
| `POST` | `/instructor/question-banks/:id/questions` | Instructor (owner) | Thêm 1 câu hỏi |
| `POST` | `/instructor/question-banks/:id/questions/batch` | Instructor (owner) | Thêm nhiều câu hỏi |
| `PATCH` | `/instructor/question-banks/:id/questions/:questionId` | Instructor (owner) | Sửa câu hỏi |
| `DELETE` | `/instructor/question-banks/:id/questions/:questionId` | Instructor (owner) | Xóa câu hỏi |

### DTOs

**CreateQuestionBankDto:**
```typescript
export class CreateQuestionBankDto {
  @IsString() @MinLength(3) @MaxLength(100)
  name!: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;
}
```

**CreateBankQuestionDto:**
```typescript
export class CreateBankQuestionDto {
  @IsString() @MinLength(3)
  question!: string;

  @IsOptional() @IsString()
  explanation?: string;

  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(6)
  @ValidateNested({ each: true }) @Type(() => BankOptionDto)
  options!: BankOptionDto[];
}

class BankOptionDto {
  @IsString() @MinLength(1)
  text!: string;

  @IsBoolean()
  isCorrect!: boolean;
}
```

**BatchCreateBankQuestionsDto:**
```typescript
export class BatchCreateBankQuestionsDto {
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true }) @Type(() => CreateBankQuestionDto)
  questions!: CreateBankQuestionDto[];
}
```

### Service Logic

**create(instructorId, dto):**
- Tạo bank với instructorId

**findAll(instructorId, query):**
- Paginated, search by name
- Return questionCount denormalized

**findById(bankId, instructorId):**
- Verify ownership
- Include all questions + options, ordered by `order`

**addQuestion(bankId, instructorId, dto):**
- Verify ownership
- Validate exactly 1 correct option
- Auto-assign order (last + 1)
- Increment questionCount
- Transaction: create question + options + update count

**addQuestionsBatch(bankId, instructorId, dto):**
- Same as above but for multiple questions
- Single transaction

**updateQuestion(bankId, questionId, instructorId, dto):**
- Verify ownership
- Delete old options → create new options (upsert pattern)

**deleteQuestion(bankId, questionId, instructorId):**
- Verify ownership
- Transaction: delete question + decrement questionCount

**deleteBank(bankId, instructorId):**
- Verify ownership
- Cascade delete (questions + options auto-deleted by Prisma)

---

## 3. Shared Layer

### Service: `packages/shared-hooks/src/services/question-bank.service.ts`

```typescript
export const questionBankService = {
  getAll: (params?: { page?: number; search?: string }) =>
    apiClient.get('/instructor/question-banks', { params }),

  getById: (bankId: string) =>
    apiClient.get(`/instructor/question-banks/${bankId}`),

  create: (data: { name: string; description?: string }) =>
    apiClient.post('/instructor/question-banks', data),

  update: (bankId: string, data: { name?: string; description?: string }) =>
    apiClient.patch(`/instructor/question-banks/${bankId}`, data),

  delete: (bankId: string) =>
    apiClient.del(`/instructor/question-banks/${bankId}`),

  addQuestion: (bankId: string, data: CreateBankQuestionPayload) =>
    apiClient.post(`/instructor/question-banks/${bankId}/questions`, data),

  addQuestionsBatch: (bankId: string, data: { questions: CreateBankQuestionPayload[] }) =>
    apiClient.post(`/instructor/question-banks/${bankId}/questions/batch`, data),

  updateQuestion: (bankId: string, questionId: string, data: CreateBankQuestionPayload) =>
    apiClient.patch(`/instructor/question-banks/${bankId}/questions/${questionId}`, data),

  deleteQuestion: (bankId: string, questionId: string) =>
    apiClient.del(`/instructor/question-banks/${bankId}/questions/${questionId}`),
};
```

### Hooks: `packages/shared-hooks/src/queries/use-question-banks.ts`

```typescript
// Queries
useQuestionBanks(params?)        — list with pagination
useQuestionBankDetail(bankId)    — detail + questions

// Mutations
useCreateQuestionBank()
useUpdateQuestionBank()
useDeleteQuestionBank()
useAddBankQuestion()
useAddBankQuestionsBatch()
useUpdateBankQuestion()
useDeleteBankQuestion()
```

---

## 4. Management Portal — Question Banks Page

### Navigation
- Sidebar: thêm "Question Banks" (Database icon) sau "Courses"
- Route: `/instructor/question-banks`

### Page: `/instructor/question-banks/page.tsx`

**UI:**
- Header: "Question Banks" + "Create Bank" button
- Search input (debounce)
- Table/Grid: name, description (truncate), questionCount, createdAt, actions (Edit, Delete)
- Pagination
- Empty state: "No question banks yet"

### Page: `/instructor/question-banks/[bankId]/page.tsx`

**UI:**
- Header: bank name + "Edit" + "Delete" buttons
- Description (if any)
- Stats: total questions
- "Add Question" button + "Import From Text" button
- Question list:
  - Mỗi câu: question text, options (A/B/C/D with correct marked ✓), explanation
  - Actions: Edit, Delete
  - Drag to reorder (optional, có thể bỏ qua cho thesis)
- Pagination nếu >20 câu

### Dialog: `CreateBankDialog`
- Input: name (required), description (optional)
- Create button

### Dialog: `EditQuestionDialog`
- Reuse pattern giống QuizBuilder nhưng cho 1 câu hỏi
- Question text, options (add/remove), correct toggle, explanation
- Save / Cancel

### Dialog: `ImportTextDialog`
- Textarea paste text theo format:
```
Q: Câu hỏi 1
A) Option A
B) Option B *
C) Option C
Explanation: Giải thích

Q: Câu hỏi 2
...
```
- Parse → preview → confirm import
- Reuse logic từ quiz import dialog hiện tại

---

## 5. Quiz Builder — Import From Bank

### Thay đổi file: `quiz-builder.tsx`

**Thêm button:** "Import from Bank" cạnh "Add Question" và "Import From Text"

### Dialog: `ImportFromBankDialog`

**UI flow:**

```
Step 1: Chọn bank
┌─────────────────────────────────────────┐
│ Import from Question Bank               │
│                                         │
│ Question Bank: [JavaScript Basics  ▼]   │
│   50 questions available                │
│                                         │
│ Mode:                                   │
│   ○ Manual pick — chọn từng câu         │
│   ● Random — random N câu              │
│                                         │
│ Number of questions: [10]               │
│                                         │
│ [Cancel]              [Next →]          │
└─────────────────────────────────────────┘

Step 2a (Manual): Chọn câu hỏi
┌─────────────────────────────────────────┐
│ Select questions (3/50 selected)        │
│                                         │
│ ☑ Q1: JavaScript là gì?                │
│ ☐ Q2: Var vs Let vs Const?             │
│ ☑ Q3: Closure hoạt động như nào?        │
│ ☐ Q4: Promise vs Callback?             │
│ ☑ Q5: Arrow function khác gì?          │
│ ...                                     │
│                                         │
│ [← Back]          [Import 3 questions]  │
└─────────────────────────────────────────┘

Step 2b (Random): Preview
┌─────────────────────────────────────────┐
│ Random picked 10 questions:             │
│                                         │
│ 1. JavaScript là gì?                    │
│ 2. Arrow function khác gì?             │
│ 3. Promise vs Callback?                 │
│ ...                                     │
│                                         │
│ [← Back]  [🔄 Re-random]  [Import 10]  │
└─────────────────────────────────────────┘
```

**Logic:**
- Random: `questions.sort(() => Math.random() - 0.5).slice(0, count)`
- Import: map `QuestionBankItem` → `LocalQuizData.questions` format
- Append vào existing questions (không replace)

### Props change

```typescript
// ImportFromBankDialog props
interface ImportFromBankDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (questions: Array<{
    question: string;
    explanation: string;
    options: Array<{ text: string; isCorrect: boolean }>;
  }>) => void;
}
```

Quiz builder nhận questions qua `onImport` → append vào form state.

---

## 6. i18n Keys

### Management Portal — `messages/en.json`

```json
{
  "questionBanks": {
    "title": "Question Banks",
    "create": "Create bank",
    "name": "Bank name",
    "namePlaceholder": "e.g. JavaScript Basics",
    "description": "Description",
    "descriptionPlaceholder": "Optional description...",
    "questionCount": "{count} questions",
    "nobanks": "No question banks yet",
    "editBank": "Edit bank",
    "deleteBank": "Delete bank",
    "confirmDelete": "Are you sure? All questions in this bank will be deleted.",
    "addQuestion": "Add question",
    "importText": "Import from text",
    "editQuestion": "Edit question",
    "deleteQuestion": "Delete question",
    "confirmDeleteQuestion": "Are you sure you want to delete this question?",
    "questionText": "Question",
    "questionPlaceholder": "Enter the question...",
    "explanation": "Explanation",
    "explanationPlaceholder": "Why is this the correct answer?",
    "options": "Options",
    "optionPlaceholder": "Option text...",
    "addOption": "Add option",
    "correctAnswer": "Correct",
    "saved": "Saved successfully",
    "imported": "{count} questions imported"
  },
  "importFromBank": {
    "title": "Import from Question Bank",
    "selectBank": "Select a question bank",
    "available": "{count} questions available",
    "mode": "Import mode",
    "manualPick": "Manual pick",
    "manualPickDesc": "Select specific questions",
    "random": "Random",
    "randomDesc": "Randomly pick N questions",
    "numberOfQuestions": "Number of questions",
    "selectQuestions": "Select questions",
    "selected": "{count} selected",
    "randomPreview": "Random picked {count} questions",
    "reRandom": "Re-random",
    "import": "Import {count} questions",
    "back": "Back",
    "next": "Next",
    "noQuestions": "This bank has no questions"
  }
}
```

### Vietnamese — `messages/vi.json`
Tương tự với tiếng Việt.

---

## 7. File Structure

### Backend
```
apps/api/src/modules/question-banks/
├── question-banks.module.ts
├── question-banks.controller.ts
├── question-banks.service.ts
├── question-banks.service.spec.ts
└── dto/
    ├── create-question-bank.dto.ts
    ├── update-question-bank.dto.ts
    └── create-bank-question.dto.ts
```

### Shared
```
packages/shared-hooks/src/
├── services/question-bank.service.ts    (NEW)
├── queries/use-question-banks.ts        (NEW)
└── index.ts                             (UPDATE — export new)
```

### Frontend
```
apps/management-portal/src/
├── app/[locale]/instructor/question-banks/
│   ├── page.tsx                          (NEW — list page)
│   └── [bankId]/page.tsx                 (NEW — detail page)
├── components/question-banks/
│   ├── create-bank-dialog.tsx            (NEW)
│   ├── question-form.tsx                 (NEW — add/edit single question)
│   ├── question-item.tsx                 (NEW — display single question in list)
│   └── import-from-bank-dialog.tsx       (NEW — 2-step import dialog)
└── components/courses/wizard/
    └── quiz-builder.tsx                  (UPDATE — add import button)
```

---

## 8. Implementation Order

### Commit 1: Database + Backend
1. Add 3 models to `schema.prisma`
2. Run migration
3. Create `question-banks` module (controller, service, DTOs)
4. Register module in `app.module.ts`
5. Write unit tests

### Commit 2: Shared Layer
1. Create `question-bank.service.ts`
2. Create `use-question-banks.ts` hooks
3. Export from `index.ts`

### Commit 3: Question Banks Pages
1. Add sidebar link "Question Banks"
2. Create list page (`/instructor/question-banks`)
3. Create detail page (`/instructor/question-banks/[bankId]`)
4. Create components: `CreateBankDialog`, `QuestionForm`, `QuestionItem`
5. Add i18n keys

### Commit 4: Import From Bank Dialog
1. Create `ImportFromBankDialog` component (2-step: select bank + pick questions)
2. Update `quiz-builder.tsx` — add "Import from Bank" button
3. Wire dialog → append imported questions to quiz form

---

## 9. Quality Checklist

- [ ] All user-facing strings via `useTranslations()` (en + vi)
- [ ] Design tokens only (no hardcoded colors)
- [ ] TypeScript strict (no `any`)
- [ ] Named exports (except pages)
- [ ] DTO validation on all inputs
- [ ] Ownership check: instructor can only access own banks
- [ ] Denormalized `questionCount` updated in transactions
- [ ] Unit tests for service (CRUD + batch + ownership)
- [ ] Dark mode compatible
- [ ] Mobile responsive
- [ ] Pagination on bank list and question list
- [ ] ConfirmDialog for delete actions
- [ ] Toast notifications on success/error
