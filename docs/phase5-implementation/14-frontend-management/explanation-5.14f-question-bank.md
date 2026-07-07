# Phase 5.14f — Giải thích chi tiết: Question Banks (Ngân hàng câu hỏi)

---

## 1. Tổng quan

Phase này implement tính năng **Question Banks** — cho phép instructor tạo và quản lý ngân hàng câu hỏi riêng, sau đó import câu hỏi từ ngân hàng vào quiz của khóa học. Tính năng này giúp instructor tái sử dụng câu hỏi qua nhiều khóa học khác nhau, tiết kiệm thời gian soạn quiz.

### Phạm vi thay đổi

| Layer | Files | Nội dung |
|-------|-------|----------|
| Database | 1 migration + schema.prisma | 3 bảng mới: question_banks, question_bank_items, question_bank_options |
| Backend | 6 files (module, controller, service, DTOs, spec) | CRUD + batch operations, 15 unit tests |
| Shared | 3 files (service, hooks, index) | API client + 9 TanStack Query hooks |
| Frontend | 4 files (list page, detail page, import dialog, sidebar) | 2 trang + 1 dialog + sidebar link |
| i18n | 2 files (en.json, vi.json) | ~70 keys mỗi locale |

---

## 2. Database Schema

### 3 bảng mới

```
QuestionBank (question_banks)
├── id: CUID
├── instructorId → User (CASCADE delete)
├── name: String
├── description: String?
├── questionCount: Int (denormalized, default 0)
├── createdAt, updatedAt
│
├── QuestionBankItem (question_bank_items)  [1:N]
│   ├── id: CUID
│   ├── bankId → QuestionBank (CASCADE delete)
│   ├── question: String
│   ├── explanation: String?
│   ├── order: Int (default 0)
│   ├── createdAt
│   │
│   └── QuestionBankOption (question_bank_options)  [1:N]
│       ├── id: CUID
│       ├── questionId → QuestionBankItem (CASCADE delete)
│       ├── text: String
│       ├── isCorrect: Boolean (default false)
│       └── order: Int (default 0)
```

### Design decisions

- **Denormalized `questionCount`**: Tránh COUNT query mỗi lần list banks. Được increment/decrement trong transaction khi add/delete question.
- **CASCADE delete**: Xóa bank → tự động xóa tất cả questions + options. Xóa question → xóa options.
- **`order` field**: Giữ thứ tự câu hỏi và đáp án theo thứ tự tạo.
- **Tách biệt với Quiz**: Question Bank là kho riêng của instructor, không liên kết trực tiếp với bất kỳ lesson/quiz nào. Khi import vào quiz, data được copy (không reference).

---

## 3. Backend API

### 9 endpoints — Controller: `instructor/question-banks`

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/instructor/question-banks` | Tạo bank mới |
| GET | `/instructor/question-banks` | List banks (paginated, search) |
| GET | `/instructor/question-banks/:id` | Chi tiết bank + questions + options |
| PATCH | `/instructor/question-banks/:id` | Cập nhật tên/mô tả |
| DELETE | `/instructor/question-banks/:id` | Xóa bank (cascade) |
| POST | `/instructor/question-banks/:id/questions` | Thêm 1 câu hỏi |
| POST | `/instructor/question-banks/:id/questions/batch` | Thêm nhiều câu hỏi cùng lúc |
| PATCH | `/instructor/question-banks/:id/questions/:qId` | Sửa câu hỏi |
| DELETE | `/instructor/question-banks/:id/questions/:qId` | Xóa câu hỏi |

### Service patterns

**Ownership verification**: Mọi operation đều gọi `verifyOwnership()` — check bank tồn tại + instructorId khớp. Trả `NOT_BANK_OWNER` nếu không phải chủ.

**Validation**: `validateOneCorrectOption()` — mỗi câu hỏi phải có đúng 1 đáp án đúng. Trả `EXACTLY_ONE_CORRECT_OPTION` nếu vi phạm.

**Transaction pattern cho add/delete**:
```
addQuestion:
1. Tìm order cao nhất hiện tại
2. Transaction: create question + increment questionCount

