# 03 — AI Tutor: RAG Pipeline, Embeddings, pgvector, và Groq Integration

> Giải thích chi tiết AiTutorModule — RAG (Retrieve-Augment-Generate) pipeline,
> local embeddings (Transformers.js), pgvector cosine similarity search, Groq API (Llama 3.3 70B),
> session management, rate limiting, và graceful degradation.

---

## 1. TỔNG QUAN ARCHITECTURE

### 1.1 RAG Pipeline — 5 Steps

```
User: "useEffect chạy 2 lần là sao?"
  │
  ▼
┌─────────────────────────────────────────────────┐
│ Step 1: GATE CHECKS                              │
│ ├── Rate limit: Redis ai_limit:{userId}:{date}   │
│ └── Enrollment: user must be enrolled in course   │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ Step 2: RETRIEVE — Vector Similarity Search       │
│ ├── Generate embedding: question → [0.2, -0.1, …] │
│ │   (Transformers.js, all-MiniLM-L6-v2, 384 dim) │
│ ├── Search pgvector: cosine distance <=>           │
│ │   SELECT TOP 5 chunks WHERE course_id = ?        │
│ └── Result: 5 most relevant text chunks            │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ Step 3: AUGMENT — Build Prompt                    │
│ ├── System: "You are AI tutor. Context: {chunks}" │
│ ├── History: last 10 messages from session         │
│ └── User: current question                         │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ Step 4: GENERATE — Groq API Call                  │
│ ├── Model: Llama 3.3 70B Versatile                │
│ ├── max_tokens: 2048, temperature: 0.7            │
│ └── Response: AI answer text                       │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ Step 5: SAVE — Persist Messages                   │
│ ├── Save USER message to AiChatMessage             │
│ ├── Save ASSISTANT message to AiChatMessage        │
│ └── Auto-update session title if first message     │
└─────────────────────────────────────────────────┘
```

### 1.2 Files đã tạo

```
src/modules/ai-tutor/
├── ai-tutor.module.ts              # Module definition
├── ai-tutor.service.ts             # RAG orchestration
├── ai-tutor.service.spec.ts        # 9 tests
├── ai-tutor.controller.ts          # 3 endpoints
├── embeddings/
│   ├── embeddings.service.ts       # Local model + chunking + indexing
│   └── embeddings.service.spec.ts  # 5 tests
└── dto/
    └── ask-question.dto.ts         # courseId, sessionId?, question
```

### 1.3 Prisma Models

```
AiChatSession:
  ├── id, userId, courseId, title?
  ├── createdAt, updatedAt
  └── messages: AiChatMessage[]

AiChatMessage:
  ├── id, sessionId, role (USER | ASSISTANT), content
  └── createdAt

CourseChunk:
  ├── id, courseId, lessonId?, content
  ├── embedding vector(384) — via raw SQL (pgvector)
  └── createdAt
```

---

## 2. EMBEDDINGS SERVICE — Local Vector Generation

### 2.1 Lý thuyết: Text Embeddings

```
Embedding = biến đoạn text thành vector số (mảng số thực)

"React hooks allow you to use state" → [0.23, -0.15, 0.08, ..., 0.42]
                                        ↑ 384 dimensions

Tại sao cần?
  - Text không so sánh được trực tiếp ("React" ≠ "hooks" nhưng liên quan)
  - Vector encoding: "React hooks" gần với "useState" trong vector space
  - Cosine similarity: đo góc giữa 2 vectors → degree of relatedness
```

### 2.2 Model: all-MiniLM-L6-v2

```
Model: Xenova/all-MiniLM-L6-v2
  ├── Architecture: MiniLM (lightweight BERT variant)
  ├── Dimensions: 384 (compact but effective)
  ├── Size: ~50MB (downloads on first use, cached locally)
  ├── Speed: ~5ms per embedding (CPU)
  ├── Quality: Top-tier for sentence similarity tasks
  └── License: Apache 2.0 (free commercial use)

So sánh:
  Model                  | Dims | Size   | Quality
  all-MiniLM-L6-v2       | 384  | 50MB   | ★★★★☆  ← SSLM chọn
  all-MiniLM-L12-v2      | 384  | 130MB  | ★★★★★
  text-embedding-3-small  | 1536 | API    | ★★★★★  (OpenAI, trả phí)
```

### 2.3 Dynamic Import — ESM Compatibility

```typescript
async onModuleInit() {
  try {
    // Dynamic import — @huggingface/transformers is ESM-only
    const { pipeline } = await import('@huggingface/transformers');
    this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  } catch (error) {
    console.warn('Failed to load embeddings model.', error);
  }
}
```

**Tại sao dynamic import?**
- NestJS project dùng CommonJS (`"module": "commonjs"` trong tsconfig)
- `@huggingface/transformers` là ESM-only module
- Static `import { pipeline } from '...'` → compile error
- `await import(...)` → works at runtime (Node.js supports ESM dynamic import from CJS)

**Graceful degradation:**
```
Model loaded successfully → RAG works with embeddings
Model failed to load → AI Tutor still works, but without context retrieval
  → retrieveContext() catches error → returns fallback message
  → Groq still generates answer, just less accurate (no course context)
```

