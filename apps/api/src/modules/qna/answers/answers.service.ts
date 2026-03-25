import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateAnswerDto } from '../dto/create-answer.dto';

const AUTHOR_SELECT = {
  id: true,
  fullName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class AnswersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async create(authorId: string, questionId: string, dto: CreateAnswerDto) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });
    if (!question) {
      throw new NotFoundException({ code: 'QUESTION_NOT_FOUND' });
    }

    return this.prisma.$transaction(async (tx) => {
      const answer = await tx.answer.create({
        data: {
          content: dto.content,
          codeSnippet: dto.codeSnippet
            ? (dto.codeSnippet as unknown as Prisma.InputJsonValue)
            : undefined,
          authorId,
          questionId,
        },
        include: { author: { select: AUTHOR_SELECT } },
      });

      await tx.question.update({
        where: { id: questionId },
        data: { answerCount: { increment: 1 } },
      });

      // Notify question author (skip self-answer)
      if (question.authorId !== authorId) {
        const answerer = await this.prisma.user.findUnique({
          where: { id: authorId },
          select: { fullName: true },
        });
        this.notifications
          .create(question.authorId, 'QUESTION_ANSWERED', {
            questionId,
            answerId: answer.id,
            userId: authorId,
            fullName: answerer?.fullName,
          })
          .catch(() => {});
      }

      return answer;
    });
  }

  async delete(answerId: string, userId: string) {
    const answer = await this.prisma.answer.findUnique({
      where: { id: answerId },
    });
    if (!answer || answer.authorId !== userId) {
      throw new ForbiddenException({ code: 'NOT_ANSWER_OWNER' });
    }

    return this.prisma.$transaction(async (tx) => {
      // Unset bestAnswer if this was the best answer
      await tx.question.updateMany({
        where: { bestAnswerId: answerId },
        data: { bestAnswerId: null },
      });

      await tx.answer.delete({ where: { id: answerId } });

      await tx.question.update({
        where: { id: answer.questionId },
        data: { answerCount: { decrement: 1 } },
      });
    });
  }

  async vote(userId: string, answerId: string, value: number) {
    const answer = await this.prisma.answer.findUnique({
      where: { id: answerId },
    });
    if (!answer) {
      throw new NotFoundException({ code: 'ANSWER_NOT_FOUND' });
    }

    if (answer.authorId === userId) {
      throw new BadRequestException({ code: 'CANNOT_VOTE_OWN_ANSWER' });
    }

    const existing = await this.prisma.vote.findUnique({
      where: { userId_answerId: { userId, answerId } },
    });

    // Remove vote (value=0 or same value toggle)
    if (existing && (value === 0 || existing.value === value)) {
      await this.prisma.$transaction([
        this.prisma.vote.delete({ where: { id: existing.id } }),
        this.prisma.answer.update({
          where: { id: answerId },
          data: { voteCount: { decrement: existing.value } },
        }),
      ]);
      return {
        voteCount: answer.voteCount - existing.value,
        userVote: null,
      };
    }

    // Change vote (existing with different value)
    if (existing) {
      await this.prisma.$transaction([
        this.prisma.vote.update({
          where: { id: existing.id },
          data: { value },
        }),
        this.prisma.answer.update({
          where: { id: answerId },
          data: { voteCount: { increment: value * 2 } },
        }),
      ]);
      return {
        voteCount: answer.voteCount + value * 2,
        userVote: value,
      };
    }

    // New vote
    await this.prisma.$transaction([
      this.prisma.vote.create({ data: { userId, answerId, value } }),
      this.prisma.answer.update({
        where: { id: answerId },
        data: { voteCount: { increment: value } },
      }),
    ]);
    return {
      voteCount: answer.voteCount + value,
      userVote: value,
    };
  }
}
