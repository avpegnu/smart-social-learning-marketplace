import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class AdminModerationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async deletePost(postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId, deletedAt: null },
    });
    if (!post) throw new NotFoundException({ code: 'POST_NOT_FOUND' });

    return this.prisma.post.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });
  }

  async deleteComment(commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId, deletedAt: null },
      select: { id: true, postId: true },
    });
    if (!comment) throw new NotFoundException({ code: 'COMMENT_NOT_FOUND' });

    return this.prisma.$transaction(async (tx) => {
      await tx.comment.update({
        where: { id: commentId },
        data: { deletedAt: new Date() },
      });
      await tx.post.update({
        where: { id: comment.postId },
        data: { commentCount: { decrement: 1 } },
      });
    });
  }

  async deleteQuestion(questionId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId, deletedAt: null },
    });
    if (!question) throw new NotFoundException({ code: 'QUESTION_NOT_FOUND' });

    return this.prisma.question.update({
      where: { id: questionId },
      data: { deletedAt: new Date() },
    });
  }

  async deleteAnswer(answerId: string) {
    const answer = await this.prisma.answer.findUnique({
      where: { id: answerId, deletedAt: null },
      select: { id: true, questionId: true },
    });
    if (!answer) throw new NotFoundException({ code: 'ANSWER_NOT_FOUND' });

    return this.prisma.$transaction(async (tx) => {
      await tx.question.updateMany({
        where: { bestAnswerId: answerId },
        data: { bestAnswerId: null },
      });
      await tx.answer.update({
        where: { id: answerId },
        data: { deletedAt: new Date() },
      });
      await tx.question.update({
        where: { id: answer.questionId },
        data: { answerCount: { decrement: 1 } },
      });
    });
  }

  async unpublishCourse(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, status: true },
    });
    if (!course) throw new NotFoundException({ code: 'COURSE_NOT_FOUND' });

    return this.prisma.course.update({
      where: { id: courseId },
      data: { status: 'REJECTED' },
    });
  }

  async deleteByTargetType(targetType: string, targetId: string) {
    switch (targetType) {
      case 'POST':
        return this.deletePost(targetId);
      case 'COMMENT':
        return this.deleteComment(targetId);
      case 'QUESTION':
        return this.deleteQuestion(targetId);
      case 'ANSWER':
        return this.deleteAnswer(targetId);
      case 'COURSE':
        return this.unpublishCourse(targetId);
      default:
        return null;
    }
  }
}
