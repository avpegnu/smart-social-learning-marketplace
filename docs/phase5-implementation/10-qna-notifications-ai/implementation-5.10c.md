# Sub-phase 5.10c — AI TUTOR MODULE

> AI Tutor with RAG (Retrieve-Augment-Generate): Groq API + local embeddings (Transformers.js) + pgvector.
> Prisma models: AiChatSession, AiChatMessage, CourseChunk

---

## Step 1: Install Dependencies

```bash
cd apps/api
npm install @huggingface/transformers
```

---

## Step 2: Module Structure

```
src/modules/ai-tutor/
├── ai-tutor.module.ts
├── ai-tutor.service.ts
├── ai-tutor.service.spec.ts
├── ai-tutor.controller.ts
├── embeddings/
│   ├── embeddings.service.ts
│   └── embeddings.service.spec.ts
└── dto/
    └── ask-question.dto.ts
```

---

## Step 3: DTO

### ask-question.dto.ts

```typescript
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class AskQuestionDto {
  @IsString()
  courseId!: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  question!: string;
}
```

---

## Step 4: EmbeddingsService

```typescript
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class EmbeddingsService implements OnModuleInit {
  // Dynamic import — @huggingface/transformers is ESM
  private embedder: unknown = null;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      // Dynamic import for ESM compatibility
      const { pipeline } = await import('@huggingface/transformers');
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    } catch (error) {
      console.warn('Failed to load embeddings model. AI features will be limited.', error);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embedder) {
      throw new Error('Embeddings model not loaded');
    }

    const embedFn = this.embedder as (text: string, opts: Record<string, unknown>) => Promise<{ data: Float32Array }>;
    const output = await embedFn(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  async indexCourseContent(courseId: string) {
    // Delete existing chunks for this course
    await this.prisma.$executeRaw`
      DELETE FROM course_chunks WHERE course_id = ${courseId}
    `;

    // Get all text lessons
    const lessons = await this.prisma.lesson.findMany({
      where: { chapter: { section: { courseId } }, type: 'TEXT' },
      select: { id: true, title: true, textContent: true },
    });

    for (const lesson of lessons) {
      const content = `${lesson.title}\n${lesson.textContent ?? ''}`;
      if (content.trim().length < 50) continue; // Skip very short content

      const chunks = this.chunkText(content, 500, 50);

      for (const chunk of chunks) {
        const embedding = await this.generateEmbedding(chunk);
        const embeddingStr = `[${embedding.join(',')}]`;

        await this.prisma.$executeRaw`
          INSERT INTO course_chunks (id, course_id, lesson_id, content, embedding, created_at)
          VALUES (gen_random_uuid(), ${courseId}, ${lesson.id}, ${chunk}, ${embeddingStr}::vector, now())
        `;
      }
    }
  }

  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      const chunk = text.slice(i, i + chunkSize).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
    }
    return chunks;
  }
}
```

**Key points:**
- **Dynamic import** for `@huggingface/transformers` — ESM module in CommonJS project
- **`onModuleInit`** loads model at startup (~50MB download first time, then cached)
- **Graceful degradation**: if model fails to load, log warning (AI features disabled, app still works)
- **pgvector INSERT**: embedding formatted as `[0.1,0.2,...]::vector` string
- **Chunking**: 500 chars with 50 char overlap — prevents context loss at boundaries
- **Re-index**: delete existing chunks first → idempotent

---

## Step 5: AiTutorService

```typescript
import Groq from 'groq-sdk';

@Injectable()
export class AiTutorService {
  private groq: Groq;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(EmbeddingsService) private readonly embeddingsService: EmbeddingsService,
  ) {
    this.groq = new Groq({ apiKey: this.config.getOrThrow<string>('groq.apiKey') });
  }

  async askQuestion(userId: string, dto: AskQuestionDto) {
    // Gate 1: Rate limit (10 questions/day per user)
    const dateKey = new Date().toISOString().slice(0, 10);
    const limitKey = `ai_limit:${userId}:${dateKey}`;
    const allowed = await this.redis.checkRateLimit(limitKey, 10, 86400);
    if (!allowed) {
      throw new BadRequestException({ code: 'AI_DAILY_LIMIT_REACHED' });
    }

    // Gate 2: Enrollment check
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { userId, courseId: dto.courseId },
    });
    if (!enrollment) {
      throw new ForbiddenException({ code: 'ENROLLMENT_REQUIRED' });
    }

    // Get or create session
    const session = dto.sessionId
      ? await this.getSession(dto.sessionId, userId)
      : await this.createSession(userId, dto.courseId, dto.question);

    // RAG: retrieve relevant context
    const context = await this.retrieveContext(dto.courseId, dto.question);

    // Get conversation history (last 10 messages for context window)
    const history = await this.prisma.aiChatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    // Build messages array
    const systemPrompt = `You are an AI tutor for an online course. Answer based on the course content provided below.
If the answer is not in the course content, say so honestly. Be helpful, educational, and encouraging.
Always answer in the same language the student asks in.

