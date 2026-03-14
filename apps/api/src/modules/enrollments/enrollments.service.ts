import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
import type { PaginationDto } from '@/common/dto/pagination.dto';

@Injectable()
export class EnrollmentsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async checkEnrollment(userId: string, courseId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    // Also check individual chapter purchases
    let purchasedChapterIds: string[] = [];
    if (!enrollment || enrollment.type === 'PARTIAL') {
      const purchases = await this.prisma.chapterPurchase.findMany({
        where: { userId, chapter: { section: { courseId } } },
        select: { chapterId: true },
      });
      purchasedChapterIds = purchases.map((p) => p.chapterId);
    }

    return {
      enrolled: !!enrollment,
      type: enrollment?.type ?? null,
      progress: enrollment?.progress ?? 0,
      purchasedChapterIds,
    };
  }

  async getMyLearning(userId: string, query: PaginationDto) {
    const [enrollments, total] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { userId },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              thumbnailUrl: true,
              totalLessons: true,
              totalDuration: true,
              instructor: { select: { fullName: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.enrollment.count({ where: { userId } }),
    ]);
    return createPaginatedResult(enrollments, total, query.page, query.limit);
  }

  async enrollFree(userId: string, courseId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, status: 'PUBLISHED', deletedAt: null, price: 0 },
    });
    if (!course) throw new NotFoundException({ code: 'COURSE_NOT_FOUND' });

    if (course.instructorId === userId) {
      throw new BadRequestException({ code: 'CANNOT_ENROLL_OWN_COURSE' });
    }

    const existing = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) throw new ConflictException({ code: 'ALREADY_ENROLLED' });

    return this.prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.create({
        data: { userId, courseId, type: 'FULL' },
      });
      await tx.course.update({
        where: { id: courseId },
        data: { totalStudents: { increment: 1 } },
      });
      return enrollment;
    });
  }
}