### 2.4 Text Chunking

```typescript
private chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    const chunk = text.slice(i, i + chunkSize).trim();
    if (chunk.length > 0) chunks.push(chunk);
  }
  return chunks;
}
```

**Ví dụ minh họa:**

```
Text (200 chars): "React hooks are functions that let you use state and other
                   React features in functional components. useState is the
                   most basic hook. It returns a pair: the current state
                   value and a function to update it."

chunkSize = 100, overlap = 20

Step size = 100 - 20 = 80

Chunk 1 (i=0):   text[0..100]   = "React hooks are functions that let you use state and other React features in functional compon..."
Chunk 2 (i=80):  text[80..180]  = "nal components. useState is the most basic hook. It returns a pair: the current state value an..."
Chunk 3 (i=160): text[160..200] = "d a function to update it."

                  ←────── chunk 1 ──────→
                                ←─ overlap ─→
                                ←────── chunk 2 ──────→
                                                ←─ overlap ─→
                                                ←── chunk 3 ──→
```

**Tại sao overlap?**
- Nếu không overlap: 1 câu có thể bị cắt giữa chừng → mất context
- Overlap 50 chars: câu bị cắt sẽ xuất hiện đầy đủ ở chunk tiếp theo
- Trade-off: overlap lớn → nhiều chunks hơn → storage + compute cost

### 2.5 pgvector INSERT — Embedding Storage

```typescript
const embeddingStr = `[${embedding.join(',')}]`;  // "[0.23,-0.15,0.08,...,0.42]"

await this.prisma.$executeRaw`
  INSERT INTO course_chunks (id, course_id, lesson_id, content, embedding, created_at)
  VALUES (gen_random_uuid(), ${courseId}, ${lesson.id}, ${chunk}, ${embeddingStr}::vector, now())
`;
```

**Tại sao raw SQL thay vì Prisma ORM?**
- `embedding` column là `vector(384)` type — Prisma không support natively
- `::vector` cast: PostgreSQL chuyển string array thành pgvector type
- `gen_random_uuid()`: PostgreSQL built-in UUID generator
- Column tạo bằng raw SQL migration (Phase 5.2), không có trong Prisma schema

---

## 3. AI TUTOR SERVICE — RAG Orchestration

### 3.1 Gate 1: Rate Limiting

```typescript
const dateKey = new Date().toISOString().slice(0, 10);  // "2026-03-15"
const limitKey = `ai_limit:${userId}:${dateKey}`;
const allowed = await this.redis.checkRateLimit(limitKey, 10, 86400);
```

**Ví dụ:**
```
User asks 1st question today → Redis: INCR ai_limit:user1:2026-03-15 → 1 ≤ 10 → ✅
User asks 10th question      → Redis: INCR → 10 ≤ 10 → ✅
User asks 11th question      → Redis: INCR → 11 > 10 → ❌ AI_DAILY_LIMIT_REACHED
Next day                      → New key ai_limit:user1:2026-03-16 → 1 → ✅

Key TTL = 86400s (24h) → auto-cleanup Redis memory
```

**Tại sao rate limit?**
- Groq free tier: 30 requests/minute, ~14,400/day
- 10 questions/user/day prevents single user exhausting quota
- Redis counter pattern: `INCR` + `EXPIRE` (atomic via `checkRateLimit`)

### 3.2 Gate 2: Enrollment Check

```typescript
const enrollment = await this.prisma.enrollment.findFirst({
  where: { userId, courseId: dto.courseId },
});
if (!enrollment) throw new ForbiddenException({ code: 'ENROLLMENT_REQUIRED' });
```

**Tại sao?**
- AI Tutor answers based on course content → phải mua khóa mới hỏi được
- Prevents free users from accessing paid content via AI
- Same pattern as Course Player access control (Phase 5.8)

### 3.3 Context Retrieval — pgvector Cosine Search

```typescript
private async retrieveContext(courseId: string, question: string): Promise<string> {
  const queryEmbedding = await this.embeddingsService.generateEmbedding(question);
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  const chunks = await this.prisma.$queryRaw<{ content: string; similarity: number }[]>`
    SELECT content, 1 - (embedding <=> ${embeddingStr}::vector) AS similarity
    FROM course_chunks
    WHERE course_id = ${courseId}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT 5
  `;

  return chunks.map((c) => c.content).join('\n\n---\n\n');
}
```

**pgvector operators:**
```
<=>  Cosine distance (0 = identical, 2 = opposite)
<->  L2 distance (Euclidean)
<#>  Inner product (negative for ordering)

SSLM dùng <=> (cosine) vì:
  - Cosine không phụ thuộc vector length → tốt cho text similarity
  - Range [0, 2]: 0 = giống nhau hoàn toàn, 1 = không liên quan, 2 = đối lập
  - Similarity = 1 - distance: range [−1, 1]
```

