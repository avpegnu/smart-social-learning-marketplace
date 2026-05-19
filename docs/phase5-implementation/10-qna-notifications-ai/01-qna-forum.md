# 01 — Q&A Forum: Questions, Answers, Vote System, và Best Answer

> Giải thích chi tiết QnaModule — Stack Overflow-style Q&A forum cho course discussions,
> vote system (3-state toggle), best answer marking, và denormalized counters.

---

## 1. TỔNG QUAN

### 1.1 Files đã tạo

```
src/modules/qna/
├── qna.module.ts                           # Module definition
├── questions/
│   ├── questions.controller.ts             # 8 endpoints
│   ├── questions.service.ts                # CRUD + markBestAnswer + findSimilar
│   └── questions.service.spec.ts           # 15 tests
├── answers/
│   ├── answers.controller.ts               # 2 endpoints (delete + vote)
│   ├── answers.service.ts                  # Create, delete, vote
│   └── answers.service.spec.ts             # 9 tests
└── dto/
    ├── create-question.dto.ts              # Title, content, courseId?, tagId?, codeSnippet?
    ├── update-question.dto.ts              # Partial update
    ├── query-questions.dto.ts              # courseId?, tagId?, search?, status?
    ├── create-answer.dto.ts                # Content + codeSnippet?
    └── vote.dto.ts                         # value: -1 | 0 | 1
```

### 1.2 Prisma Models

```
Question:
  ├── id, title, content, codeSnippet (Json?)
  ├── authorId → User
  ├── courseId? → Course (optional — general Q&A or course-specific)
  ├── tagId? → Tag (single tag, not array)
  ├── bestAnswerId? → Answer (unique — 1 best answer per question)
  ├── viewCount (denormalized)
  └── answerCount (denormalized)

Answer:
  ├── id, content, codeSnippet (Json?)
  ├── authorId → User
  ├── questionId → Question
  └── voteCount (denormalized)

Vote:
  ├── userId + answerId (@@unique — 1 vote per user per answer)
  └── value: Int (+1 or -1)
```

---

## 2. QUESTION LIFECYCLE

### 2.1 Create → Answer → Mark Best → Close

```
1. Student creates question (optionally linked to a course + tag)
   POST /api/questions { title, content, courseId?, tagId?, codeSnippet? }

2. Other users/instructors post answers
   POST /api/questions/:id/answers { content, codeSnippet? }

3. Community votes on answers (upvote/downvote)
   POST /api/answers/:id/vote { value: 1 }

4. Question author OR course instructor marks best answer
   PUT /api/questions/:id/best-answer { answerId }

5. Question with bestAnswer shows ✅ badge in list
   GET /api/questions → { hasBestAnswer: true }
```

### 2.2 TagId — Single Tag Design

```prisma
model Question {
  tagId String? @map("tag_id")
  tag   Tag?    @relation(fields: [tagId], references: [id])
}
```

**API doc showed `tags: ["react", "hooks"]` (array) nhưng schema has `tagId` (single).**

Giữ single tag vì:
- Schema đã migrate — đổi cần migration + data migration
- 1 "primary tag" per question đủ cho MVP
- Stack Overflow cũng có concept "primary tag" dù hỗ trợ multiple
- Tag relation qua `Tag` model (not free-text) → structured taxonomy

---

## 3. QUESTIONS SERVICE — Chi tiết Methods

### 3.1 findAll — Filter + Search + Status

```typescript
async findAll(query: QueryQuestionsDto) {
  const where: Prisma.QuestionWhereInput = {
    ...(query.courseId && { courseId: query.courseId }),
    ...(query.tagId && { tagId: query.tagId }),
    ...(query.search && {
      OR: [
        { title: { contains: query.search, mode: 'insensitive' as const } },
        { content: { contains: query.search, mode: 'insensitive' as const } },
      ],
    }),
    // Status filter — answered vs unanswered
    ...(query.status === 'answered' && { bestAnswerId: { not: null } }),
    ...(query.status === 'unanswered' && { bestAnswerId: null }),
  };
}
```

