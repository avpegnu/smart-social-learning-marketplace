# Giải thích chi tiết Phase 5.13f — Q&A Forum & AI Tutor

## 1. Tổng quan

Phase 5.13f implement 2 tính năng cốt lõi của nền tảng:

**Q&A Forum** — Diễn đàn hỏi đáp giữa các học viên và giảng viên. Học viên đặt câu hỏi, gửi code snippet, vote câu trả lời, và chọn "best answer". Tương tự Stack Overflow nhưng gắn với khóa học.

**AI Tutor** — Trợ lý AI chat thông minh, sử dụng RAG (Retrieval-Augmented Generation) để trả lời câu hỏi dựa trên nội dung khóa học đã đăng ký. Sử dụng SSE (Server-Sent Events) để stream response từ AI từng token một, tạo trải nghiệm chat tức thời.

### Kiến trúc 3 tầng (Services -> Hooks -> Components)

```
[Frontend Components]   — UI components (pages, cards, forms)
        |
   [Shared Hooks]       — TanStack Query hooks (useQuestions, useAiQuota...)
        |
  [Shared Services]     — API call functions (qnaService, aiTutorService)
        |
   [API Client]         — apiClient.get/post/streamFetch
        |
  [Backend API]         — NestJS Controllers -> Services -> Prisma -> DB
```

Mô hình này tách biệt rõ ràng:
- **Services** (`packages/shared-hooks/src/services/`): Định nghĩa các hàm gọi API thuần túy, không chứa logic UI
- **Hooks** (`packages/shared-hooks/src/queries/`): Bọc service vào TanStack Query, quản lý cache, invalidation, optimistic updates
- **Components** (`apps/student-portal/src/components/`): Chỉ xử lý UI, nhận data từ hooks

---

## 2. Q&A Forum — Flow chi tiết

### 2.1 Xem danh sách câu hỏi (`/qna`)

**File:** `apps/student-portal/src/app/[locale]/(main)/qna/page.tsx`

**UI bao gồm:**
- Header với tiêu đề "Hỏi đáp" và nút "Đặt câu hỏi" (link đến `/qna/ask`)
- Thanh tìm kiếm với icon Search, debounce 500ms
- Tabs: "Mới nhất" (recent) và "Chưa trả lời" (unanswered)
- Danh sách `QuestionCard` render từng câu hỏi
- Pagination (Trước / Tiếp) khi có nhiều trang

**Flow data:**

```typescript
// 1. State management
const [search, setSearch] = useState('');
const [tab, setTab] = useState<TabValue>('recent');
const [page, setPage] = useState(1);
const debouncedSearch = useDebounce(search, 500);

// 2. Build query params
const params = {
  page,
  limit: 20,
  search: debouncedSearch || undefined,
  status: tab === 'unanswered' ? 'unanswered' : 'all',
};

// 3. Call API via hook
const { data: raw, isLoading } = useQuestions(params);
```

**API call:** `GET /questions?page=1&limit=20&search=xxx&status=unanswered`

**Backend — `QuestionsService.findAll()`:**

```typescript
async findAll(query: QueryQuestionsDto) {
  const where: Prisma.QuestionWhereInput = {
    ...(query.courseId && { courseId: query.courseId }),
    ...(query.search && {
      OR: [
        { title: { contains: query.search, mode: 'insensitive' } },
        { content: { contains: query.search, mode: 'insensitive' } },
      ],
    }),
    ...(query.status === 'answered' && { bestAnswerId: { not: null } }),
    ...(query.status === 'unanswered' && { bestAnswerId: null }),
  };

  const [questions, total] = await Promise.all([
    this.prisma.question.findMany({
      where,
      include: {
        author: { select: AUTHOR_SELECT },
        course: { select: { id: true, title: true } },
        tag: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: query.skip,
      take: query.limit,
    }),
    this.prisma.question.count({ where }),
  ]);

  return createPaginatedResult(data, total, query.page, query.limit);
}
```

Điểm đặc biệt:
- `Promise.all` chạy song song `findMany` và `count` để tối ưu performance
- Filter `status` map thành `bestAnswerId: null` hoặc `{ not: null }` — không dùng field riêng
- Thêm `hasBestAnswer: !!q.bestAnswerId` vào response để frontend dễ kiểm tra
- `AUTHOR_SELECT` chỉ lấy 3 field `{id, fullName, avatarUrl}` để giảm data transfer

**Response format:**
```json
{
  "data": [
    {
      "id": "clx...",
      "title": "Lam sao de...",
      "content": "...",
      "answerCount": 3,
      "viewCount": 42,
      "bestAnswerId": "clx...",
      "hasBestAnswer": true,
      "createdAt": "2026-03-23T...",
      "author": { "id": "...", "fullName": "Nguyen Van A", "avatarUrl": "..." },
      "course": { "id": "...", "title": "React Basics" },
      "tag": null
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 }
}
```

**Component `QuestionCard`:**

File: `apps/student-portal/src/components/qna/question-card.tsx`

Hiển thị:
- Badge "Đã giải quyết" (màu xanh lá) khi `hasBestAnswer === true`
- Tiêu đề câu hỏi (line-clamp-2)
- Nội dung preview (line-clamp-2)
- Badge khóa học và tag (nếu có)
- Author avatar + tên, thời gian tương đối, số answers, số views
- Badge số lượng answers ở bên phải với 3 trạng thái màu:
  - Xanh lá (success): đã có best answer
  - Xanh dương (primary): có answers nhưng chưa chọn best
  - Xám (muted): chưa có answer

```typescript
const resolved = question.hasBestAnswer ?? !!question.bestAnswerId;
```

Dùng `??` để fallback về `bestAnswerId` nếu `hasBestAnswer` không có trong response.

---

### 2.2 Đặt câu hỏi (`/qna/ask`)

**File:** `apps/student-portal/src/app/[locale]/(main)/qna/ask/page.tsx`

**UI Form bao gồm:**
- Input tiêu đề (max 200 ký tự, min 10)
- Textarea nội dung (max 5000 ký tự, min 20)
- Dropdown khóa học liên quan (từ danh sách enrolled courses)
- Button "Thêm đoạn code" — toggle hiện code editor
- Code editor: dropdown ngôn ngữ + textarea font mono
- Card "Câu hỏi tương tự" — hiện khi đang gõ tiêu đề

**Validation:**
- Frontend: check trực tiếp `title.length >= 10` và `content.length >= 20`
- Backend DTO:
```typescript
export class CreateQuestionDto {
  @IsString() @MinLength(10) @MaxLength(200) title!: string;
  @IsString() @MinLength(20) @MaxLength(5000) content!: string;
  @IsOptional() @IsString() courseId?: string;
  @IsOptional() @IsString() tagId?: string;
  @IsOptional() @ValidateNested() @Type(() => CodeSnippetDto) codeSnippet?: CodeSnippetDto;
}
```

**Similar questions — debounce 500ms:**

```typescript
const debouncedTitle = useDebounce(title, 500);
const { data: similarRaw } = useSimilarQuestions(debouncedTitle);
```