deleteQuestion:
1. Verify question thuộc bank
2. Transaction: delete question + decrement questionCount
```

**Batch import**: Giống addQuestion nhưng loop trong 1 transaction, increment `questionCount` theo `questions.length`.

**Update question**: Delete old options → create new options (strategy: replace all, không merge).

### Unit tests — 15 tests

- CRUD: create, findAll, findById, update, delete
- Questions: add, batch, update, delete
- Ownership: findById unauthorized, update unauthorized
- Validation: no correct option, multiple correct options
- Not found: bank not found, question not found

---

## 4. Shared Layer

### Service (`question-bank.service.ts`)

```typescript
export const questionBankService = {
  getAll: (params?) => apiClient.get('/instructor/question-banks', toQuery(params)),
  getById: (bankId) => apiClient.get(`/instructor/question-banks/${bankId}`),
  create: (data) => apiClient.post('/instructor/question-banks', data),
  update: (bankId, data) => apiClient.patch(`/instructor/question-banks/${bankId}`, data),
  delete: (bankId) => apiClient.del(`/instructor/question-banks/${bankId}`),
  addQuestion: (bankId, data) => apiClient.post(`.../${bankId}/questions`, data),
  addQuestionsBatch: (bankId, questions) => apiClient.post(`.../${bankId}/questions/batch`, { questions }),
  updateQuestion: (bankId, questionId, data) => apiClient.patch(`.../${bankId}/questions/${questionId}`, data),
  deleteQuestion: (bankId, questionId) => apiClient.del(`.../${bankId}/questions/${questionId}`),
};
```

Helper `toQuery()`: Convert `{ page, limit, search }` → `Record<string, string>` để truyền vào `apiClient.get()`.

### Hooks (`use-question-banks.ts`) — 9 hooks

| Hook | Type | Query Key |
|------|------|-----------|
| `useQuestionBanks` | Query | `['question-banks', page, limit, search]` |
| `useQuestionBankDetail` | Query | `['question-banks', bankId]` |
| `useCreateQuestionBank` | Mutation | Invalidate `['question-banks']` |
| `useUpdateQuestionBank` | Mutation | Invalidate `['question-banks']` |
| `useDeleteQuestionBank` | Mutation | Invalidate `['question-banks']` |
| `useAddBankQuestion` | Mutation | Invalidate `['question-banks', bankId]` |
| `useAddBankQuestionsBatch` | Mutation | Invalidate `['question-banks', bankId]` |
| `useUpdateBankQuestion` | Mutation | Invalidate `['question-banks', bankId]` |
| `useDeleteBankQuestion` | Mutation | Invalidate `['question-banks', bankId]` |

---

## 5. Frontend Pages

### 5.1 Question Banks List (`/instructor/question-banks`)

**Tính năng:**
- Search bar filter by bank name
- Table: Name, Description (truncated 50 chars), Questions count, Created date, Actions (Edit, Delete)
- Pagination (10 banks/page)
- Create dialog: Name (required) + Description (optional)
- Delete confirmation dialog

**Flow tạo bank:**
```
Instructor bấm "Create Question Bank"
→ Dialog mở: nhập name + description
→ POST /instructor/question-banks
→ Invalidate query → bank mới xuất hiện trong list
→ Toast success
```

### 5.2 Question Bank Detail (`/instructor/question-banks/[bankId]`)

**Tính năng:**
- Bank info header: Name, Description, Question count
- Edit bank name/description (inline dialog)
- Delete bank button (confirmation)
- Question list: Numbered, with question text + options (CheckCircle2/Circle radio pattern)
- Add Question dialog: Question text + explanation + options (2-6, radio select correct answer)
- Edit Question dialog: Pre-filled, same pattern
- Delete question confirmation
- Import From Text: Parse format `Question text\nA) Option 1\nB) Option 2*\nC) Option 3` (asterisk = correct)

**UI pattern — Radio-style options:**
```
Mỗi option hiển thị:
- Circle icon (gray) nếu không đúng
- CheckCircle2 icon (green) nếu đúng
- Text option bên cạnh