**Conditional spread pattern `...(condition && { field: value })`:**
- Nếu `query.courseId` undefined → spread `false` → nothing added
- Nếu `query.courseId` = "abc" → spread `{ courseId: "abc" }` → added to where
- Clean hơn if/else chains cho building dynamic queries

**Status filter logic:**
- `answered`: question có `bestAnswerId` (not null) — đã được mark best answer
- `unanswered`: question chưa có `bestAnswerId` (null)
- `all` hoặc omit: không filter

**`mode: 'insensitive' as const`:**
- Prisma requires literal `'insensitive'` type (not `string`)
- TypeScript infer `string` without `as const` → type mismatch
- Alternative: import `Prisma.QueryMode.insensitive` nhưng verbose hơn

### 3.2 findById — View Count Increment (Fire-and-Forget)

```typescript
async findById(questionId: string) {
  const question = await this.prisma.question.findUnique({
    where: { id: questionId },
    include: {
      author: { select: AUTHOR_SELECT },
      course: { select: { id: true, title: true } },
      tag: { select: { id: true, name: true } },
      answers: {
        include: {
          author: { select: AUTHOR_SELECT },
          _count: { select: { votes: true } },
        },
        orderBy: { voteCount: 'desc' },  // Best answers first
      },
      bestAnswer: { include: { author: { select: AUTHOR_SELECT } } },
    },
  });

  if (!question) throw new NotFoundException({ code: 'QUESTION_NOT_FOUND' });

  // Fire-and-forget: don't await, don't block response
  this.prisma.question.update({
    where: { id: questionId },
    data: { viewCount: { increment: 1 } },
  }).catch(() => { /* ignore errors */ });

  return question;
}
```

**Tại sao fire-and-forget?**

```
Option A — Await:
  const question = await findUnique(...)  // 50ms
  await update(viewCount + 1)             // 30ms
  return question                         // Total: 80ms

Option B — Fire-and-forget:
  const question = await findUnique(...)  // 50ms
  update(viewCount + 1)                   // Don't wait!
  return question                         // Total: 50ms (30ms saved)
```

- viewCount là approximate metric, không cần exact
- Nếu increment fail → user vẫn thấy question (not critical)
- `.catch(() => {})` prevents unhandled promise rejection

**Answers sorted by `voteCount: 'desc'`:**
- Highest voted answers appear first (like Stack Overflow)
- Best answer shown separately via `bestAnswer` include

### 3.3 findSimilar — Simple Text Search

```typescript
async findSimilar(title: string, limit = 5) {
  const searchTerms = title.split(' ').slice(0, 3).join(' ');
  return this.prisma.question.findMany({
    where: {
      title: { contains: searchTerms, mode: 'insensitive' },
    },
    select: { id: true, title: true, answerCount: true, bestAnswerId: true },
    take: limit,
  });
}
```

**Frontend use case:**
- User đang gõ title cho question mới
- Frontend debounce → call `GET /api/questions/similar?title=useEffect chạy 2 lần`
- Hiển thị "Câu hỏi tương tự" trước khi user submit → giảm duplicate questions

**`split(' ').slice(0, 3).join(' ')`:**
- Lấy 3 từ đầu tiên làm search terms
- "Tại sao useEffect chạy 2 lần trong React 18" → search "Tại sao useEffect"
- Đủ specific để tìm related, không quá strict

### 3.4 markBestAnswer — Dual Authorization

```typescript
async markBestAnswer(questionId: string, answerId: string, userId: string) {
  const question = await this.prisma.question.findUnique({
    where: { id: questionId },
    include: { course: { select: { instructorId: true } } },
  });

  // Two people can mark best answer:
  const isOwner = question.authorId === userId;        // Question author
  const isInstructor = question.course?.instructorId === userId; // Course instructor
  if (!isOwner && !isInstructor) {
    throw new ForbiddenException({ code: 'NOT_AUTHORIZED_TO_MARK_BEST' });
  }

  // Verify answer belongs to this question
  const answer = await this.prisma.answer.findUnique({ where: { id: answerId } });
  if (!answer || answer.questionId !== questionId) {
    throw new BadRequestException({ code: 'ANSWER_NOT_FOR_THIS_QUESTION' });
  }

  return this.prisma.question.update({
    where: { id: questionId },
    data: { bestAnswerId: answerId },
  });
}
```

