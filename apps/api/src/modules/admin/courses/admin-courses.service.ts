import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PaginationDto } from '@/common/dto/pagination.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReviewCourseDto } from '../dto/review-course.dto';

@Injectable()
export class AdminCoursesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getPendingCourses(query: PaginationDto) {
    const where = {
      status: 'PENDING_REVIEW' as const,
      deletedAt: null,
    };

    const [courses, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        include: {
          instructor: {
            select: { id: true, fullName: true },
          },
          category: {
            select: { id: true, name: true },
          },
          _count: { select: { sections: true } },
        },
        orderBy: { updatedAt: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.course.count({ where }),
    ]);

    return createPaginatedResult(courses, total, query.page, query.limit);
  }

  async reviewCourse(courseId: string, _adminId: string, dto: ReviewCourseDto) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException({ code: 'COURSE_NOT_FOUND' });
    }
    if (course.status !== 'PENDING_REVIEW') {
      throw new BadRequestException({
        code: 'COURSE_NOT_PENDING_REVIEW',
      });
    }

    if (dto.approved) {
      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.course.update({
          where: { id: courseId },
          data: {
            status: 'PUBLISHED',
            publishedAt: course.publishedAt ?? new Date(),
          },
        });

        // Auto-create private course group
        await tx.group.create({
          data: {
            name: updated.title,
            description: `Discussion group for ${updated.title}`,
            courseId: updated.id,
            ownerId: course.instructorId,
            privacy: 'PRIVATE',
          },
        });

        return updated;
      });
    }

    return this.prisma.course.update({
      where: { id: courseId },
      data: { status: 'REJECTED' },
    });
  }
}