Trong Add/Edit dialog:
- Click vào option để chọn correct answer
- Chỉ 1 option được chọn (single correct)
- Nút + để thêm option, X để xóa (min 2, max 6)
```

### 5.3 Import From Bank Dialog (`import-from-bank-dialog.tsx`)

Tích hợp vào quiz builder khi tạo/edit lesson quiz. 2-step dialog:

**Step 1: Chọn bank + mode**
- Dropdown chọn Question Bank (fetch all banks)
- 2 mode: Manual (chọn tay) / Random (random N câu)

**Step 2a: Manual mode**
- Checkbox list tất cả câu hỏi trong bank
- Preview question text + options
- Bấm Import → copy selected questions vào quiz

**Step 2b: Random mode**
- Input số lượng câu (max = total questions)
- Preview random selection
- Nút "Re-random" để random lại
- Bấm Import → copy vào quiz

**Integration với Quiz Builder:**
- Nút "Import from Bank" cạnh "Add Question" và "Import From Text"
- Import = copy data, không reference → chỉnh sửa quiz không ảnh hưởng bank
- Questions import giữ nguyên structure: question, explanation, options[]

### 5.4 Sidebar Link

Thêm link "Question Banks" (Library icon) vào instructor sidebar, ngay dưới "Courses".

---

## 6. i18n Keys

~70 keys mới cho mỗi locale (`questionBanks` namespace):

```
questionBanks.title, questionBanks.description, questionBanks.create, ...
questionBanks.bankName, questionBanks.bankDescription, questionBanks.questionCount, ...
questionBanks.addQuestion, questionBanks.editQuestion, questionBanks.deleteQuestion, ...
questionBanks.questionText, questionBanks.explanation, questionBanks.option, ...
questionBanks.markCorrect, questionBanks.addOption, questionBanks.removeOption, ...
questionBanks.importFromText, questionBanks.importFromBank, ...
questionBanks.manual, questionBanks.random, questionBanks.randomCount, ...
questionBanks.noQuestions, questionBanks.confirmDelete, ...
```

---

## 7. Deployment Notes

### Database migration

Chạy trên server (Ubuntu):

```bash
cd /path/to/project
npx prisma migrate deploy
```

Lệnh này sẽ apply migration `20260330075508_add_question_bank` tạo 3 bảng mới.

### pgvector extension (nếu chưa có)

Nếu server PostgreSQL chưa có pgvector extension (cần cho AI Tutor):

**Neon.tech (production)**: pgvector đã có sẵn, chỉ cần chạy migration:
```bash
npx prisma migrate deploy
```
Migration `20260323000000_add_pgvector_embedding` sẽ tự chạy `CREATE EXTENSION IF NOT EXISTS vector`.

**Ubuntu server (self-hosted PostgreSQL)**:
```bash
# 1. Install pgvector extension
sudo apt install postgresql-16-pgvector
# Hoặc nếu dùng PostgreSQL 15:
sudo apt install postgresql-15-pgvector

# 2. Restart PostgreSQL
sudo systemctl restart postgresql

# 3. Chạy migration (sẽ CREATE EXTENSION + ALTER TABLE)
npx prisma migrate deploy
```

**Docker (local dev)**:
```bash
# Đã dùng pgvector/pgvector:pg16 image trong docker-compose.yml
# Chỉ cần chạy migration
npx prisma migrate deploy
```

### Sau khi deploy, index courses cho AI Tutor:

```bash
# Gọi API endpoint (cần admin/instructor token)
curl -X POST https://api.example.com/api/ai/tutor/index/<courseId> \
  -H "Authorization: Bearer <token>"
```

Hoặc đợi cron job chạy tự động (5AM hàng ngày, index courses chưa có chunks).
