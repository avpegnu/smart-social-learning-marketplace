import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
import { ReviewSortBy } from '../dto/query-reviews.dto';
import type { QueryReviewsDto } from '../dto/query-reviews.dto';
import type { CreateReviewDto } from '../dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(userId: string, courseId: string, dto: CreateReviewDto) {
    // Check course exists and is published
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, status: 'PUBLISHED', deletedAt: null },
    });
    if (!course) {
      throw new NotFoundException({ code: 'COURSE_NOT_FOUND' });
    }

    // Check enrollment
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) {
      throw new ForbiddenException({ code: 'NOT_ENROLLED' });
    }

    // Check minimum 30% progress
    if (enrollment.progress < 0.3) {
      throw new BadRequestException({ code: 'INSUFFICIENT_PROGRESS' });
    }

    // Check unique constraint (1 review per user per course)
    const existing = await this.prisma.review.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) {
      throw new ConflictException({ code: 'ALREADY_REVIEWED' });
    }

    // Create review + recalculate course avgRating in transaction
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: { userId, courseId, rating: dto.rating, comment: dto.comment },
        include: {
          user: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      });

      // Recalculate avg rating
      const agg = await tx.review.aggregate({
        where: { courseId },
        _avg: { rating: true },
        _count: true,
      });

      await tx.course.update({
        where: { id: courseId },
        data: {
          avgRating: agg._avg.rating ?? 0,
          reviewCount: agg._count,
        },
      });

      return review;
    });
  }

  async findByCourse(courseId: string, query: QueryReviewsDto) {
    const orderBy = this.buildReviewSort(query.sort);

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { courseId },
        orderBy,
        skip: query.skip,
        take: query.limit,
        include: {
          user: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      }),
      this.prisma.review.count({ where: { courseId } }),
    ]);

    return createPaginatedResult(reviews, total, query.page, query.limit);
  }

  async update(userId: string, reviewId: string, dto: CreateReviewDto) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review || review.userId !== userId) {
      throw new NotFoundException({ code: 'REVIEW_NOT_FOUND' });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.review.update({
        where: { id: reviewId },
        data: { rating: dto.rating, comment: dto.comment },
        include: {
          user: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      });

      // Recalculate avg rating
      const agg = await tx.review.aggregate({
        where: { courseId: review.courseId },
        _avg: { rating: true },
      });
      await tx.course.update({
        where: { id: review.courseId },
        data: { avgRating: agg._avg.rating ?? 0 },
      });

      return result;
    });

    return updated;
  }

  async delete(userId: string, reviewId: string) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review || review.userId !== userId) {
      throw new NotFoundException({ code: 'REVIEW_NOT_FOUND' });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.review.update({ where: { id: reviewId }, data: { deletedAt: new Date() } });

      // Recalculate avg rating + count (exclude deleted)
      const agg = await tx.review.aggregate({
        where: { courseId: review.courseId, deletedAt: null },
        _avg: { rating: true },
        _count: true,
      });
      await tx.course.update({
        where: { id: review.courseId },
        data: {
          avgRating: agg._avg.rating ?? 0,
          reviewCount: agg._count,
        },
      });
    });
  }

  private buildReviewSort(sort?: ReviewSortBy): Prisma.ReviewOrderByWithRelationInput {
    switch (sort) {
      case ReviewSortBy.HIGHEST:
        return { rating: 'desc' };
      case ReviewSortBy.LOWEST:
        return { rating: 'asc' };
      case ReviewSortBy.NEWEST:
      default:
        return { createdAt: 'desc' };
    }
  }
}