Course Context:
${context}`;

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({
        role: m.role.toLowerCase() as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: dto.question },
    ];

    // Save user message
    await this.prisma.aiChatMessage.create({
      data: { sessionId: session.id, role: 'USER', content: dto.question },
    });

    // Call Groq API
    const completion = await this.groq.chat.completions.create({
      model: this.config.get<string>('groq.model') ?? 'llama-3.3-70b-versatile',
      messages,
      max_tokens: this.config.get<number>('groq.maxTokens') ?? 2048,
      temperature: 0.7,
    });

    const answer = completion.choices[0]?.message?.content
      ?? 'Sorry, I could not generate a response.';

    // Save assistant message
    const savedMessage = await this.prisma.aiChatMessage.create({
      data: { sessionId: session.id, role: 'ASSISTANT', content: answer },
    });

    // Update session title if first message
    if (history.length === 0) {
      const title = dto.question.length > 50
        ? dto.question.slice(0, 47) + '...'
        : dto.question;
      await this.prisma.aiChatSession.update({
        where: { id: session.id },
        data: { title },
      });
    }

    return {
      answer,
      sessionId: session.id,
      messageId: savedMessage.id,
    };
  }

  async getSessions(userId: string, courseId?: string) {
    const where: Prisma.AiChatSessionWhereInput = {
      userId,
      ...(courseId && { courseId }),
    };

    return this.prisma.aiChatSession.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        courseId: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });
  }

  async getSessionMessages(sessionId: string, userId: string) {
    const session = await this.prisma.aiChatSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.userId !== userId) {
      throw new ForbiddenException({ code: 'NOT_SESSION_OWNER' });
    }

    return this.prisma.aiChatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // --- Private helpers ---

  private async retrieveContext(courseId: string, question: string): Promise<string> {
    try {
      const queryEmbedding = await this.embeddingsService.generateEmbedding(question);
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      const chunks = await this.prisma.$queryRaw<{ content: string; similarity: number }[]>`
        SELECT content, 1 - (embedding <=> ${embeddingStr}::vector) AS similarity
        FROM course_chunks
        WHERE course_id = ${courseId}
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT 5
      `;

      if (chunks.length === 0) return 'No relevant course content found.';

      return chunks.map((c) => c.content).join('\n\n---\n\n');
    } catch {
      // Embeddings not available → return empty context
      return 'Course content is not yet indexed for AI search.';
    }
  }

  private async getSession(sessionId: string, userId: string) {
    const session = await this.prisma.aiChatSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.userId !== userId) {
      throw new ForbiddenException({ code: 'NOT_SESSION_OWNER' });
    }
    return session;
  }

  private async createSession(userId: string, courseId: string, firstQuestion: string) {
    const title = firstQuestion.length > 50
      ? firstQuestion.slice(0, 47) + '...'
      : firstQuestion;

    return this.prisma.aiChatSession.create({
      data: { userId, courseId, title },
    });
  }
}
```

**Key points:**
- **2 gates**: Rate limit (10/day Redis) + Enrollment check
- **Session**: use existing if `sessionId` provided, create new otherwise
- **Conversation history**: last 10 messages included in Groq request for context continuity
- **Auto title**: first question truncated to 50 chars for session title
- **RAG context**: pgvector cosine similarity search, graceful fallback if embeddings unavailable
- **Embedding string format**: `[0.1,0.2,...]::vector` for Prisma raw query
- **Non-streaming**: return full answer as JSON (streaming SSE = follow-up optimization)

---

## Step 6: Controller

```typescript
@Controller('ai/tutor')
@ApiTags('AI Tutor')
@ApiBearerAuth()
export class AiTutorController {
  constructor(@Inject(AiTutorService) private readonly service: AiTutorService) {}

  @Post('ask')
  @ApiOperation({ summary: 'Ask AI tutor a question (RAG)' })
  async ask(@CurrentUser() user: JwtPayload, @Body() dto: AskQuestionDto) {
    return this.service.askQuestion(user.sub, dto);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List AI chat sessions' })
  async getSessions(
    @CurrentUser() user: JwtPayload,
    @Query('courseId') courseId?: string,
  ) {
    return this.service.getSessions(user.sub, courseId);
  }

  @Get('sessions/:id/messages')
  @ApiOperation({ summary: 'Get session message history' })
  async getSessionMessages(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.getSessionMessages(id, user.sub);
  }
}
```

---

## Step 7: Module

```typescript
@Module({
  imports: [JwtModule.register({})],
  controllers: [AiTutorController],
  providers: [AiTutorService, EmbeddingsService],
  exports: [EmbeddingsService],
})
export class AiTutorModule {}
```

**`exports: [EmbeddingsService]`** — Admin module (Phase 5.11) will use for course re-indexing.

---

## Step 8: Verify

- [ ] `npm install @huggingface/transformers` succeeds
- [ ] EmbeddingsService loads model on startup (or graceful fallback)
- [ ] generateEmbedding returns number[] (384 dimensions)
- [ ] indexCourseContent chunks text lessons and inserts with pgvector
- [ ] Rate limit: 11th question in same day → AI_DAILY_LIMIT_REACHED
- [ ] Enrollment check: non-enrolled → ENROLLMENT_REQUIRED
- [ ] askQuestion: RAG context retrieved → Groq API called → answer saved
- [ ] Conversation history included in Groq request (max 10 messages)
- [ ] Session auto-created with title from first question
- [ ] Existing session reused when sessionId provided
- [ ] getSessions lists sessions with message count
- [ ] getSessionMessages returns ordered messages (owner only)
- [ ] Graceful degradation: embeddings fail → AI still responds (without RAG context)
- [ ] `@Inject()` pattern, no `any`
- [ ] Build 0 errors, Lint 0 errors, Tests pass