Hook `useSimilarQuestions` chỉ enable khi `title.length >= 10`:

```typescript
export function useSimilarQuestions(title: string) {
  return useQuery({
    queryKey: ['questions', 'similar', title],
    queryFn: () => qnaService.findSimilar(title),
    enabled: title.length >= 10,
    staleTime: 5000,
  });
}
```

Backend `findSimilar` lấy 3 từ đầu tiên của title để tìm kiếm:

```typescript
async findSimilar(title: string, limit = 5) {
  const searchTerms = title.split(' ').slice(0, 3).join(' ');
  return this.prisma.question.findMany({
    where: { title: { contains: searchTerms, mode: 'insensitive' } },
    select: { id: true, title: true, answerCount: true, bestAnswerId: true },
    take: limit,
  });
}
```

**Submit flow:**

```
User click "Đăng câu hỏi"
  -> createQuestion.mutate({ title, content, courseId, codeSnippet })
  -> POST /questions
  -> QuestionsService.create() — INSERT into questions table
  -> onSuccess: redirect to /qna/{newId}
```

```typescript
createQuestion.mutate(
  { title, content, courseId: courseId || undefined, codeSnippet: ... },
  {
    onSuccess: (raw) => {
      const result = raw as { data?: { id: string } };
      const newId = result?.data?.id;
      if (newId) router.push(`/qna/${newId}`);
      else router.push('/qna');
    },
  },
);
```

---

### 2.3 Xem chi tiết câu hỏi (`/qna/[questionId]`)

**File:** `apps/student-portal/src/app/[locale]/(main)/qna/[questionId]/page.tsx`

**API:** `GET /questions/:id`

**Backend — `QuestionsService.findById()`:**

```typescript
async findById(questionId: string, viewerId?: string) {
  const question = await this.prisma.question.findUnique({
    where: { id: questionId },
    include: {
      author: { select: AUTHOR_SELECT },
      course: { select: { id: true, title: true } },
      tag: { select: { id: true, name: true } },
      answers: {
        include: {
          author: { select: AUTHOR_SELECT },
          votes: viewerId
            ? { where: { userId: viewerId }, select: { value: true } }
            : false,
        },
        orderBy: { voteCount: 'desc' },
      },
      bestAnswer: { include: { author: { select: AUTHOR_SELECT } } },
    },
  });
```

**Điểm quan trọng:**
- `answers` được sắp xếp theo `voteCount: 'desc'` — answer nhiều vote nhất lên đầu
- `votes` chỉ include vote của viewer hiện tại (`where: { userId: viewerId }`) để biết user đã vote gì
- Map `userVote` từ mảng `votes`:

```typescript
const answers = question.answers.map((answer) => {
  const { votes, ...rest } = answer;
  return { ...rest, userVote: votes?.[0]?.value ?? null };
});
```

**Unique view tracking với Redis SET:**

```typescript
if (viewerId) {
  const viewKey = `qview:${questionId}`;
  this.redis.sadd(viewKey, viewerId)
    .then(async (added) => {
      if (added === 1) {
        // Set TTL 30 ngày nếu chưa có
        const ttl = await this.redis.ttl(viewKey);
        if (ttl === -1) await this.redis.expire(viewKey, 30 * 24 * 3600);
        // Increment view count trong DB
        await this.prisma.question.update({
          where: { id: questionId },
          data: { viewCount: { increment: 1 } },
        });
      }
    })
    .catch(() => { /* fire-and-forget */ });
}
```

Logic:
- `sadd` trả về `1` nếu userId mới được thêm (chưa xem trước đó)
- `sadd` trả về `0` nếu userId đã tồn tại (đã xem rồi) -> không tăng viewCount
- TTL 30 ngày -> sau 30 ngày, cùng user xem lại sẽ tăng viewCount
- Fire-and-forget: không `await` -> response trả về ngay, view tracking chạy ngầm

**Frontend layout:**
- Bên trái (flex-1): nội dung câu hỏi + danh sách answers + form trả lời
- Bên phải (w-80, ẩn trên mobile): sidebar "Câu hỏi liên quan"
- Nút xóa chỉ hiện cho question owner
- Form trả lời chỉ hiện khi đã đăng nhập

---

### 2.4 Trả lời câu hỏi

**Component:** `apps/student-portal/src/components/qna/answer-form.tsx`

Form đơn giản:
- Textarea nội dung
- Button "Thêm đoạn code" toggle code editor
- Button "Gửi câu trả lời"

**API:** `POST /questions/:id/answers`

**Backend — `AnswersService.create()`:**

```typescript
async create(authorId: string, questionId: string, dto: CreateAnswerDto) {
  // Check question tồn tại
  const question = await this.prisma.question.findUnique({
    where: { id: questionId },
  });
  if (!question) throw new NotFoundException({ code: 'QUESTION_NOT_FOUND' });

  // Transaction: create answer + increment question.answerCount
  return this.prisma.$transaction(async (tx) => {
    const answer = await tx.answer.create({
      data: { content: dto.content, codeSnippet: dto.codeSnippet, authorId, questionId },
      include: { author: { select: AUTHOR_SELECT } },
    });
    await tx.question.update({
      where: { id: questionId },
      data: { answerCount: { increment: 1 } },
    });
    return answer;
  });
}
```

Tại sao dùng Transaction:
- Đảm bảo `answer.create` và `question.answerCount increment` là atomic
- Nếu 1 trong 2 fail thì rollback cả 2
- Tránh tình trạng `answerCount` sai lệch với số answer thực tế

**onSuccess:** Invalidate query `['questions', questionId]` để refetch detail + `['questions']` để update danh sách.

---

### 2.5 Vote answer

**Component:** `apps/student-portal/src/components/qna/vote-buttons.tsx`

UI: 2 nút ChevronUp/ChevronDown + số vote ở giữa:
- Click up khi chưa vote -> value = 1 (upvote)
- Click up khi đã upvote -> value = 0 (remove vote)
- Click down khi chưa vote -> value = -1 (downvote)
- Click down khi đã downvote -> value = 0 (remove vote)

```typescript
<button onClick={() => onVote(userVote === 1 ? 0 : 1)}>
  <ChevronUp />
</button>
<span>{voteCount}</span>
<button onClick={() => onVote(userVote === -1 ? 0 : -1)}>
  <ChevronDown />
</button>
```

**Optimistic update trong AnswerCard:**

```typescript
function handleVote(value: number) {
  const prev = localVote;
  const prevCount = localVoteCount;

  // Optimistic: cập nhật UI ngay
  if (value === 0) {
    setLocalVote(null);
    setLocalVoteCount(prevCount - (prev ?? 0));
  } else {
    setLocalVote(value);
    setLocalVoteCount(prevCount - (prev ?? 0) + value);
  }

  // Gửi API
  voteAnswer.mutate(
    { answerId: answer.id, value, questionId },
    {
      onError: () => {
        // Rollback nếu API fail
        setLocalVote(prev);
        setLocalVoteCount(prevCount);
      },
    },
  );
}
```

