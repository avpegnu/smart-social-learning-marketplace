import { Injectable, Inject, BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import Groq from 'groq-sdk';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { EmbeddingsService } from './embeddings/embeddings.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AskQuestionDto } from './dto/ask-question.dto';

export type StreamEvent =
  | { type: 'start'; sessionId: string }
  | { type: 'token'; content: string }
  | { type: 'done'; messageId: string; sessionId: string }
  | { type: 'error'; code: string };

@Injectable()
export class AiTutorService {
  private groq: Groq;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(EmbeddingsService)
    private readonly embeddingsService: EmbeddingsService,
  ) {
    this.groq = new Groq({
      apiKey: this.config.getOrThrow<string>('groq.apiKey'),
    });
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

    // Get last 10 messages for context window (fetch desc, then reverse to chronological)
    const historyDesc = await this.prisma.aiChatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const history = historyDesc.reverse();

    // Build messages array
    const messages = this.buildMessages(context, history, dto.question);

    // Save user message
    await this.prisma.aiChatMessage.create({
      data: {
        sessionId: session.id,
        role: 'USER',
        content: dto.question,
      },
    });

    // Call Groq API
    const completion = await this.groq.chat.completions.create({
      model: this.config.get<string>('groq.model') ?? 'llama-3.3-70b-versatile',
      messages,
      max_tokens: this.config.get<number>('groq.maxTokens') ?? 2048,
      temperature: 0.7,
    });

    const answer =
      completion.choices[0]?.message?.content ?? 'Sorry, I could not generate a response.';

    // Save assistant message
    const savedMessage = await this.prisma.aiChatMessage.create({
      data: {
        sessionId: session.id,
        role: 'ASSISTANT',
        content: answer,
      },
    });

    return {
      answer,
      sessionId: session.id,
      messageId: savedMessage.id,
    };
  }

  async *askQuestionStream(userId: string, dto: AskQuestionDto): AsyncGenerator<StreamEvent> {
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

    yield { type: 'start', sessionId: session.id };

    // RAG: retrieve relevant context
    const context = await this.retrieveContext(dto.courseId, dto.question);

    // Get last 10 messages for context window (fetch desc, then reverse to chronological)
    const historyDesc = await this.prisma.aiChatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const history = historyDesc.reverse();

    // Build messages array
    const messages = this.buildMessages(context, history, dto.question);

    // Save user message
    await this.prisma.aiChatMessage.create({
      data: { sessionId: session.id, role: 'USER', content: dto.question },
    });

    // Stream from Groq API
    const stream = await this.groq.chat.completions.create({
      model: this.config.get<string>('groq.model') ?? 'llama-3.3-70b-versatile',
      messages,
      max_tokens: this.config.get<number>('groq.maxTokens') ?? 2048,
      temperature: 0.7,
      stream: true,
    });

    const isDev = this.config.get<string>('app.nodeEnv') !== 'production';
    let fullAnswer = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullAnswer += content;
        yield { type: 'token', content };
        // Slow down streaming in dev for visible SSE effect
        if (isDev) await new Promise((r) => setTimeout(r, 30));
      }
    }

    if (!fullAnswer) {
      fullAnswer = 'Sorry, I could not generate a response.';
      yield { type: 'token', content: fullAnswer };
    }

    // Save assistant message
    const savedMessage = await this.prisma.aiChatMessage.create({
      data: { sessionId: session.id, role: 'ASSISTANT', content: fullAnswer },
    });

    yield { type: 'done', messageId: savedMessage.id, sessionId: session.id };
  }

  async getQuota(userId: string) {
    const dateKey = new Date().toISOString().slice(0, 10);
    const limitKey = `ai_limit:${userId}:${dateKey}`;
    const used = Number(await this.redis.get(limitKey)) || 0;
    return { used, limit: 10, remaining: Math.max(0, 10 - used) };
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

  private buildMessages(
    context: string,
    history: { role: string; content: string }[],
    question: string,
  ) {
    const systemPrompt = `You are an AI tutor for an online course. Answer based on the course content provided below.
If the answer is not in the course content, say so honestly. Be helpful, educational, and encouraging.
Always answer in the same language the student asks in.

Course Context:
${context}`;

    return [
      { role: 'system' as const, content: systemPrompt },
      ...history.map((m) => ({
        role: m.role.toLowerCase() as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: question },
    ];
  }

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
    const title = firstQuestion.length > 50 ? firstQuestion.slice(0, 47) + '...' : firstQuestion;

    return this.prisma.aiChatSession.create({
      data: { userId, courseId, title },
    });
  }
}
