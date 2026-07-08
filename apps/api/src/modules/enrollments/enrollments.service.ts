import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { QueueService } from '@/modules/jobs/queue.service';
import { GroupsService } from '@/modules/social/groups/groups.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
import { computeUpgradeInfo } from '@/common/utils/upgrade-price.util';
import type { PaginationDto } from '@/common/dto/pagination.dto';

@Injectable()
export class EnrollmentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QueueService) private readonly queue: QueueService,
    @Inject(GroupsService) private readonly groupsService: GroupsService,
  ) {}

  async checkEnrollment(userId: string, courseId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    // For anyone without a FULL enrollment, surface which chapters they own and,
    // for PARTIAL learners, the price to upgrade to the full course.
    let purchasedChapterIds: string[] = [];
    let upgrade: { upgradePrice: number; coursePrice: number; credit: number } | null = null;
    if (!enrollment || enrollment.type === 'PARTIAL') {
      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
        select: { price: true },
      });
      const info = await computeUpgradeInfo(this.prisma, userId, courseId, course?.price ?? 0);
      purchasedChapterIds = info.purchasedChapterIds;
      // An upgrade offer only makes sense for a PARTIAL enrollee (owns ≥ 1 chapter).
      if (enrollment?.type === 'PARTIAL') {
        upgrade = {
          upgradePrice: info.upgradePrice,
          coursePrice: info.coursePrice,
          credit: info.credit,
        };
      }
    }

    return {
      enrolled: !!enrollment,
      type: enrollment?.type ?? null,
      progress: enrollment?.progress ?? 0,
      purchasedChapterIds,
      upgrade,
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

    const enrollment = await this.prisma.$transaction(async (tx) => {
      const result = await tx.enrollment.create({
        data: { userId, courseId, type: 'FULL' },
      });
      await tx.course.update({
        where: { id: courseId },
        data: { totalStudents: { increment: 1 } },
      });

      return result;
    });

    // Add to course group (after transaction commits)
    await this.groupsService.addMemberByCourseId(courseId, userId);

    // Notify instructor about new enrollment
    this.queue.addNotification(course.instructorId, 'COURSE_ENROLLED', {
      courseId,
      courseTitle: course.title,
    });

    return enrollment;
  }
}