**API:** `POST /answers/:id/vote { value: 1|-1|0 }`

**Backend — `AnswersService.vote()`:**

```typescript
async vote(userId: string, answerId: string, value: number) {
  // Không cho vote answer của chính mình
  if (answer.authorId === userId) {
    throw new BadRequestException({ code: 'CANNOT_VOTE_OWN_ANSWER' });
  }

  const existing = await this.prisma.vote.findUnique({
    where: { userId_answerId: { userId, answerId } },
  });

  // Case 1: Remove vote (value=0 hoặc click lại cùng nút)
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

  // Case 2: Change vote (từ up -> down hoặc ngược lại)
  if (existing) {
    await this.prisma.$transaction([
      this.prisma.vote.update({ where: { id: existing.id }, data: { value } }),
      this.prisma.answer.update({
        where: { id: answerId },
        data: { voteCount: { increment: value * 2 } },
        // value * 2 vì cần trừ vote cũ + cộng vote mới (vd: -1 -> +1 = tăng 2)
      }),
    ]);
    return { voteCount: answer.voteCount + value * 2, userVote: value };
  }

  // Case 3: Vote mới
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

**VoteDto validation:**
```typescript
export class VoteDto {
  @IsInt() @Min(-1) @Max(1) value!: number; // +1 upvote, -1 downvote, 0 remove
}
```

---

### 2.6 Mark best answer

Trong `AnswerCard`, nút "Chọn làm câu trả lời tốt nhất" chỉ hiện khi `canMarkBest && !isBestAnswer`:

```typescript
{canMarkBest && !isBestAnswer && (
  <button onClick={() => markBest.mutate({ questionId, answerId: answer.id })}>
    <CheckCircle2 />
    <span>{t('markBest')}</span>
  </button>
)}
```

**API:** `PUT /questions/:id/best-answer { answerId }`

**Backend — `QuestionsService.markBestAnswer()`:**

```typescript
async markBestAnswer(questionId: string, answerId: string, userId: string) {
  const question = await this.prisma.question.findUnique({
    where: { id: questionId },
    include: { course: { select: { instructorId: true } } },
  });

  // Authorization: chỉ question owner HOẶC course instructor
  const isOwner = question.authorId === userId;
  const isInstructor = question.course?.instructorId === userId;
  if (!isOwner && !isInstructor) {
    throw new ForbiddenException({ code: 'NOT_AUTHORIZED_TO_MARK_BEST' });
  }

  // Check answer thuộc về question này
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

---

### 2.7 Delete question/answer

**Delete question:**

```typescript
// Frontend: ConfirmDialog -> deleteQuestion.mutate(question.id)
// Backend: QuestionsService.delete() — kiểm tra authorId === userId rồi delete
```

**Delete answer — có Transaction:**

```typescript
async delete(answerId: string, userId: string) {
  const answer = await this.prisma.answer.findUnique({ where: { id: answerId } });
  if (!answer || answer.authorId !== userId) {
    throw new ForbiddenException({ code: 'NOT_ANSWER_OWNER' });
  }

  return this.prisma.$transaction(async (tx) => {
    // 1. Unset bestAnswer nếu answer này đang là best
    await tx.question.updateMany({
      where: { bestAnswerId: answerId },
      data: { bestAnswerId: null },
    });
    // 2. Delete answer
    await tx.answer.delete({ where: { id: answerId } });
    // 3. Giảm answerCount
    await tx.question.update({
      where: { id: answer.questionId },
      data: { answerCount: { decrement: 1 } },
    });
  });
}
```

3 bước trong 1 transaction:
- Nếu answer là best answer -> unset `bestAnswerId` trên question
- Delete answer record
- Giảm `answerCount` trên question

---

## 3. AI Tutor — Flow chi tiết

### 3.1 Kiến trúc SSE Streaming

**Server-Sent Events (SSE)** là giao thức one-way từ server -> client qua HTTP. Khác với WebSocket (two-way), SSE đơn giản hơn và dùng cho các trường hợp server cần push data liên tục.

**So sánh:**

| Tiêu chí | SSE | WebSocket | Polling |
|----------|-----|-----------|---------|
| Hướng | Server -> Client | Two-way | Client -> Server |
| Protocol | HTTP | ws:// | HTTP |
| Auto-reconnect | Có (built-in) | Không | N/A |
| Phù hợp cho | Stream text, logs | Chat, game | Simple updates |

**Tại sao chọn SSE cho AI chat:**
- AI response chỉ cần 1 chiều (server -> client)
- Mỗi token được gửi ngay khi có, tạo hiệu ứng "đang gõ"
- Không cần WebSocket connection riêng, tiết kiệm resource
- HTTP/2 multiplexing hỗ trợ nhiều SSE stream trên 1 connection

**Backend SSE setup:**

```typescript
@Post('ask-stream')
async askStream(@CurrentUser() user: JwtPayload, @Body() dto: AskQuestionDto, @Res() res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  for await (const event of this.service.askQuestionStream(user.sub, dto)) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
  res.end();
}
```

Mỗi event được gửi theo format SSE: `data: {...}\n\n`

**4 loại event:**

```typescript
export type StreamEvent =
  | { type: 'start'; sessionId: string }     // Session đã tạo/lấy
  | { type: 'token'; content: string }        // 1 token từ AI
  | { type: 'done'; messageId: string; sessionId: string }  // Hoàn tất
  | { type: 'error'; code: string };          // Lỗi
```

---

### 3.2 RAG Pipeline (Retrieval-Augmented Generation)

RAG là kỹ thuật kết hợp retrieval (tìm kiếm) với generation (sinh text). Thay vì AI trả lời từ "kiến thức chung", ta cung cấp nội dung khóa học liên quan để AI trả lời chính xác hơn.

**Pipeline:**

```
User question
    |
    v
[1] Generate embedding của question (384 dims)
    |
    v
[2] Cosine similarity search trong course_chunks table (pgvector)
    |
    v
[3] Lấy top 5 chunks có similarity cao nhất
    |
    v
[4] Thêm vào system prompt: "Course Context: {chunks}"
    |
    v
[5] Gửi đến Groq API cùng với conversation history
    |
    v
[6] AI trả lời dựa trên context
```

**pgvector extension + migration:**

File: `apps/api/src/prisma/migrations/20260323000000_add_pgvector_embedding/migration.sql`

```sql
-- Enable pgvector extension (supported by Neon.tech)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to course_chunks table
ALTER TABLE course_chunks ADD COLUMN IF NOT EXISTS embedding vector(384);
```

- `vector(384)` — kiểu dữ liệu vector với 384 chiều (dimensions)
- `384` là kích thước output của model `all-MiniLM-L6-v2`
- Neon.tech (PostgreSQL hosting) hỗ trợ pgvector native

**EmbeddingsService — Model và Indexing:**

File: `apps/api/src/modules/ai-tutor/embeddings/embeddings.service.ts`

```typescript
@Injectable()
export class EmbeddingsService implements OnModuleInit {
  private embedder: unknown = null;

  async onModuleInit() {
    // Load model Xenova/all-MiniLM-L6-v2 khi server khởi động
    const { pipeline } = await import('@huggingface/transformers');
    this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const output = await embedFn(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }
}
```

- `OnModuleInit`: model được load 1 lần khi server start, không load lại mỗi request
- `Xenova/all-MiniLM-L6-v2`: model embedding nhẹ (~23MB), chạy được trên CPU
- Output: mảng 384 số thực, đại diện cho "ý nghĩa" của text

**Course content indexing:**

```typescript
async indexCourseContent(courseId: string) {
  // Xóa chunks cũ
  await this.prisma.$executeRaw`DELETE FROM course_chunks WHERE course_id = ${courseId}`;

  // Lấy tất cả text lessons
  const lessons = await this.prisma.lesson.findMany({
    where: { chapter: { section: { courseId } }, type: 'TEXT' },
    select: { id: true, title: true, textContent: true },
  });

  for (const lesson of lessons) {
    const content = `${lesson.title}\n${lesson.textContent ?? ''}`;
    // Chia text thành các chunks 500 ký tự, overlap 50
    const chunks = this.chunkText(content, 500, 50);

    for (const chunk of chunks) {
      const embedding = await this.generateEmbedding(chunk);
      await this.prisma.$executeRaw`
        INSERT INTO course_chunks (id, course_id, lesson_id, content, embedding, created_at)
        VALUES (gen_random_uuid(), ${courseId}, ${lesson.id}, ${chunk}, ${embeddingStr}::vector, now())
      `;
    }
  }
}
```

- `chunkText(text, 500, 50)`: chia text thành các đoạn 500 ký tự, overlap 50 ký tự giữa các đoạn để không mất context ở ranh giới
- Mỗi chunk được generate embedding riêng và lưu vào `course_chunks` table

**Retrieval — Cosine similarity search:**

```typescript
private async retrieveContext(courseId: string, question: string): Promise<string> {
  const queryEmbedding = await this.embeddingsService.generateEmbedding(question);
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  const chunks = await this.prisma.$queryRaw`
    SELECT content, 1 - (embedding <=> ${embeddingStr}::vector) AS similarity
    FROM course_chunks
    WHERE course_id = ${courseId}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT 5
  `;

  return chunks.map((c) => c.content).join('\n\n---\n\n');
}
```

- `<=>` là cosine distance operator của pgvector
- `1 - distance = similarity` (0 đến 1, 1 = giống nhất)
- Lấy top 5 chunks giống nhất với câu hỏi
- Join các chunks bằng `---` để tạo context string

---

### 3.3 Chọn khóa học & sessions

**File:** `apps/student-portal/src/app/[locale]/(fullscreen)/ai-tutor/page.tsx`

**UI có 2 phần chính:**
- **Sidebar** (trái): chọn khóa học, danh sách sessions, usage counter
- **Chat panel** (phải): messages, input box

**Course selector:**

```typescript
const { data: learningRaw } = useMyLearning();
const enrolledCourses = (learningData?.data ?? []).map((e) => e.course);
```

Chỉ hiện các khóa học mà user đã đăng ký (enrolled). Khi chọn khóa học:
- `setSelectedCourseId(courseId)` -> trigger `useAiSessions(courseId)`
- Reset `activeSessionId` và `localMessages`

**Sessions list:**

```typescript
const { data: sessionsRaw } = useAiSessions(selectedCourseId || undefined);
```

API: `GET /ai/tutor/sessions?courseId=xxx`

Backend trả về danh sách sessions sắp xếp theo `updatedAt: 'desc'`, include `_count: { select: { messages: true } }`.

**SessionSidebar component:**

File: `apps/student-portal/src/components/ai-tutor/session-sidebar.tsx`

Bao gồm:
- Bot icon + tiêu đề "AI Tutor"
- Dropdown chọn khóa học
- Button "Hội thoại mới"
- Usage counter với Progress bar: `{usageCount}/{dailyLimit}`
- Danh sách sessions với title, số messages, thời gian
- Disclaimer: "AI có thể mắc lỗi..."

---

### 3.4 Gửi câu hỏi (streaming flow) — COMPLETE step by step

**Bước 1: User gõ câu hỏi, nhấn Enter**

```typescript
function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}
```

Shift+Enter = xuống dòng, Enter = gửi.

**Bước 2: Frontend — thêm user message vào local state, hiện thinking dots**

```typescript
const userMsg: ChatMsg = { id: `local-${Date.now()}`, role: 'USER', content: question };
setMessages((prev) => [...prev, userMsg]);
setIsThinking(true);
setIsStreaming(true);
setStreamingContent('');
shouldScrollRef.current = true;
```

ID tạm `local-${Date.now()}` vì chưa có ID từ server.

**Bước 3: Frontend — fetch SSE stream**

```typescript
const response = await aiTutorService.askStream({
  courseId: selectedCourseId,
  sessionId: activeSessionId ?? undefined,
  question,
});
```

Gọi `apiClient.streamFetch()`:

```typescript
async streamFetch(path: string, body?: unknown): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(this.accessToken && { Authorization: `Bearer ${this.accessToken}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
```

Trả về raw `Response` (KHÔNG parse JSON) để đọc stream.

**Bước 4: Backend gate 1 — Redis rate limit check**

```typescript
const dateKey = new Date().toISOString().slice(0, 10); // "2026-03-23"
const limitKey = `ai_limit:${userId}:${dateKey}`;
const allowed = await this.redis.checkRateLimit(limitKey, 10, 86400);
if (!allowed) throw new BadRequestException({ code: 'AI_DAILY_LIMIT_REACHED' });
```

`checkRateLimit` dùng Redis INCR + EXPIRE:
```typescript
async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const current = await this.incr(key);
  if (current === 1) await this.expire(key, windowSeconds);
  return current <= limit;
}
```

- INCR atomic: tăng và trả về giá trị mới
- Lần đầu (current === 1): set TTL = 86400s (1 ngày)
- Nếu current > 10: return false -> throw exception

**Bước 5: Backend gate 2 — enrollment check**

```typescript
const enrollment = await this.prisma.enrollment.findFirst({
  where: { userId, courseId: dto.courseId },
});
if (!enrollment) throw new ForbiddenException({ code: 'ENROLLMENT_REQUIRED' });
```

Chỉ cho phép hỏi về khóa học đã đăng ký.

**Bước 6: Backend — get/create session**

```typescript
const session = dto.sessionId
  ? await this.getSession(dto.sessionId, userId)  // Lấy session cũ
  : await this.createSession(userId, dto.courseId, dto.question);  // Tạo mới