**Tại sao instructor cũng có quyền?**
- Course-specific questions: instructor là expert → biết answer nào đúng nhất
- Student có thể không đủ kiến thức để đánh giá
- Tương tự: TA (teaching assistant) role trong classroom Q&A

**Cross-question answer check:**
- `answer.questionId !== questionId` → prevent marking answer from question A as best for question B
- Prisma doesn't enforce cross-table relationships → manual check

---

## 4. VOTE SYSTEM — 3-State Toggle

### 4.1 Lý thuyết: Vote States

```
User's vote state per answer:
  null    → No vote (hasn't voted yet)
  +1      → Upvoted
  -1      → Downvoted

State transitions:
  null → click ▲ → +1 (upvote)
  null → click ▼ → -1 (downvote)
  +1   → click ▲ → null (toggle off — remove upvote)
  +1   → click ▼ → -1 (change to downvote, swing by 2)
  -1   → click ▼ → null (toggle off — remove downvote)
  -1   → click ▲ → +1 (change to upvote, swing by 2)
```

### 4.2 voteCount Math

```
Action              | DB operations                    | voteCount change
--------------------|----------------------------------|------------------
New upvote (+1)     | CREATE vote(+1)                  | +1
New downvote (-1)   | CREATE vote(-1)                  | -1
Toggle off (+1→∅)   | DELETE vote                      | -1 (undo the +1)
Toggle off (-1→∅)   | DELETE vote                      | +1 (undo the -1)
Change (+1→-1)      | UPDATE vote value                | -2 (swing)
Change (-1→+1)      | UPDATE vote value                | +2 (swing)
Remove (value=0)    | DELETE vote                      | -existing.value
```

### 4.3 Implementation

```typescript
async vote(userId: string, answerId: string, value: number) {
  const answer = await this.prisma.answer.findUnique({ where: { id: answerId } });
  if (!answer) throw new NotFoundException({ code: 'ANSWER_NOT_FOUND' });

  // Cannot vote on own answer (Stack Overflow rule)
  if (answer.authorId === userId) {
    throw new BadRequestException({ code: 'CANNOT_VOTE_OWN_ANSWER' });
  }

  const existing = await this.prisma.vote.findUnique({
    where: { userId_answerId: { userId, answerId } },
  });

  // Case 1: Remove vote (value=0 or same value toggle)
  if (existing && (value === 0 || existing.value === value)) {
    await this.prisma.$transaction([
      this.prisma.vote.delete({ where: { id: existing.id } }),
      this.prisma.answer.update({
        where: { id: answerId },
        data: { voteCount: { decrement: existing.value } },
      }),
    ]);
    return { voteCount: answer.voteCount - existing.value, userVote: null };
  }

  // Case 2: Change vote direction
  if (existing) {
    await this.prisma.$transaction([
      this.prisma.vote.update({ where: { id: existing.id }, data: { value } }),
      this.prisma.answer.update({
        where: { id: answerId },
        data: { voteCount: { increment: value * 2 } }, // Swing: -1→+1 = +2
      }),
    ]);
    return { voteCount: answer.voteCount + value * 2, userVote: value };
  }

  // Case 3: New vote
  await this.prisma.$transaction([
    this.prisma.vote.create({ data: { userId, answerId, value } }),
    this.prisma.answer.update({
      where: { id: answerId },
      data: { voteCount: { increment: value } },
    }),
  ]);
  return { voteCount: answer.voteCount + value, userVote: value };
}
```

**Tại sao `value * 2` cho change?**
```
Example: User changes from upvote (+1) to downvote (-1)
  Current voteCount: 10 (includes the user's +1)
  Need to: remove the +1 AND add -1 → net change = -2
  Formula: increment by (new_value * 2) = (-1 * 2) = -2
  Result: 10 + (-2) = 8 ✓

Verify: 8 = 10 - 1 (old upvote) - 1 (new downvote) = 8 ✓
```

