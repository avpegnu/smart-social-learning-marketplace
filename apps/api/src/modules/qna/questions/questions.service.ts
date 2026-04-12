import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateQuestionDto } from '../dto/create-question.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateQuestionDto } from '../dto/update-question.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { QueryQuestionsDto } from '../dto/query-questions.dto';

const AUTHOR_SELECT = {
  id: true,
  fullName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class QuestionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  async create(authorId: string, dto: CreateQuestionDto) {
    return this.prisma.question.create({
      data: {
        title: dto.title,
        content: dto.content,
        codeSnippet: dto.codeSnippet
          ? (dto.codeSnippet as unknown as Prisma.InputJsonValue)
          : undefined,
        authorId,
        courseId: dto.courseId,
        tagId: dto.tagId,
      },
      include: {
        author: { select: AUTHOR_SELECT },
        course: { select: { id: true, title: true } },
        tag: { select: { id: true, name: true } },
      },
    });
  }

  async findAll(query: QueryQuestionsDto) {
    const where: Prisma.QuestionWhereInput = {
      ...(query.courseId && { courseId: query.courseId }),
      ...(query.instructorId && {
        course: { instructorId: query.instructorId },
      }),
      ...(query.tagId && { tagId: query.tagId }),
      ...(query.search && {
        OR: [
          {
            title: {
              contains: query.search,
              mode: 'insensitive' as const,
            },
          },
          {
            content: {
              contains: query.search,
              mode: 'insensitive' as const,
            },
          },
        ],
      }),
      ...(query.status === 'answered' && {
        bestAnswerId: { not: null },
      }),
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

    const data = questions.map((q) => ({
      ...q,
      hasBestAnswer: !!q.bestAnswerId,
    }));

    return createPaginatedResult(data, total, query.page, query.limit);
  }

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
            votes: viewerId ? { where: { userId: viewerId }, select: { value: true } } : false,
          },
          orderBy: { voteCount: 'desc' },
        },
        bestAnswer: {
          include: { author: { select: AUTHOR_SELECT } },
        },
      },
    });

    if (!question) {
      throw new NotFoundException({ code: 'QUESTION_NOT_FOUND' });
    }

    // Map answers to include userVote field
    const answers = question.answers.map((answer) => {
      const { votes, ...rest } = answer as typeof answer & { votes?: { value: number }[] };
      return {
        ...rest,
        userVote: votes?.[0]?.value ?? null,
      };
    });

    // Increment view count only for unique viewers (fire-and-forget)
    if (viewerId) {
      const viewKey = `qview:${questionId}`;
      this.redis
        .sadd(viewKey, viewerId)
        .then(async (added) => {
          if (added === 1) {
            const ttl = await this.redis.ttl(viewKey);
            if (ttl === -1) {
              await this.redis.expire(viewKey, 30 * 24 * 3600);
            }
            await this.prisma.question.update({
              where: { id: questionId },
              data: { viewCount: { increment: 1 } },
            });
          }
        })
        .catch(() => {
          /* ignore */
        });
    }

    return { ...question, answers };
  }

  async findSimilar(title: string, limit = 5) {
    const searchTerms = title.split(' ').slice(0, 3).join(' ');
    return this.prisma.question.findMany({
      where: {
        title: { contains: searchTerms, mode: 'insensitive' },
      },
      select: {
        id: true,
        title: true,
        answerCount: true,
        bestAnswerId: true,
      },
      take: limit,
    });
  }

  async update(questionId: string, userId: string, dto: UpdateQuestionDto) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });
    if (!question || question.authorId !== userId) {
      throw new ForbiddenException({ code: 'NOT_QUESTION_OWNER' });
    }

    return this.prisma.question.update({
      where: { id: questionId },
      data: {
        title: dto.title,
        content: dto.content,
        codeSnippet: dto.codeSnippet
          ? (dto.codeSnippet as unknown as Prisma.InputJsonValue)
          : undefined,
      },
      include: {
        author: { select: AUTHOR_SELECT },
      },
    });
  }

  async delete(questionId: string, userId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });
    if (!question || question.authorId !== userId) {
      throw new ForbiddenException({ code: 'NOT_QUESTION_OWNER' });
    }
    return this.prisma.question.update({
      where: { id: questionId },
      data: { deletedAt: new Date() },
    });
  }

  async markBestAnswer(questionId: string, answerId: string, userId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { course: { select: { instructorId: true } } },
    });
    if (!question) {
      throw new NotFoundException({ code: 'QUESTION_NOT_FOUND' });
    }

    const isOwner = question.authorId === userId;
    const isInstructor = question.course?.instructorId === userId;
    if (!isOwner && !isInstructor) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_TO_MARK_BEST',
      });
    }

    const answer = await this.prisma.answer.findUnique({
      where: { id: answerId },
    });
    if (!answer || answer.questionId !== questionId) {
      throw new BadRequestException({
        code: 'ANSWER_NOT_FOR_THIS_QUESTION',
      });
    }

    return this.prisma.question.update({
      where: { id: questionId },
      data: { bestAnswerId: answerId },
    });
  }
}