```

`createSession` tạo session với title = 47 ký tự đầu của câu hỏi + "...":

```typescript
private async createSession(userId: string, courseId: string, firstQuestion: string) {
  const title = firstQuestion.length > 50 ? firstQuestion.slice(0, 47) + '...' : firstQuestion;
  return this.prisma.aiChatSession.create({ data: { userId, courseId, title } });
}
```

**yield `{ type: 'start', sessionId }`**

**Bước 7: Backend — RAG context retrieval**

```typescript
const context = await this.retrieveContext(dto.courseId, dto.question);
```

Generate embedding của câu hỏi -> cosine search trong course_chunks -> lấy top 5.

**Bước 8: Backend — build messages array**

```typescript
const history = await this.prisma.aiChatMessage.findMany({
  where: { sessionId: session.id },
  orderBy: { createdAt: 'asc' },
  take: 10,
});
const messages = this.buildMessages(context, history, dto.question);
```

```typescript
private buildMessages(context, history, question) {
  const systemPrompt = `You are an AI tutor for an online course. Answer based on the course content provided below.
If the answer is not in the course content, say so honestly. Be helpful, educational, and encouraging.
Always answer in the same language the student asks in.

Course Context:
${context}`;

  return [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role.toLowerCase(), content: m.content })),
    { role: 'user', content: question },
  ];
}
```

- System prompt chứa context từ RAG + instructions
- History: 10 tin nhắn gần nhất của session
- User question cuối cùng

**Bước 9: Backend — save user message to DB**

```typescript
await this.prisma.aiChatMessage.create({
  data: { sessionId: session.id, role: 'USER', content: dto.question },
});
```

**Bước 10: Backend — Groq API stream**

```typescript
const stream = await this.groq.chat.completions.create({
  model: 'llama-3.3-70b-versatile',
  messages,
  max_tokens: 2048,
  temperature: 0.7,
  stream: true,
});
```

- `stream: true` -> Groq trả về AsyncIterable của chunks
- `temperature: 0.7` -> cân bằng giữa creativity và accuracy
- `max_tokens: 2048` -> giới hạn độ dài response

**Bước 11: Backend — yield token events**

```typescript
let fullAnswer = '';
for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    fullAnswer += content;
    yield { type: 'token', content };
    // Dev mode: slow down để thấy hiệu ứng streaming
    if (isDev) await new Promise((r) => setTimeout(r, 30));
  }
}
```

**Bước 12: Backend — save assistant message**

```typescript
const savedMessage = await this.prisma.aiChatMessage.create({
  data: { sessionId: session.id, role: 'ASSISTANT', content: fullAnswer },
});
```

**Bước 13: Backend — yield done event**

```typescript
yield { type: 'done', messageId: savedMessage.id, sessionId: session.id };
```

**Bước 14: Frontend — process SSE events**

```typescript
const reader = response.body?.getReader();
const decoder = new TextDecoder();
let buffer = '';
let fullContent = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? ''; // Giữ lại dòng cuối chưa hoàn chỉnh

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const event = JSON.parse(line.slice(6));

    switch (event.type) {
      case 'start':
        if (!activeSessionId && event.sessionId) setActiveSessionId(event.sessionId);
        break;
      case 'token':
        setIsThinking(false);          // Tắt thinking dots
        fullContent += event.content;
        setStreamingContent(fullContent); // Cập nhật streaming text
        break;
      case 'done':
        setMessages((prev) => [
          ...prev,
          { id: event.messageId, role: 'ASSISTANT', content: fullContent },
        ]);
        setStreamingContent('');
        setIsStreaming(false);
        queryClient.invalidateQueries({ queryKey: ['ai-tutor'] });
        break;
      case 'error':
        setIsThinking(false);
        setIsStreaming(false);
        toast.error(t(`errors.${event.code ?? 'INTERNAL_ERROR'}`));
        break;
    }
  }
}
```

**Buffer handling:** SSE data có thể đến không đầy đủ (1 line có thể bị cắt giữa 2 chunk). `buffer = lines.pop() ?? ''` giữ lại phần chưa hoàn chỉnh để ghép với chunk tiếp theo.

---

### 3.5 Quota management

**Backend:**

```typescript
async getQuota(userId: string) {
  const dateKey = new Date().toISOString().slice(0, 10);
  const limitKey = `ai_limit:${userId}:${dateKey}`;
  const used = Number(await this.redis.get(limitKey)) || 0;
  return { used, limit: 10, remaining: Math.max(0, 10 - used) };
}
```

Key format: `ai_limit:{userId}:{YYYY-MM-DD}` — reset tự động mỗi ngày vì key tự hết hạn sau 86400s.

**Frontend:**

```typescript
const { data: quotaRaw } = useAiQuota();
const usageCount = quota?.used ?? 0;