### 4.4 Response Format

```typescript
return { voteCount: number, userVote: number | null };
```

- `voteCount`: new total vote count (for UI display)
- `userVote`: current user's vote state (`1`, `-1`, or `null`)
- Frontend uses `userVote` to highlight ▲/▼ buttons

### 4.5 Self-vote Prevention

```typescript
if (answer.authorId === userId) {
  throw new BadRequestException({ code: 'CANNOT_VOTE_OWN_ANSWER' });
}
```

**Stack Overflow rule:** you cannot vote on your own post. Prevents gaming the system.

---

## 5. ANSWER DELETE — Cascade Considerations

```typescript
async delete(answerId: string, userId: string) {
  const answer = await this.prisma.answer.findUnique({ where: { id: answerId } });
  if (!answer || answer.authorId !== userId) {
    throw new ForbiddenException({ code: 'NOT_ANSWER_OWNER' });
  }

  return this.prisma.$transaction(async (tx) => {
    // 1. Unset bestAnswer if this was the best answer
    await tx.question.updateMany({
      where: { bestAnswerId: answerId },
      data: { bestAnswerId: null },
    });

    // 2. Delete the answer (cascades votes via onDelete: Cascade)
    await tx.answer.delete({ where: { id: answerId } });

    // 3. Decrement counter
    await tx.question.update({
      where: { id: answer.questionId },
      data: { answerCount: { decrement: 1 } },
    });
  });
}
```

**3 operations in transaction:**
1. **Unset bestAnswer** — nếu answer này là best answer → clear nó (question trở về "unanswered")
2. **Delete answer** — Prisma `onDelete: Cascade` trên Vote model tự xóa votes
3. **Decrement counter** — sync denormalized answerCount

**Tại sao `updateMany` thay vì `update`?**
- `updateMany` không throw nếu không match (returns `{ count: 0 }`)
- `update` throw `RecordNotFound` nếu no match
- Ở đây: answer CÓ THỂ không phải best answer → `updateMany` safe hơn

---

## 6. DENORMALIZED COUNTERS

```prisma
model Question {
  viewCount   Int @default(0)    # Incremented on findById (fire-and-forget)
  answerCount Int @default(0)    # Sync'd in create/delete answer transactions
}

model Answer {
  voteCount Int @default(0)      # Sync'd in vote transactions
}
```

**Counter sync rules:**
- **Always in transaction** with the operation that changes it
- **Exception: viewCount** — fire-and-forget (approximate metric)
- **Never COUNT(*) at query time** — read from denormalized field

---

## 7. CONTROLLER DESIGN

### 7.1 Tách QuestionsController + AnswersController

```
QuestionsController (/api/questions):
  POST   /                    → create
  GET    /                    → findAll
  GET    /similar             → findSimilar
  GET    /:id                 → findById        @Public()
  PUT    /:id                 → update
  DELETE /:id                 → delete
  POST   /:id/answers         → createAnswer
  PUT    /:id/best-answer     → markBestAnswer

AnswersController (/api/answers):
  DELETE /:id                 → delete
  POST   /:id/vote            → vote
```

**Tại sao answers có controller riêng?**
- `DELETE /api/answers/:id` — path không nằm under `/questions`
- `POST /api/answers/:id/vote` — same
- Nếu gom vào QuestionsController: routes sẽ trở thành `/api/questions/answers/:id/vote` — quá dài

**Nhưng `POST /api/questions/:id/answers` nằm trong QuestionsController:**
- Vì route nested under question ID — logical grouping
- QuestionsController inject cả AnswersService

### 7.2 Route: `similar` trước `:id`

```typescript
@Get('similar')     // Phải trước :id
async findSimilar(...)

@Get(':id')          // Nếu similar sau :id → "similar" bị match as :id
async findById(...)
```

**NestJS route matching:** first-match wins. Nếu `:id` trước `similar` → `GET /api/questions/similar` sẽ match `:id = "similar"` → ParseCuidPipe fail.
