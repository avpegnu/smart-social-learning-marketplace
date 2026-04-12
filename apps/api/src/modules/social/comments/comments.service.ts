import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { QueueService } from '@/modules/jobs/queue.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
import type { PaginationDto } from '@/common/dto/pagination.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateCommentDto } from '../dto/create-comment.dto';
import { AUTHOR_SELECT } from '../posts/posts.service';

@Injectable()
export class CommentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}

  async create(authorId: string, postId: string, dto: CreateCommentDto) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId, deletedAt: null },
    });
    if (!post) throw new NotFoundException({ code: 'POST_NOT_FOUND' });

    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent || parent.postId !== postId) {
        throw new BadRequestException({ code: 'INVALID_PARENT_COMMENT' });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          content: dto.content,
          authorId,
          postId,
          parentId: dto.parentId,
        },
        include: { author: { select: AUTHOR_SELECT } },
      });

      await tx.post.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      });

      // Notify post author (skip self-comment)
      const commenter = await this.prisma.user.findUnique({
        where: { id: authorId },
        select: { fullName: true },
      });

      if (post.authorId !== authorId) {
        this.queue.addNotification(post.authorId, 'POST_COMMENT', {
          postId,
          commentId: comment.id,
          userId: authorId,
          fullName: commenter?.fullName,
        });
      }

      // If this is a reply, also notify the parent comment author
      if (dto.parentId) {
        const parentComment = await tx.comment.findUnique({
          where: { id: dto.parentId },
          select: { authorId: true },
        });
        if (
          parentComment &&
          parentComment.authorId !== authorId &&
          parentComment.authorId !== post.authorId
        ) {
          this.queue.addNotification(parentComment.authorId, 'POST_COMMENT', {
            postId,
            commentId: comment.id,
            userId: authorId,
            fullName: commenter?.fullName,
            isReply: true,
          });
        }
      }

      return comment;
    });
  }

  async getByPost(postId: string, query: PaginationDto) {
    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { postId, parentId: null, deletedAt: null },
        include: {
          author: { select: AUTHOR_SELECT },
          replies: {
            where: { deletedAt: null },
            take: 3,
            include: { author: { select: AUTHOR_SELECT } },
            orderBy: { createdAt: 'asc' },
          },
          _count: { select: { replies: { where: { deletedAt: null } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.comment.count({ where: { postId, parentId: null, deletedAt: null } }),
    ]);

    return createPaginatedResult(comments, total, query.page, query.limit);
  }

  async getReplies(commentId: string, query: PaginationDto) {
    const [replies, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { parentId: commentId, deletedAt: null },
        include: { author: { select: AUTHOR_SELECT } },
        orderBy: { createdAt: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.comment.count({ where: { parentId: commentId, deletedAt: null } }),
    ]);
    return createPaginatedResult(replies, total, query.page, query.limit);
  }

  async delete(commentId: string, userId: string, postId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.authorId !== userId) {
      throw new ForbiddenException({ code: 'NOT_COMMENT_OWNER' });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
      await tx.post.update({
        where: { id: postId },
        data: { commentCount: { decrement: 1 } },
      });
    });
  }
}
