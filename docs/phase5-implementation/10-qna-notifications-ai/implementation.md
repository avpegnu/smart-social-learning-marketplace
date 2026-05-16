# Phase 5.10 — Q&A, NOTIFICATIONS, AI & RECOMMENDATIONS

> Q&A Forum, Notification system (WebSocket), AI Tutor (Groq + RAG), Recommendation engine.
> Tham chiếu: `docs/phase3-backend/02-api-endpoints.md`, `docs/phase3-backend/03-realtime-and-services.md`

---

## Mục lục

- [Step 1: Q&A Forum Module](#step-1-qa-forum-module)
- [Step 2: Notifications Module](#step-2-notifications-module)
- [Step 3: Notification WebSocket Gateway](#step-3-notification-websocket-gateway)
- [Step 4: AI Module — Groq Integration](#step-4-ai-module--groq-integration)
- [Step 5: Embeddings Pipeline (Transformers.js)](#step-5-embeddings-pipeline-transformersjs)
- [Step 6: RAG Flow (Retrieve → Augment → Generate)](#step-6-rag-flow-retrieve--augment--generate)
- [Step 7: Recommendations Module](#step-7-recommendations-module)
- [Step 8: Controllers](#step-8-controllers)
- [Step 9: Verify](#step-9-verify)

---

## Step 1: Q&A Forum Module

### Structure

```
src/modules/qa-forum/
├── qa-forum.module.ts
├── questions/
│   ├── questions.controller.ts
│   └── questions.service.ts
├── answers/
│   ├── answers.controller.ts
│   └── answers.service.ts
└── dto/
    ├── create-question.dto.ts
    ├── create-answer.dto.ts
    └── vote.dto.ts
```

### Key service methods

```typescript
// Questions
async createQuestion(authorId: string, dto: CreateQuestionDto) {
  return this.prisma.question.create({
    data: {
      title: dto.title,
      content: dto.content,
      codeSnippet: dto.codeSnippet,
      authorId,
      courseId: dto.courseId,
      tagId: dto.tagId,
    },
  });
}

async findAll(query: QueryQuestionsDto) {
  const where = {
    ...(query.courseId && { courseId: query.courseId }),
    ...(query.tagId && { tagId: query.tagId }),
    ...(query.search && { title: { contains: query.search, mode: 'insensitive' } }),
  };
  // Paginated query with author, answerCount, bestAnswer
}

// Answers
async createAnswer(authorId: string, questionId: string, dto: CreateAnswerDto) {
  const answer = await this.prisma.$transaction(async (tx) => {
    const newAnswer = await tx.answer.create({
      data: { content: dto.content, codeSnippet: dto.codeSnippet, authorId, questionId },
    });
    await tx.question.update({
      where: { id: questionId },
      data: { answerCount: { increment: 1 } },
    });
    return newAnswer;
  });
  return answer;
}

async markBestAnswer(questionId: string, answerId: string, userId: string) {
  const question = await this.prisma.question.findUnique({ where: { id: questionId } });
  if (question?.authorId !== userId) throw new ForbiddenException({ code: 'NOT_QUESTION_OWNER' });

  return this.prisma.question.update({
    where: { id: questionId },
    data: { bestAnswerId: answerId },
  });
}

// Votes
async vote(userId: string, answerId: string, value: number) {
  // value: +1 or -1
  const existing = await this.prisma.vote.findUnique({
    where: { userId_answerId: { userId, answerId } },
  });

  if (existing) {
    if (existing.value === value) {
      // Remove vote
      await this.prisma.$transaction([
        this.prisma.vote.delete({ where: { id: existing.id } }),
        this.prisma.answer.update({ where: { id: answerId }, data: { voteCount: { decrement: value } } }),
      ]);
      return { voted: null };
    }
    // Change vote
    await this.prisma.$transaction([
      this.prisma.vote.update({ where: { id: existing.id }, data: { value } }),
      this.prisma.answer.update({ where: { id: answerId }, data: { voteCount: { increment: value * 2 } } }),
    ]);
    return { voted: value };
  }

  // New vote
  await this.prisma.$transaction([
    this.prisma.vote.create({ data: { userId, answerId, value } }),
    this.prisma.answer.update({ where: { id: answerId }, data: { voteCount: { increment: value } } }),
  ]);
  return { voted: value };
}
```

---

## Step 2: Notifications Module

### Structure

```
src/modules/notifications/
├── notifications.module.ts
├── notifications.controller.ts
├── notifications.service.ts
├── notifications.gateway.ts
└── dto/
    └── notification-preferences.dto.ts
```

### Service

```typescript
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(recipientId: string, type: NotificationType, data: Record<string, unknown>) {
    const notification = await this.prisma.notification.create({
      data: { recipientId, type, data },
    });
    // Gateway will push to client if online (injected separately)
    return notification;
  }

  async getNotifications(userId: string, query: PaginationDto) {
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { recipientId: userId },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.notification.count({ where: { recipientId: userId } }),
    ]);
    return createPaginatedResult(notifications, total, query.page, query.limit);
  }

  async markAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, recipientId: userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true },
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { recipientId: userId, isRead: false },
    });
  }
}
```

---

## Step 3: Notification WebSocket Gateway

```typescript
@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: ['http://localhost:3001', 'http://localhost:3002'] },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token || client.handshake.query?.token;
    try {
      const payload = this.jwtService.verify(token as string, {
        secret: this.configService.get('auth.jwtAccessSecret'),
      });
      client.data.userId = payload.sub;
      client.join(`user_${payload.sub}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket) {}

  // Called by NotificationsService after creating notification
  pushToUser(userId: string, notification: unknown) {
    this.server.to(`user_${userId}`).emit('notification', notification);
  }

  pushUnreadCount(userId: string, count: number) {
    this.server.to(`user_${userId}`).emit('unread_count', { count });
  }
}
```

---

## Step 4: AI Module — Groq Integration

### Structure

```
src/modules/ai/
├── ai.module.ts
├── ai-tutor/
│   ├── ai-tutor.controller.ts
│   └── ai-tutor.service.ts
├── embeddings/
│   └── embeddings.service.ts
└── dto/
    └── ask-question.dto.ts
```

### Install dependencies

```bash
npm install groq-sdk
npm install @huggingface/transformers   # for embeddings
```

### Groq Service

```typescript
import Groq from 'groq-sdk';

@Injectable()
export class AiTutorService {
  private groq: Groq;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly embeddingsService: EmbeddingsService,
  ) {
    this.groq = new Groq({ apiKey: this.config.get('groq.apiKey') });
  }

  async askQuestion(userId: string, courseId: string, question: string) {
    // Rate limit: 10 questions/day
    const dailyKey = `ai_limit:${userId}:${new Date().toISOString().slice(0, 10)}`;
    const allowed = await this.redis.checkRateLimit(dailyKey, 10, 86400);
    if (!allowed) throw new BadRequestException({ code: 'AI_DAILY_LIMIT_REACHED' });

    // RAG: retrieve relevant chunks
    const context = await this.retrieveContext(courseId, question);

    // Build prompt
    const systemPrompt = `You are an AI tutor for the course. Answer based on the course content below.
If you don't know, say so. Always be helpful and educational.

Course Context:
${context}`;

    // Get or create session
    const session = await this.getOrCreateSession(userId, courseId);

    // Save user message
    await this.prisma.aiChatMessage.create({
      data: { sessionId: session.id, role: 'USER', content: question },
    });

    // Call Groq API
    const completion = await this.groq.chat.completions.create({
      model: this.config.get('groq.model') || 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
      max_tokens: this.config.get('groq.maxTokens') || 2048,
      temperature: 0.7,
    });

    const answer =
      completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    // Save assistant message
    await this.prisma.aiChatMessage.create({
      data: { sessionId: session.id, role: 'ASSISTANT', content: answer },
    });

    return { answer, sessionId: session.id };
  }

  private async retrieveContext(courseId: string, question: string): Promise<string> {
    // Generate embedding for the question
    const queryEmbedding = await this.embeddingsService.generateEmbedding(question);

    // Vector similarity search via raw SQL (pgvector)
    const chunks = await this.prisma.$queryRaw`
      SELECT id, content, 1 - (embedding <=> ${queryEmbedding}::vector) AS similarity
      FROM course_chunks
      WHERE course_id = ${courseId}
      ORDER BY embedding <=> ${queryEmbedding}::vector
      LIMIT 5
    `;

    return (chunks as { content: string }[]).map((c) => c.content).join('\n\n---\n\n');
  }

  private async getOrCreateSession(userId: string, courseId: string) {
    // Find existing session or create new one
    const existing = await this.prisma.aiChatSession.findFirst({
      where: { userId, courseId },
      orderBy: { updatedAt: 'desc' },
    });

    if (existing) return existing;

    return this.prisma.aiChatSession.create({
      data: { userId, courseId, title: 'New Session' },
    });
  }
}
```

---

## Step 5: Embeddings Pipeline (Transformers.js)

```typescript
import { pipeline } from '@huggingface/transformers';

@Injectable()
export class EmbeddingsService {
  private embedder: Awaited<ReturnType<typeof pipeline>> | null = null;

  async onModuleInit() {
    // Load model on startup (384 dimensions)
    this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embedder) throw new Error('Embeddings model not loaded');

    const output = await this.embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  }

  async indexCourseContent(courseId: string) {
    // Get all lessons for course
    const lessons = await this.prisma.lesson.findMany({
      where: { chapter: { section: { courseId } } },
      select: { id: true, title: true, textContent: true },
    });

    // Chunk and embed each lesson
    for (const lesson of lessons) {
      const content = `${lesson.title}\n${lesson.textContent || ''}`;
      const chunks = this.chunkText(content, 500, 50); // 500 chars, 50 overlap

      for (const chunk of chunks) {
        const embedding = await this.generateEmbedding(chunk);

        await this.prisma.$executeRaw`
          INSERT INTO course_chunks (id, course_id, lesson_id, content, embedding, created_at)
          VALUES (gen_random_uuid(), ${courseId}, ${lesson.id}, ${chunk}, ${embedding}::vector, now())
        `;
      }
    }
  }

  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
```

---

## Step 6: RAG Flow (Retrieve → Augment → Generate)

```
User asks question
       │
       ▼
1. Generate embedding for question (Transformers.js, 384 dim)
       │
       ▼
2. Search course_chunks by cosine similarity (pgvector)
   SELECT TOP 5 most similar chunks
       │
       ▼
3. Build system prompt with retrieved context
       │
       ▼
4. Send to Groq API (Llama 3.3 70B)
       │
       ▼
5. Return answer + save to AiChatMessage
```

---

## Step 7: Recommendations Module

### Structure

```
src/modules/recommendations/
├── recommendations.module.ts
├── recommendations.controller.ts
├── recommendations.service.ts
└── algorithms/
    ├── content-based.service.ts      # Cosine Similarity (tags, category)
    ├── collaborative.service.ts      # Jaccard Similarity (enrollment overlap)
    └── popularity.service.ts         # Wilson Score + Time Decay
```

### Content-Based Similarity (Cosine)

```typescript
async computeContentSimilarity() {
  const courses = await this.prisma.course.findMany({
    where: { status: 'PUBLISHED', deletedAt: null },
    include: { courseTags: true },
  });

  // Build tag vectors
  const allTagIds = [...new Set(courses.flatMap((c) => c.courseTags.map((t) => t.tagId)))];

  for (const courseA of courses) {
    const vectorA = allTagIds.map((t) => courseA.courseTags.some((ct) => ct.tagId === t) ? 1 : 0);

    for (const courseB of courses) {
      if (courseA.id === courseB.id) continue;
      const vectorB = allTagIds.map((t) => courseB.courseTags.some((ct) => ct.tagId === t) ? 1 : 0);

      const score = cosineSimilarity(vectorA, vectorB);
      if (score > 0.1) {
        await this.prisma.courseSimilarity.upsert({
          where: { courseId_similarCourseId_algorithm: {
            courseId: courseA.id, similarCourseId: courseB.id, algorithm: 'CONTENT',
          }},
          update: { score },
          create: { courseId: courseA.id, similarCourseId: courseB.id, score, algorithm: 'CONTENT' },
        });
      }
    }
  }
}
```

### Collaborative Filtering (Jaccard)

```typescript
// Jaccard = |enrolled_both| / |enrolled_either|
async computeCollaborativeSimilarity() {
  // Get enrollment matrix
  const enrollments = await this.prisma.enrollment.findMany({
    select: { userId: true, courseId: true },
  });

  // Group by course
  const courseUsers = new Map<string, Set<string>>();
  for (const e of enrollments) {
    if (!courseUsers.has(e.courseId)) courseUsers.set(e.courseId, new Set());
    courseUsers.get(e.courseId)!.add(e.userId);
  }

  // Calculate Jaccard for each pair
  const courseIds = [...courseUsers.keys()];
  for (let i = 0; i < courseIds.length; i++) {
    for (let j = i + 1; j < courseIds.length; j++) {
      const setA = courseUsers.get(courseIds[i])!;
      const setB = courseUsers.get(courseIds[j])!;

      const intersection = [...setA].filter((u) => setB.has(u)).length;
      const union = new Set([...setA, ...setB]).size;
      const score = union > 0 ? intersection / union : 0;

      if (score > 0) {
        // Save both directions
        // ...
      }
    }
  }
}
```

### Get recommendations for user

```typescript
async getRecommendations(userId: string, limit = 10) {
  // Get user's enrolled course IDs
  const enrolledCourseIds = (await this.prisma.enrollment.findMany({
    where: { userId },
    select: { courseId: true },
  })).map((e) => e.courseId);

  // Find similar courses (HYBRID) not yet enrolled
  const recommendations = await this.prisma.courseSimilarity.findMany({
    where: {
      courseId: { in: enrolledCourseIds },
      similarCourseId: { notIn: enrolledCourseIds },
      algorithm: 'HYBRID',
    },
    orderBy: { score: 'desc' },
    take: limit,
    include: {
      similarCourse: {
        select: { id: true, title: true, slug: true, thumbnailUrl: true, avgRating: true, price: true },
      },
    },
  });

  return recommendations.map((r) => ({ ...r.similarCourse, similarityScore: r.score }));
}
```

---

## Step 8: Controllers

| Method | Path                            | Auth   | Description                  |
| ------ | ------------------------------- | ------ | ---------------------------- |
| POST   | /api/questions                  | User   | Create question              |
| GET    | /api/questions                  | Public | List questions               |
| GET    | /api/questions/:id              | Public | Question detail              |
| POST   | /api/questions/:id/answers      | User   | Post answer                  |
| PATCH  | /api/questions/:id/best-answer  | Owner  | Mark best answer             |
| POST   | /api/answers/:id/vote           | User   | Upvote/downvote              |
| GET    | /api/notifications              | User   | List notifications           |
| PATCH  | /api/notifications/:id/read     | User   | Mark as read                 |
| PATCH  | /api/notifications/read-all     | User   | Mark all as read             |
| GET    | /api/notifications/unread-count | User   | Get unread count             |
| POST   | /api/ai/tutor/ask               | User   | Ask AI question              |
| GET    | /api/ai/tutor/sessions          | User   | List sessions                |
| GET    | /api/ai/tutor/sessions/:id      | User   | Session history              |
| GET    | /api/recommendations            | User   | Personalized recommendations |

---

## Step 9: Verify

### Checklist

- [ ] Q&A: create question, answer, mark best answer
- [ ] Votes update answer voteCount correctly
- [ ] Notifications created and pushed via WebSocket
- [ ] Unread count badge works
- [ ] Mark read (single + all) works
- [ ] AI Tutor: question → RAG context → Groq → answer
- [ ] Embeddings generated locally (Transformers.js)
- [ ] pgvector cosine similarity search works
- [ ] AI rate limit (10/day) enforced
- [ ] Recommendations return relevant courses
- [ ] Content-based + collaborative algorithms compute correctly