// Hiển thị trong SessionSidebar
<Progress value={(usageCount / dailyLimit) * 100} className="h-1.5" />
<span>{usageCount}/{dailyLimit}</span>

// Hiển thị trong ChatPanel
<p>{t('usageRemaining', { count: Math.max(0, dailyLimit - usageCount), limit: dailyLimit })}</p>

// Block gửi khi hết quota
const canSend = input.trim().length > 0 && !isStreaming && usageCount < dailyLimit;
{usageCount >= dailyLimit && (
  <div className="bg-destructive/10 text-destructive">
    {t('usageLimitReached')}
  </div>
)}
```

---

### 3.6 Markdown rendering

**File:** `apps/student-portal/src/components/ai-tutor/markdown-renderer.tsx`

```typescript
export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none wrap-break-word">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlock,
          a: ({ children, ...props }) => (
            <a {...props} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

- `react-markdown` + `remark-gfm` (GitHub Flavored Markdown: tables, strikethrough, task lists...)
- `prose prose-sm dark:prose-invert`: Tailwind Typography plugin, tự động style headings, lists, blockquotes...
- Custom `code` component với nút Copy:

```typescript
function CodeBlock({ className, children }) {
  const match = /language-(\w+)/.exec(className ?? '');
  // Inline code: không có language -> render `<code>` đơn giản
  if (!match) return <code className="bg-muted rounded px-1.5 py-0.5">{children}</code>;

  // Code block: có language -> render container với nút Copy
  return (
    <div className="bg-muted group relative my-3 overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between px-3 py-1.5">
        <Badge>{language}</Badge>
        <button onClick={handleCopy}>{copied ? <Check /> : <Copy />}</button>
      </div>
      <pre><code>{children}</code></pre>
    </div>
  );
}
```

---

## 4. Thay đổi code chi tiết

### 4.1 Backend changes

#### `apps/api/src/modules/qna/questions/questions.controller.ts`
- **Mục đích:** HTTP layer cho Q&A questions
- 7 endpoints: create, findAll, findSimilar, findById, update, delete, markBestAnswer
- `createAnswer` endpoint nằm ở đây (POST `/questions/:id/answers`) vì RESTful
- `@Public()` decorator cho findAll, findSimilar, findById — cho phép anonymous access
- `@CurrentUser()` optional trong findById để lấy viewerId cho view tracking

#### `apps/api/src/modules/qna/questions/questions.service.ts`
- **Mục đích:** Business logic cho questions
- Dùng `PrismaService` và `RedisService` (cho view tracking)
- `AUTHOR_SELECT` constant dùng chung cho tất cả queries — chỉ lấy 3 fields
- `findAll`: dynamic where clause bằng spread operator
- `findById`: Prisma nested include + Redis SET view tracking
- `findSimilar`: simple text search với 3 từ đầu tiên
- `markBestAnswer`: dual authorization (owner OR instructor)

#### `apps/api/src/modules/qna/answers/answers.controller.ts`
- **Mục đích:** HTTP layer cho answers (chỉ delete và vote)
- Create answer nằm ở QuestionsController (POST `/questions/:id/answers`)
- `@ApiBearerAuth()` trên class level — tất cả endpoints cần auth

#### `apps/api/src/modules/qna/answers/answers.service.ts`
- **Mục đích:** Business logic cho answers
- `create`: transaction đảm bảo answer.create + question.answerCount atomic
- `delete`: 3-step transaction (unset bestAnswer + delete + decrement count)
- `vote`: 3 cases xử lý (remove, change, new) với math chính xác

#### DTOs
- `create-question.dto.ts`: title (10-200), content (20-5000), optional courseId, tagId, codeSnippet
- `create-answer.dto.ts`: content (1-5000), optional codeSnippet (reuse `CodeSnippetDto`)
- `update-question.dto.ts`: các field giống create nhưng tất cả optional
- `query-questions.dto.ts`: extends PaginationDto, thêm courseId, instructorId, tagId, search, status
- `vote.dto.ts`: value (int, -1 đến 1)

#### `apps/api/src/modules/ai-tutor/ai-tutor.controller.ts`
- **Mục đích:** HTTP layer cho AI Tutor
- `ask`: non-streaming endpoint (fallback)
- `ask-stream`: SSE streaming endpoint — set headers manually, iterate AsyncGenerator
- `getQuota`: GET endpoint trả về daily usage
- `getSessions`: list sessions, optional filter theo courseId
- `getSessionMessages`: lấy tin nhắn của 1 session
- Error handling trong SSE: catch exception, gửi `{ type: 'error' }` event

#### `apps/api/src/modules/ai-tutor/ai-tutor.service.ts`
- **Mục đích:** Core business logic cho AI Tutor
- `StreamEvent` type union cho 4 loại event
- `askQuestion`: non-streaming version, gọi Groq API không có `stream: true`
- `askQuestionStream`: AsyncGenerator function (`async *`), yield từng event
- Rate limit 10 requests/day/user bằng Redis
- Enrollment check trước khi cho phép hỏi
- RAG context retrieval bằng pgvector cosine search
- Conversation history: 10 messages gần nhất
- Session title: lấy 47 ký tự đầu của first question
- Dev mode: delay 30ms giữa các token để thấy hiệu ứng streaming

#### `apps/api/src/modules/ai-tutor/embeddings/embeddings.service.ts`
- **Mục đích:** Quản lý embedding model và course indexing
- `OnModuleInit`: load model `Xenova/all-MiniLM-L6-v2` khi server khởi động
- `generateEmbedding`: chuyển text thành vector 384 chiều
- `indexCourseContent`: chia nội dung khóa học thành chunks, generate embedding, lưu vào DB
- `chunkText`: sliding window 500 ký tự, overlap 50

#### Migration
- `20260323000000_add_pgvector_embedding/migration.sql`: enable pgvector extension + thêm embedding column `vector(384)`

---

### 4.2 Shared layer (services + hooks)

#### `packages/shared-hooks/src/services/qna.service.ts`
- **Mục đích:** API call functions cho Q&A
- Interface definitions: `QueryQuestionsParams`, `CreateQuestionData`, `UpdateQuestionData`
- `toQuery` helper: chuyển params thành Record<string, string> cho URL query
- 9 methods: getQuestions, getQuestionDetail, findSimilar, createQuestion, updateQuestion, deleteQuestion, createAnswer, deleteAnswer, markBestAnswer, voteAnswer
- Kết nối: Frontend hooks gọi các function này

#### `packages/shared-hooks/src/services/ai-tutor.service.ts`
- **Mục đích:** API call functions cho AI Tutor
- `askStream`: gọi `apiClient.streamFetch()` — trả về raw Response
- `ask`: non-streaming fallback, gọi `apiClient.post()`
- 3 GET methods: getQuota, getSessions, getSessionMessages
- Kết nối: `ChatPanel` gọi trực tiếp `aiTutorService.askStream()`

#### `packages/shared-hooks/src/queries/use-qna.ts`
- **Mục đích:** TanStack Query hooks cho Q&A
- 7 hooks: useQuestions, useQuestionDetail, useSimilarQuestions, useCreateQuestion, useUpdateQuestion, useDeleteQuestion, useCreateAnswer, useDeleteAnswer, useMarkBestAnswer, useVoteAnswer
- `useSimilarQuestions`: `enabled: title.length >= 10`, `staleTime: 5000`
- Tất cả mutations có `onSuccess` invalidate related queries
- `useApiError` hook map error codes thành localized messages

#### `packages/shared-hooks/src/queries/use-ai-tutor.ts`
- **Mục đích:** TanStack Query hooks cho AI Tutor
- 3 hooks: useAiQuota, useAiSessions, useSessionMessages
- `useSessionMessages`: `enabled: !!sessionId` — chỉ fetch khi có sessionId
- KHÔNG có mutation hook cho `askStream` vì nó xử lý SSE stream trực tiếp, không phù hợp với useMutation pattern

#### `packages/shared-api-client/src/client.ts` — `streamFetch` method
- **Mục đích:** Raw fetch cho SSE streaming
- Trả về `Response` thay vì parsed JSON
- Không auto-handle 401 refresh (vì SSE connection cần xử lý khác)
- Include `credentials: 'include'` và `Authorization` header

---

### 4.3 Frontend components

#### Q&A Components

**`apps/student-portal/src/components/qna/question-card.tsx`**
- Card hiển thị 1 câu hỏi trong danh sách
- Resolved badge (xanh lá) khi có bestAnswer
- Answer count badge với 3 trạng thái màu
- Wrap trong Link để navigate đến detail

**`apps/student-portal/src/components/qna/answer-card.tsx`**
- Card hiển thị 1 câu trả lời
- Tích hợp VoteButtons component
- Optimistic vote update với rollback on error
- Mark best answer button (chỉ hiện cho question owner)
- Delete button với ConfirmDialog (chỉ hiện cho answer owner)
- Border màu xanh khi là best answer

**`apps/student-portal/src/components/qna/answer-form.tsx`**
- Form trả lời với textarea + optional code editor
- `useCreateAnswer` hook
- Reset form on success

**`apps/student-portal/src/components/qna/vote-buttons.tsx`**
- UI: ChevronUp, số vote, ChevronDown
- Toggle logic: click cùng nút -> value = 0 (remove)
- Màu sắc: primary khi upvoted, destructive khi downvoted, muted-foreground khi chưa vote
- Vote count màu: primary (>0), destructive (<0)

**`apps/student-portal/src/components/qna/code-block.tsx`**
- Hiển thị code snippet với language badge và nút Copy
- Copy dùng `navigator.clipboard.writeText()`
- Trạng thái "Đã sao chép!" hiện 2 giây rồi ẩn

#### AI Tutor Components

**`apps/student-portal/src/components/ai-tutor/session-sidebar.tsx`**
- Course selector dropdown
- New conversation button
- Usage counter với Progress bar
- Session list với title, message count, thời gian
- Disclaimer text cuối cùng

**`apps/student-portal/src/components/ai-tutor/chat-panel.tsx`**
- **Core component** chứa toàn bộ logic SSE streaming
- Header với Bot avatar + "Powered by Llama 3.3"
- Messages list với auto-scroll
- Streaming content render realtime
- Thinking indicator (3 bouncing dots)
- Usage limit banner khi hết quota
- Input area với textarea (Enter = send, Shift+Enter = newline)
- Kết nối: gọi `aiTutorService.askStream()` trực tiếp, xử lý SSE events

**`apps/student-portal/src/components/ai-tutor/chat-message.tsx`**
- Render 1 tin nhắn (USER hoặc ASSISTANT)
- User message: bên phải, màu primary, text thuần
- Assistant message: bên trái, màu muted, render bằng MarkdownRenderer
- User avatar ở bên phải, Bot avatar ở bên trái

**`apps/student-portal/src/components/ai-tutor/markdown-renderer.tsx`**
- ReactMarkdown + remark-gfm
- Custom code block component với nút Copy
- Inline code: background muted, rounded
- Block code: container với language badge + copy button
- Prose styling với dark mode support (`dark:prose-invert`)

**`apps/student-portal/src/components/ai-tutor/streaming-indicator.tsx`**
- 3 bouncing dots với staggered animation delay (0ms, 150ms, 300ms)
- Text "Đang suy nghĩ..."
- Dùng CSS animation `animate-bounce` với `[animation-delay:]`

---

### 4.4 Frontend pages

**`apps/student-portal/src/app/[locale]/(main)/qna/page.tsx`**
- Route: `/qna` (trong (main) layout — có Navbar + Footer)
- State: search, tab, page
- Debounce search 500ms
- Render QuestionCard list + pagination

**`apps/student-portal/src/app/[locale]/(main)/qna/ask/page.tsx`**
- Route: `/qna/ask`
- Form với validation + similar questions suggestion
- Enrolled courses dropdown từ `useMyLearning()`
- Redirect đến `/qna/{id}` sau khi tạo thành công

**`apps/student-portal/src/app/[locale]/(main)/qna/[questionId]/page.tsx`**
- Route: `/qna/{questionId}`
- 2-column layout: content (left) + sidebar (right, hidden on mobile)
- Question detail + answers list + answer form
- Delete question với ConfirmDialog

**`apps/student-portal/src/app/[locale]/(fullscreen)/ai-tutor/page.tsx`**
- Route: `/ai-tutor` (trong (fullscreen) layout — KHÔNG có Footer)
- Complex state management cho streaming
- Mobile-responsive: sidebar/chat toggle

---

### 4.5 i18n keys

**Namespace `qna`:**
```json
{
  "title": "Hỏi đáp",
  "askQuestion": "Đặt câu hỏi",
  "searchPlaceholder": "Tìm kiếm câu hỏi...",
  "recent": "Mới nhất",
  "unanswered": "Chưa trả lời",
  "resolved": "Đã giải quyết",
  "noQuestions": "Không tìm thấy câu hỏi nào",
  "prev": "Trước",
  "next": "Tiếp",
  "ans": "trả lời"
}
```

**Namespace `askQuestion`:**
```json
{
  "title": "Đặt câu hỏi",
  "questionTitle": "Tiêu đề câu hỏi",
  "titlePlaceholder": "Mô tả câu hỏi rõ ràng...",
  "content": "Chi tiết",
  "relatedCourse": "Khóa học liên quan",
  "addCode": "Thêm đoạn code",
  "submit": "Đăng câu hỏi",
  "similarQuestions": "Câu hỏi tương tự",
  "titleMinLength": "Tiêu đề ít nhất 10 ký tự",
  "contentMinLength": "Chi tiết ít nhất 20 ký tự"
}
```

**Namespace `questionDetail`:**
```json
{
  "views": "lượt xem",
  "answers": "câu trả lời",
  "bestAnswer": "Câu trả lời tốt nhất",
  "markBest": "Chọn làm câu trả lời tốt nhất",
  "yourAnswer": "Câu trả lời của bạn",
  "deleteQuestion": "Xóa câu hỏi",
  "deleteAnswer": "Xóa câu trả lời",
  "confirmDelete": "Bạn có chắc chắn muốn xóa?",
  "loginToAnswer": "Đăng nhập để trả lời"
}
```

**Namespace `aiTutor`:**
```json
{
  "title": "AI Tutor",
  "newSession": "Hội thoại mới",
  "usage": "Sử dụng hôm nay",
  "poweredBy": "Powered by Llama 3.3",
  "askPlaceholder": "Hỏi về nội dung khóa học...",
  "usageRemaining": "Còn {count}/{limit} câu hỏi hôm nay",
  "usageLimitReached": "Đã hết lượt hỏi hôm nay",
  "welcomeTitle": "Chào mừng đến với AI Tutor",
  "thinking": "Đang suy nghĩ...",
  "disclaimer": "AI có thể mắc lỗi. Hãy kiểm tra thông tin quan trọng.",
  "errors": {
    "AI_DAILY_LIMIT_REACHED": "Đã hết lượt hỏi hôm nay (10/ngày)",
    "ENROLLMENT_REQUIRED": "Bạn chưa đăng ký khóa học này",
    "INTERNAL_ERROR": "Đã xảy ra lỗi, vui lòng thử lại",
    "NETWORK_ERROR": "Lỗi kết nối, vui lòng thử lại"
  }
}
```

---

### 4.6 Infrastructure (migration, layout, navbar)

**Migration `20260323000000_add_pgvector_embedding`:**
- Enable pgvector extension: `CREATE EXTENSION IF NOT EXISTS vector;`
- Thêm column `embedding vector(384)` vào bảng `course_chunks`
- Neon.tech hỗ trợ pgvector native, không cần cài đặt thêm

**Fullscreen Layout:**

File: `apps/student-portal/src/app/[locale]/(fullscreen)/layout.tsx`

```typescript
export default function FullscreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col">
      <Navbar />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
```

So sánh với Main Layout:

```typescript
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <Footer />
      <MobileNav />
    </div>
  );
}
```

Khác biệt:
- Fullscreen: `h-screen` (chiếm đúng 100vh), `overflow-hidden` (không scroll toàn trang)
- Fullscreen: KHÔNG có Footer và MobileNav
- Main: `min-h-screen` (có thể dài hơn viewport), có Footer và MobileNav
- Main: `pb-16 md:pb-0` — padding bottom cho mobile nav bar

---

## 5. Kỹ thuật đặc biệt

### 5.1 Optimistic Updates (Vote)

Pattern:

```typescript
function handleVote(value: number) {
  // 1. Lưu trạng thái cũ để rollback
  const prev = localVote;
  const prevCount = localVoteCount;

  // 2. Cập nhật UI ngay lập tức (optimistic)
  setLocalVote(value === 0 ? null : value);
  setLocalVoteCount(prevCount - (prev ?? 0) + (value === 0 ? 0 : value));

  // 3. Gửi API request
  voteAnswer.mutate(
    { answerId, value, questionId },
    {
      // 4. Nếu API fail -> rollback về trạng thái cũ
      onError: () => {
        setLocalVote(prev);
        setLocalVoteCount(prevCount);
      },
    },
  );
}
```

Tại sao dùng pattern này:
- User không phải đợi API response để thấy kết quả vote
- Trải nghiệm mượt mà hơn, đặc biệt trên mạng chậm
- Nếu API fail, UI tự động rollback về trạng thái trước đó
- Dùng `useState` local thay vì sửa query cache trực tiếp — đơn giản hơn

Math của vote count update:
- `prevCount - (prev ?? 0)`: trừ đi vote cũ (nếu có)
- `+ value`: cộng vote mới
- Ví dụ: đang upvote (+1), click downvote (-1):
  - `prevCount - 1 + (-1)` = `prevCount - 2` (đúng: giảm 2)

### 5.2 SSE Streaming với fetch API

**ReadableStream reader pattern:**

```typescript
const reader = response.body?.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? ''; // Phần chưa hoàn chỉnh

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const event = JSON.parse(line.slice(6));
    // Process event...
  }
}
```

**Buffer handling chi tiết:**

SSE protocol gửi data theo format:
```
data: {"type":"token","content":"Hello"}\n\n
data: {"type":"token","content":" world"}\n\n
```

Nhưng network có thể cắt giữa chừng:
- Chunk 1: `data: {"type":"token","con`
- Chunk 2: `tent":"Hello"}\n\ndata: {"type":"token","content":" world"}\n\n`

Xử lý:
1. `buffer += decoder.decode(value, { stream: true })` — giữ lại bytes chưa decode xong
2. `lines = buffer.split('\n')` — tách theo newline
3. `buffer = lines.pop()` — dòng cuối cùng có thể chưa hoàn chỉnh -> giữ lại trong buffer
4. Chỉ xử lý các dòng bắt đầu bằng `data: `
5. `line.slice(6)` — bỏ "data: " prefix, lấy JSON string
6. try/catch bọc JSON.parse để skip malformed lines

**Error recovery:**

```typescript
try {
  // ... stream reading loop
} catch {
  setIsThinking(false);
  setIsStreaming(false);
  toast.error(t('errors.NETWORK_ERROR'));
}
```

Nếu connection bị ngắt giữa chừng (network error), catch block clean up state và hiển thị toast.

### 5.3 Unique View Tracking (Redis SET)

**Tại sao SET thay vì simple counter:**

Simple counter (`INCR`):
- Mỗi lần user refresh page -> tăng viewCount
- Không chính xác: 1 user xem 10 lần = 10 views

Redis SET (`SADD`):
- Lưu set các userIds đã xem
- `SADD` trả về 1 nếu userId mới, 0 nếu đã tồn tại
- Chỉ tăng viewCount khi userId mới -> unique views

```typescript
const viewKey = `qview:${questionId}`;
this.redis.sadd(viewKey, viewerId) // Thêm userId vào SET
  .then(async (added) => {
    if (added === 1) { // userId mới
      // Set TTL 30 ngày (nếu chưa có)
      const ttl = await this.redis.ttl(viewKey);
      if (ttl === -1) await this.redis.expire(viewKey, 30 * 24 * 3600);
      // Tăng view count trong DB
      await this.prisma.question.update({
        where: { id: questionId },
        data: { viewCount: { increment: 1 } },
      });
    }
  });
```

**TTL strategy (30 ngày):**
- Mỗi SET tồn tại 30 ngày
- Sau 30 ngày, SET tự xóa -> user có thể được đếm lại
- Cân bằng giữa accuracy và memory usage
- Check `ttl === -1` (key không có TTL) để đảm bảo chỉ set TTL 1 lần (lần đầu tiên `sadd`)

### 5.4 Route Groups ((fullscreen) vs (main))

Next.js route groups (trong ngoặc đơn) cho phép nhóm các pages chia sẻ layout mà không ảnh hưởng URL.

**Tại sao AI Tutor cần layout riêng:**

AI Tutor là giao diện chat fullscreen:
- Chiếm toàn bộ viewport (`h-screen`)
- Không scroll toàn trang (`overflow-hidden`) — chỉ scroll trong chat area
- Không cần Footer (phù hợp cho chat app)
- Không cần MobileNav ở dưới (chat input ở dưới rồi)

```
(main)/          -> Navbar + Footer + MobileNav (normal pages)
  qna/           -> /qna
  courses/       -> /courses

(fullscreen)/    -> Navbar only, h-screen, overflow-hidden
  ai-tutor/      -> /ai-tutor

(learning)/      -> Navbar only, custom layout
  courses/[id]/  -> /courses/{id}/learn
```

URL không bị ảnh hưởng: `/ai-tutor` không có "fullscreen" trong URL.

### 5.5 Auto-scroll control

**Vấn đề:** Khi AI gửi response, chat area cần tự động scroll xuống để user thấy token mới.

**Tại sao không dùng `scrollIntoView()`:**
- `scrollIntoView()` scroll toàn bộ trang, không chỉ chat container
- Khi chat area nằm trong flex layout, nó sẽ scroll `document.body` thay vì chỉ `messagesContainer`

**Giải pháp: `shouldScrollRef` pattern:**

```typescript
const messagesContainerRef = useRef<HTMLDivElement>(null);
const shouldScrollRef = useRef(false);

// Chỉ scroll khi có tin nhắn mới hoặc streaming
useEffect(() => {
  if (shouldScrollRef.current && messagesContainerRef.current) {
    const el = messagesContainerRef.current;
    el.scrollTop = el.scrollHeight;
  }
}, [messages, streamingContent, isThinking]);

// Bật flag khi user gửi tin nhắn
const handleSend = useCallback(async () => {
  shouldScrollRef.current = true;
  // ...
});
```

Logic:
1. `shouldScrollRef` = `false` mặc định -> không auto-scroll khi load history
2. User gửi tin nhắn -> set `shouldScrollRef = true`
3. `useEffect` trigger khi `messages`, `streamingContent`, hoặc `isThinking` thay đổi
4. Nếu `shouldScrollRef.current === true` -> scroll xuống cuối
5. `el.scrollTop = el.scrollHeight` — set scroll position bằng chiều cao toàn bộ content

**Tại sao dùng `useRef` thay vì `useState`:**
- `useRef` không gây re-render khi thay đổi giá trị
- Chỉ cần 1 flag boolean, không cần render lại UI khi flag thay đổi
- Tránh vòng lặp vô hạn: `useState` -> re-render -> `useEffect` -> setState -> re-render...