**Ví dụ search:**
```sql
-- User asks: "useEffect chạy 2 lần"
-- Question embedding: [0.45, -0.12, 0.33, ...]

SELECT content, 1 - (embedding <=> '[0.45,-0.12,0.33,...]'::vector) AS similarity
FROM course_chunks
WHERE course_id = 'clx-react-course'
ORDER BY embedding <=> '[0.45,-0.12,0.33,...]'::vector
LIMIT 5;

-- Results:
-- ┌────────────────────────────────────────────┬────────────┐
-- │ content                                     │ similarity │
-- ├────────────────────────────────────────────┼────────────┤
-- │ "React 18 StrictMode re-renders components  │ 0.89       │  ← Most relevant
-- │  twice in development to detect side..."    │            │
-- │ "useEffect runs after every render unless   │ 0.85       │
-- │  you pass a dependency array..."            │            │
-- │ "Common useEffect patterns: fetching data,  │ 0.72       │
-- │  subscriptions, and cleanup..."             │            │
-- │ "The difference between useEffect and       │ 0.68       │
-- │  useLayoutEffect..."                        │            │
-- │ "React component lifecycle: mount, update,  │ 0.61       │
-- │  unmount..."                                │            │
-- └────────────────────────────────────────────┴────────────┘
```

### 3.4 Prompt Construction — System + History + User

```typescript
const messages = [
  { role: 'system', content: systemPrompt },        // Instructions + RAG context
  ...history.map((m) => ({                           // Previous conversation
    role: m.role.toLowerCase() as 'user' | 'assistant',
    content: m.content,
  })),
  { role: 'user', content: dto.question },           // Current question
];
```

**Ví dụ complete messages array:**
```json
[
  {
    "role": "system",
    "content": "You are an AI tutor for an online course...\n\nCourse Context:\nReact 18 StrictMode re-renders components twice in development...\n\n---\n\nuseEffect runs after every render unless you pass a dependency array..."
  },
  {
    "role": "user",
    "content": "React là gì?"
  },
  {
    "role": "assistant",
    "content": "React là một thư viện JavaScript dùng để xây dựng giao diện người dùng..."
  },
  {
    "role": "user",
    "content": "useEffect chạy 2 lần là sao?"
  }
]
```

**Tại sao include history?**
- LLM is stateless — mỗi request là độc lập
- Include history → AI nhớ context cuộc hội thoại
- `take: 10` — giới hạn 10 messages để không exceed token limit
- Groq Llama 3.3 70B: 128K context window → 10 messages (~2K tokens) rất safe

### 3.5 Session Management

```
Session lifecycle:
  1. First question → createSession(userId, courseId, question)
     → title = question.slice(0, 47) + "..."
  2. Follow-up questions → use existing sessionId
     → verify ownership (session.userId === userId)
  3. New topic → omit sessionId → new session created

Frontend UI:
  ┌─────────────────────────┐
  │ AI Tutor                │
  │                         │
  │ Sessions:               │
  │ ├── "useEffect chạy..." │ ← click to continue
  │ ├── "Redux vs Context"  │
  │ └── "TypeScript generics"│
  │                         │
  │ [+ New conversation]    │
  └─────────────────────────┘
```

### 3.6 Groq SDK — Non-streaming

```typescript
const completion = await this.groq.chat.completions.create({
  model: this.config.get<string>('groq.model') ?? 'llama-3.3-70b-versatile',
  messages,
  max_tokens: this.config.get<number>('groq.maxTokens') ?? 2048,
  temperature: 0.7,  // Creative but focused
});

const answer = completion.choices[0]?.message?.content
  ?? 'Sorry, I could not generate a response.';
```

**Temperature 0.7 explained:**
```
temperature = 0.0: Deterministic, luôn chọn token probability cao nhất
temperature = 0.7: Balanced — creative nhưng coherent
temperature = 1.0: Very creative, có thể incoherent
temperature = 2.0: Random, không dùng được

Cho AI Tutor: 0.7 = đủ creative để giải thích nhiều cách,
  nhưng đủ focused để không hallucinate
```

---

## 4. TESTING

### 4.1 Mock Groq SDK

```typescript
jest.mock('groq-sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'AI response here' } }],
        }),
      },
    },
  })),
}));
```

**`jest.mock` at module level:**
- Groq SDK creates HTTP client on instantiation → mock toàn bộ module
- `__esModule: true` + `default` — because `import Groq from 'groq-sdk'` is default import
- Mock `create()` return Groq API response shape

### 4.2 Embeddings Error Handling Test

```typescript
it('should throw if model not loaded', async () => {
  // EmbeddingsService initialized without onModuleInit → embedder = null
  await expect(service.generateEmbedding('test'))
    .rejects.toThrow('Embeddings model not loaded');
});
```

### 4.3 Testing Private chunkText via Reflection

```typescript
const chunkText = (text: string, chunkSize: number, overlap: number): string[] => {
  return (service as unknown as { chunkText: typeof chunkText })
    .chunkText(text, chunkSize, overlap);
};
```

**Tại sao test private method?**
- `chunkText` chứa critical logic (chunking algorithm)
- Bug trong chunking → incorrect embeddings → wrong RAG results
- Test via reflection: `as unknown as { chunkText: ... }` bypass TypeScript private
- Alternative: move to utility function (public) — nhưng chỉ dùng trong EmbeddingsService
